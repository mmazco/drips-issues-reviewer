import { NextResponse } from 'next/server';
import { runAgent, extractJson, AnthropicNotConfiguredError } from '@/lib/anthropic';
import { ISSUE_REVIEW_SYSTEM } from '@/lib/prompts';

export const runtime = 'nodejs';

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
  reviewer?: { username?: string };
}

interface IssueReview {
  verdict: 'ready' | 'needs-work' | 'reject';
  suggested_complexity: 'Trivial' | 'Medium' | 'High';
  complexity_reasoning: string;
  rewritten_title: string | null;
  missing: string[];
  scope_concern: string | null;
  suggestions: string;
  comment_draft?: string;
}

function buildUserMessage(body: FeedbackRequest): string {
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

  const reviewerLine = body.reviewer?.username
    ? `Reviewer: @${body.reviewer.username}`
    : '';

  return `Issue URL: ${issue.html_url}
Issue #${issue.number}: ${issue.title}
Labels: ${labels}
Milestone: ${issue.milestone?.title ?? 'none'}
${reviewerLine}

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
"""`;
}

export async function POST(request: Request) {
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

  let result: { text: string; durationMs: number; model: string };
  try {
    result = await runAgent({
      system: ISSUE_REVIEW_SYSTEM,
      userMessage: buildUserMessage(body),
    });
  } catch (e) {
    if (e instanceof AnthropicNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: `Anthropic call failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (result.text.trim() === '') {
    return NextResponse.json(
      { error: 'Empty response from Anthropic — check rate limits or model availability' },
      { status: 502 },
    );
  }

  const review = extractJson<IssueReview>(result.text);
  if ('error' in review) {
    return NextResponse.json(
      { error: review.error, details: review.raw.slice(0, 2000) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    review,
    durationMs: result.durationMs,
    model: result.model,
  });
}
