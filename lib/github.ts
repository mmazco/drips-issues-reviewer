import type { GitHubIssue } from './scoring';

async function githubFetch(url: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
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

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

export function buildVeraComment(issueTitle: string, missing: string[], suggestions: string, complexity: string): string {
  const missingList = missing.map(m => `- ${m}`).join('\n');
  return `👋 Hi! I'm Vera, reviewing this issue for Drips Wave readiness.

**Issue:** ${issueTitle}

**What I found:**

${missingList.length ? `**Missing:**\n${missingList}\n\n` : ''}**Suggestions:**
${suggestions}

**Suggested complexity tier:** ${complexity}

---
*For guidance on writing Wave-ready issues, see the [Drips "Creating Meaningful Issues" guide](https://www.drips.network/blog/posts/creating-meaningful-issues).*`;
}
