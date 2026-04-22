import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Shape the client sends us. Kept loose on purpose so we don't have to mirror
// the full ScoredIssue type here — Vera's skill decides what to do with it.
interface FeedbackRequest {
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels: Array<{ name: string } | string>;
    milestone?: { title: string } | null;
  };
  scorecard: {
    pct: number;
    grade: 'A' | 'B' | 'C' | 'D';
    suggestedComplexity: 'Trivial' | 'Medium' | 'High';
    checks: Record<string, { status: 'pass' | 'warn' | 'fail'; note: string }>;
  };
  // Optional — if the client wants to reuse a conversation across turns.
  sessionId?: string;
  // Optional — defaults to "main" on Vera's side; a custom agent with the
  // drips-qa-feedback skill loaded can be passed instead.
  agentName?: string;
}

// Expected JSON shape we want Vera to emit back via the drips-qa-feedback skill.
// Matches what app/review/page.tsx currently consumes in runAIReview().
interface VeraReview {
  verdict: 'ready' | 'needs-work' | 'reject';
  suggested_complexity: 'Trivial' | 'Medium' | 'High';
  complexity_reasoning: string;
  rewritten_title: string | null;
  missing: string[];
  scope_concern: string | null;
  suggestions: string;
  comment_draft?: string;
}

function buildPrompt(body: FeedbackRequest): string {
  const { issue, scorecard } = body;
  const labels = (issue.labels || [])
    .map(l => (typeof l === 'string' ? l : l.name))
    .join(', ') || 'none';

  const failed = Object.entries(scorecard.checks)
    .filter(([, v]) => v.status === 'fail')
    .map(([k, v]) => `- ${k}: ${v.note}`)
    .join('\n') || '(none)';

  const warned = Object.entries(scorecard.checks)
    .filter(([, v]) => v.status === 'warn')
    .map(([k, v]) => `- ${k}: ${v.note}`)
    .join('\n') || '(none)';

  return `You are the drips-qa-feedback skill. Review the following GitHub issue against the Drips Wave rubric and respond with STRICT JSON only (no prose, no markdown fences).

Issue URL: ${issue.html_url}
Issue #${issue.number}: ${issue.title}
Labels: ${labels}
Milestone: ${issue.milestone?.title ?? 'none'}

Deterministic scorecard (already computed by lib/scoring.ts):
- Score: ${scorecard.pct}% (grade ${scorecard.grade})
- Suggested complexity: ${scorecard.suggestedComplexity}
- Failed checks:
${failed}
- Warned checks:
${warned}

Issue body:
"""
${issue.body || '(empty body)'}
"""

Respond with ONLY this JSON shape:
{
  "verdict": "ready" | "needs-work" | "reject",
  "suggested_complexity": "Trivial" | "Medium" | "High",
  "complexity_reasoning": "one sentence",
  "rewritten_title": "better title or null",
  "missing": ["up to 5 short bullets"],
  "scope_concern": "string or null",
  "suggestions": "2-3 concrete fixes as a short paragraph",
  "comment_draft": "optional markdown QA comment ready to post on the issue"
}`;
}

function extractJson(raw: string): VeraReview | { error: string; raw: string } {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed) as VeraReview;
  } catch {
    // Fall back to first { ... } block.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as VeraReview;
      } catch {
        // fall through
      }
    }
    return { error: 'Vera response was not valid JSON', raw };
  }
}

export async function POST(request: Request) {
  const veraUrl = process.env.VERA_API_URL;
  if (!veraUrl) {
    return NextResponse.json(
      { error: 'VERA_API_URL not configured on server' },
      { status: 500 },
    );
  }

  let body: FeedbackRequest;
  try {
    body = (await request.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.issue?.html_url || !body?.scorecard) {
    return NextResponse.json(
      { error: 'Missing required fields: issue.html_url, scorecard' },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = process.env.VERA_API_TOKEN;
  if (token) headers['authorization'] = `Bearer ${token}`;

  // Use the session-based endpoint (`/api/sessions/:id/turn`) rather than
  // the legacy stateless `/api/agent/turn`. Upstream the legacy route has a
  // TypeBox `Intersect` schema bug that rejects every property; the session
  // route uses a single clean schema. We generate a fresh sessionId per
  // request so turns stay independent, and delete the snapshot afterwards
  // so state doesn't accumulate on disk.
  const sessionId =
    body.sessionId?.trim() || `drips-${Math.random().toString(36).slice(2, 10)}`;
  const agentName = body.agentName?.trim() || 'main';
  const veraBase = veraUrl.replace(/\/$/, '');
  const turnUrl = `${veraBase}/api/sessions/${encodeURIComponent(sessionId)}/turn`;
  const cleanupUrl = `${veraBase}/api/sessions/${encodeURIComponent(sessionId)}`;

  const veraPayload: Record<string, unknown> = {
    message: buildPrompt(body),
    agentName,
  };

  let veraRes: Response;
  try {
    veraRes = await fetch(turnUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(veraPayload),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach Vera at ${veraUrl}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!veraRes.ok) {
    const text = await veraRes.text().catch(() => '');
    return NextResponse.json(
      { error: `Vera returned ${veraRes.status}`, details: text.slice(0, 2000) },
      { status: 502 },
    );
  }

  const veraData = (await veraRes.json()) as {
    output?: string;
    sessionId?: string;
    durationMs?: number;
    model?: string;
  };

  // Fire-and-forget cleanup so /tmp doesn't fill with one-shot snapshots.
  // We intentionally don't await — the response to the client shouldn't
  // block on cleanup, and a failed delete is recoverable on Vera's side.
  if (!body.sessionId) {
    fetch(cleanupUrl, { method: 'DELETE', headers }).catch(() => {});
  }

  const output = veraData.output ?? '';

  // Vera swallows Anthropic/provider errors (e.g. 400 credit_balance_low)
  // into HTTP 200 with empty `output`. Treat that as a failure so the UI
  // falls back to the deterministic rubric review instead of rendering
  // a blank card.
  if (output.trim() === '') {
    return NextResponse.json(
      {
        error:
          'Vera returned empty output — likely an upstream LLM error (check credits, model availability, or vera-api logs)',
        durationMs: veraData.durationMs,
        sessionId: veraData.sessionId,
      },
      { status: 502 },
    );
  }

  const review = extractJson(output);
  if ('error' in review) {
    return NextResponse.json(
      { error: review.error, details: review.raw.slice(0, 2000) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    review,
    sessionId: veraData.sessionId,
    durationMs: veraData.durationMs,
    model: veraData.model,
  });
}
