import { NextResponse } from 'next/server';
import { fetchDocFiles, fetchRepoFile } from '@/lib/github';
import { runAgent, extractJson, AnthropicNotConfiguredError } from '@/lib/anthropic';
import { DOCS_REVIEW_SYSTEM, SETUP_REVIEW_SYSTEM } from '@/lib/prompts';

export const runtime = 'nodejs';

interface RepoCheckRequest {
  owner: string;
  repo: string;
  mode: 'docs' | 'setup';
  reviewer?: { username?: string };
  // OAuth token from the connected user; lets us hit the rate-limited 5k/hr
  // bucket instead of the anonymous 60/hr one. Optional — public repos work
  // anonymously, just slowly.
  githubToken?: string;
}

interface RepoCheckResponse {
  mode: 'docs' | 'setup';
  verdict: 'good' | 'needs-work' | 'broken';
  summary: string;
  findings: string[];
  issue_title: string | null;
  issue_body: string | null;
}

function buildDocsUserMessage(
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string; truncated: boolean }>,
  reviewerUsername?: string,
): string {
  const reviewerLine = reviewerUsername ? `Reviewer: @${reviewerUsername}` : '';
  const filesBlock = files.length
    ? files
        .map(f => `### ${f.path}${f.truncated ? ' (truncated)' : ''}\n"""\n${f.content}\n"""`)
        .join('\n\n')
    : '(no documentation files found at common paths)';

  return `Repository: ${owner}/${repo}
${reviewerLine}

Documentation files:
${filesBlock}`;
}

function buildSetupUserMessage(
  owner: string,
  repo: string,
  readme: { content: string; truncated: boolean } | null,
  contributing: { content: string; truncated: boolean } | null,
  reviewerUsername?: string,
): string {
  const reviewerLine = reviewerUsername ? `Reviewer: @${reviewerUsername}` : '';
  const readmeBlock = readme
    ? `### README${readme.truncated ? ' (truncated)' : ''}\n"""\n${readme.content}\n"""`
    : '(no README found)';
  const contribBlock = contributing
    ? `### CONTRIBUTING${contributing.truncated ? ' (truncated)' : ''}\n"""\n${contributing.content}\n"""`
    : '(no CONTRIBUTING file)';

  return `Repository: ${owner}/${repo}
${reviewerLine}

${readmeBlock}

${contribBlock}`;
}

export async function POST(request: Request) {
  let body: RepoCheckRequest;
  try {
    body = (await request.json()) as RepoCheckRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.owner || !body?.repo || !body?.mode) {
    return NextResponse.json(
      { error: 'Missing required fields: owner, repo, mode' },
      { status: 400 },
    );
  }
  if (body.mode !== 'docs' && body.mode !== 'setup') {
    return NextResponse.json({ error: `Unknown mode: ${body.mode}` }, { status: 400 });
  }

  // Step 1: fetch the relevant repo files server-side. Keeps prompt assembly
  // out of the client and the user's OAuth token off the network leg to
  // Anthropic.
  let userMessage: string;
  let system: string;
  try {
    if (body.mode === 'docs') {
      const files = await fetchDocFiles(body.owner, body.repo, body.githubToken);
      userMessage = buildDocsUserMessage(body.owner, body.repo, files, body.reviewer?.username);
      system = DOCS_REVIEW_SYSTEM;
    } else {
      const [readme, contributing] = await Promise.all([
        fetchRepoFile(body.owner, body.repo, 'README.md', body.githubToken).catch(() => null),
        fetchRepoFile(body.owner, body.repo, 'CONTRIBUTING.md', body.githubToken).catch(() => null),
      ]);
      const readmeBlock = readme
        ? { content: readme.content.slice(0, 16_000), truncated: readme.content.length > 16_000 }
        : null;
      const contribBlock = contributing
        ? { content: contributing.content.slice(0, 8_000), truncated: contributing.content.length > 8_000 }
        : null;
      userMessage = buildSetupUserMessage(body.owner, body.repo, readmeBlock, contribBlock, body.reviewer?.username);
      system = SETUP_REVIEW_SYSTEM;
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Could not fetch repo files: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Step 2: send to Anthropic.
  let result: { text: string; durationMs: number; model: string };
  try {
    result = await runAgent({ system, userMessage });
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

  const parsed = extractJson<Omit<RepoCheckResponse, 'mode'>>(result.text);
  if ('error' in parsed) {
    return NextResponse.json(
      { error: parsed.error, details: parsed.raw.slice(0, 2000) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    review: { ...parsed, mode: body.mode } as RepoCheckResponse,
    durationMs: result.durationMs,
    model: result.model,
  });
}
