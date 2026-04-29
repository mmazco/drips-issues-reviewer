import type { GitHubIssue } from './scoring';

async function githubFetch(url: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // 404 is the most common real-user error (typo'd URL or private
    // repo). Surface a plain-English message instead of GitHub's raw
    // "Not Found" body.
    if (res.status === 404) {
      throw new Error("Repo not found. Check the URL — or it may be private (this app only reads public repos).");
    }
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchAllIssues(owner: string, repo: string, token?: string): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  let page = 1;
  while (page <= 10) {
    const batch = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`,
      token
    );
    const issuesOnly = batch.filter((i: GitHubIssue) => !i.pull_request);
    all.push(...issuesOnly);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

export async function fetchRepoMeta(owner: string, repo: string, token?: string) {
  return githubFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
}

export async function postGitHubComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  token: string
) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function createGitHubIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  token: string,
  labels?: string[],
): Promise<{ number: number; html_url: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Fetch a single file from a repo via the Contents API. Returns null on 404
// so callers can probe optional paths (e.g. CONTRIBUTING.md may not exist).
export async function fetchRepoFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<{ content: string; path: string } | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  const data = (await res.json()) as { content?: string; encoding?: string; path: string };
  if (!data.content || data.encoding !== 'base64') return null;
  // GitHub returns base64 with embedded newlines; atob handles those fine.
  const decoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : atob(data.content.replace(/\n/g, ''));
  return { content: decoded, path: data.path };
}

// Best-effort grab of common documentation paths. Returns whatever exists,
// truncated so the combined payload stays well under prompt-budget limits.
// We deliberately don't list /docs recursively — that's a rabbit hole; the
// README + CONTRIBUTING + a couple of `docs/` top-level files cover 90% of
// real-world repos.
export async function fetchDocFiles(
  owner: string,
  repo: string,
  token?: string,
  maxBytes = 24_000,
): Promise<Array<{ path: string; content: string; truncated: boolean }>> {
  const candidates = [
    'README.md',
    'README',
    'CONTRIBUTING.md',
    '.github/CONTRIBUTING.md',
    'docs/README.md',
    'docs/getting-started.md',
    'docs/installation.md',
    'docs/INSTALL.md',
    'INSTALL.md',
  ];

  const results: Array<{ path: string; content: string; truncated: boolean }> = [];
  let usedBytes = 0;

  for (const path of candidates) {
    if (usedBytes >= maxBytes) break;
    let file: { content: string; path: string } | null;
    try {
      file = await fetchRepoFile(owner, repo, path, token);
    } catch {
      continue;
    }
    if (!file) continue;
    const remaining = maxBytes - usedBytes;
    const truncated = file.content.length > remaining;
    const content = truncated ? file.content.slice(0, remaining) : file.content;
    results.push({ path: file.path, content, truncated });
    usedBytes += content.length;
  }

  return results;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

export function buildVeraComment(
  issueTitle: string,
  missing: string[],
  suggestions: string,
  complexity: string,
  reviewerUsername?: string,
): string {
  const missingList = missing.map(m => `- ${m}`).join('\n');
  const signoff = reviewerUsername ? `\n\n*— Reviewed by @${reviewerUsername}*` : '';
  return `Hi from the Drips team — quick QA review for Wave readiness.

**Issue:** ${issueTitle}

${missingList.length ? `**Missing:**\n${missingList}\n\n` : ''}**Suggestions:**
${suggestions}

**Suggested complexity tier:** ${complexity}

---
*Want help reshaping this? Reply here or ping us in the Drips Discord.*${signoff}`;
}
