"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { parseRepoUrl, fetchAllIssues, fetchRepoMeta } from "@/lib/github";
import { scoreIssue, summarizeRepo, RUBRIC } from "@/lib/scoring";
import type { GitHubIssue, RepoSummary } from "@/lib/scoring";

// Simulation data — used when GitHub API is unavailable or no key yet
const MOCK_REPO_META = {
  full_name: "demo/drips-app",
  description: "Decentralized continuous funding protocol",
  stargazers_count: 142,
  forks_count: 28,
  language: "TypeScript",
};

const MOCK_ISSUES: GitHubIssue[] = [
  {
    id: 1001, number: 12,
    title: "Add wallet disconnect confirmation dialog to prevent accidental sign-out",
    body: "## Overview\nUsers sometimes accidentally click disconnect and lose their session. We need a confirmation dialog before disconnecting.\n\n## Files to update\n- `src/components/WalletMenu.tsx` — add confirmation modal trigger\n- `src/hooks/useWallet.ts` — expose disconnect handler to modal\n\n## Setup\n```bash\nnpm run dev\n# Navigate to wallet menu and click disconnect\n```\n\n## Acceptance criteria\n- [ ] A modal appears before disconnecting\n- [ ] User can cancel and stay connected\n- [ ] Disconnect completes on confirm",
    html_url: "https://github.com/demo/drips-app/issues/12",
    labels: [{ name: "enhancement" }, { name: "ui" }],
    milestone: { title: "Wave 4" },
  },
  {
    id: 1002, number: 17,
    title: "Fix broken drip stream calculation when recipient splits earnings",
    body: "The drip stream amount shown in `src/lib/streams.ts` is incorrect when a recipient has split their earnings across multiple addresses. The displayed total should match the on-chain value. This issue affects users with split configurations set up through the dashboard.",
    html_url: "https://github.com/demo/drips-app/issues/17",
    labels: [{ name: "bug" }, { name: "smart-contract" }],
    milestone: null,
  },
  {
    id: 1003, number: 23,
    title: "Update error messages in the contributor UI",
    body: "The error messages shown to contributors are confusing and don't explain what went wrong. Users are reporting issues in the Discord. We should make them clearer.",
    html_url: "https://github.com/demo/drips-app/issues/23",
    labels: [{ name: "ux" }, { name: "bug" }],
    milestone: null,
  },
  {
    id: 1004, number: 31,
    title: "Implement CSV export for contributor earnings report",
    body: "Team admins should be able to export contributor earnings data as CSV for accounting. The export should include contributor address, total earned, and wave number. This feature is missing from the dashboard.",
    html_url: "https://github.com/demo/drips-app/issues/31",
    labels: [{ name: "feature" }],
    milestone: null,
  },
  {
    id: 1005, number: 38,
    title: "fix bug",
    body: "The app crashes sometimes.",
    html_url: "https://github.com/demo/drips-app/issues/38",
    labels: [],
    milestone: null,
  },
  {
    id: 1006, number: 44,
    title: "Update docs",
    body: "Please update the documentation.",
    html_url: "https://github.com/demo/drips-app/issues/44",
    labels: [{ name: "documentation" }],
    milestone: null,
  },
];

const STATUS_COLORS = { pass: "#16a34a", warn: "#d97706", fail: "#dc2626" };

function gradeStyle(grade: string) {
  if (grade === "A") return "text-[#6366f1] font-bold";
  if (grade === "B") return "text-[#818cf8] font-bold";
  if (grade === "C") return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
}

const FLOW_STEPS = [
  {
    num: "01", title: "Submit a repo", provider: "GitHub",
    desc: "Paste any GitHub repo URL. All open issues are fetched live.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: "02", title: "Score all issues", provider: "Drips Rubric",
    desc: "Each issue is checked against 8 rubric criteria from the Drips Wave spec. Fully deterministic.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#6366f1]">
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: "03", title: "Review and post feedback", provider: "Vera Agent",
    desc: "Vera reviews every issue; identifies gaps, drafts targeted feedback, and posts it directly to GitHub.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-violet-600">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: "04", title: "Issues optimized", provider: "Wave ready",
    desc: "Maintainers' issues are optimized to reduce back and forth between maintainers and contributors when Wave goes live.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-green-600">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [repoMeta, setRepoMeta] = useState<{ full_name: string; description: string; stargazers_count: number; forks_count: number; language: string } | null>(null);
  const [simulated, setSimulated] = useState(false);

  const summary: RepoSummary | null = useMemo(() => {
    if (!issues.length) return null;
    return summarizeRepo(issues);
  }, [issues]);

  async function runReview() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const parsed = parseRepoUrl(trimmed);
    if (!parsed) {
      setError("Could not parse repo URL. Use https://github.com/owner/repo");
      return;
    }
    setLoading(true);
    setError("");
    setIssues([]);
    setRepoMeta(null);
    setSimulated(false);
    try {
      const [meta, allIssues] = await Promise.all([
        fetchRepoMeta(parsed.owner, parsed.repo),
        fetchAllIssues(parsed.owner, parsed.repo),
      ]);
      setRepoMeta(meta);
      setIssues(allIssues.length ? allIssues : MOCK_ISSUES);
      if (!allIssues.length) setSimulated(true);
    } catch {
      // Fall back to simulated data
      await new Promise(r => setTimeout(r, 600));
      setRepoMeta(MOCK_REPO_META);
      setIssues(MOCK_ISSUES);
      setSimulated(true);
    } finally {
      setLoading(false);
    }
  }

  const reviewUrl = `/review?url=${encodeURIComponent(url.trim())}`;

  return (
    <div className="bg-white min-h-screen">

      {/* Hero */}
      <section className={`max-w-2xl mx-auto px-6 text-center transition-all ${summary ? 'pt-12 pb-8' : 'pt-20 pb-12'}`}>
        <div className="inline-flex items-center gap-2 bg-white border border-black text-[#6366f1] text-xs font-semibold px-3 py-1.5 rounded-full mb-6 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
          Drips Wave · Internal tool
        </div>
        <h1 className="text-[2.5rem] font-bold text-[#111827] tracking-tight leading-tight mb-3">
          Optimize maintainers repo<br />issues per Wave batch.
        </h1>
        <p className="text-[#111827] text-base leading-relaxed mb-8 max-w-lg mx-auto">
          Review and score maintainers GitHub issues and provide QA feedback.
        </p>

        {/* Search card */}
        <div className="bg-white rounded-2xl border border-black shadow-sm overflow-hidden text-left">
          <div className="px-6 py-4 flex items-center gap-3">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runReview()}
              placeholder="https://github.com/owner/repo"
              className="flex-1 text-[#111827] text-base bg-transparent outline-none placeholder:text-gray-400 font-medium"
            />
            <button
              onClick={runReview}
              disabled={!url.trim() || loading}
              className="flex-shrink-0 bg-[#6366f1] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4f52cc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Reviewing…" : "Review →"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-500 text-left px-1">{error}</div>
        )}
      </section>

      {/* Loading skeleton */}
      {loading && (
        <div className="max-w-2xl mx-auto px-6 pb-10 space-y-3 animate-pulse">
          <div className="h-20 bg-gray-100 rounded-2xl" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-xl border border-gray-100" />
          ))}
        </div>
      )}

      {/* Inline results */}
      {summary && repoMeta && !loading && (
        <div className="max-w-2xl mx-auto px-6 pb-16 space-y-4">

          {simulated && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
              <span>⚡</span>
              <span>Showing simulated data — connect GitHub API to review real repos.</span>
            </div>
          )}

          {/* Repo summary */}
          <div className="bg-white border border-black rounded-2xl p-5 flex items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#111827]">{repoMeta.full_name}</div>
              <div className="text-gray-600 text-xs mt-0.5 truncate">{repoMeta.description || "No description"}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">★ {repoMeta.stargazers_count}</span>
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">⑂ {repoMeta.forks_count}</span>
                {repoMeta.language && <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">{repoMeta.language}</span>}
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">{issues.length} issues</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-4xl font-black ${gradeStyle(summary.avg >= 80 ? "A" : summary.avg >= 65 ? "B" : summary.avg >= 45 ? "C" : "D")}`}>
                {summary.avg}<span className="text-lg text-gray-300">%</span>
              </div>
              <div className="flex gap-2 mt-1 justify-end text-xs">
                <span className="text-[#6366f1] font-medium">{summary.dist.A}A</span>
                <span className="text-[#818cf8] font-medium">{summary.dist.B}B</span>
                <span className="text-amber-600 font-medium">{summary.dist.C}C</span>
                <span className="text-red-600 font-medium">{summary.dist.D}D</span>
              </div>
            </div>
          </div>

          {/* Issues list */}
          <div className="bg-white border border-black rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid text-xs text-gray-700 px-5 py-2.5 border-b border-gray-100 bg-gray-50"
              style={{ gridTemplateColumns: "40px 1fr 40px 7rem 120px" }}>
              <div>#</div>
              <div>Title</div>
              <div className="text-center">%</div>
              <div>Rubric</div>
              <div />
            </div>

            {summary.scored.map(x => (
              <div
                key={x.issue.id}
                className="grid items-center px-5 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-sm"
                style={{ gridTemplateColumns: "40px 1fr 40px 7rem 120px" }}
              >
                <div className="text-gray-600 text-xs">{x.issue.number}</div>
                <div className="truncate text-xs pr-4">
                  <span className={`font-bold mr-1.5 ${gradeStyle(x.grade)}`}>{x.grade}</span>
                  {x.issue.title}
                </div>
                <div className={`text-xs font-semibold text-center ${gradeStyle(x.grade)}`}>{x.pct}</div>
                <div className="flex gap-1 px-1">
                  {RUBRIC.map(r => (
                    <span
                      key={r.key}
                      title={`${r.label}: ${x.checks[r.key as keyof typeof x.checks].note}`}
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: STATUS_COLORS[x.checks[r.key as keyof typeof x.checks].status] }}
                    />
                  ))}
                </div>
                <div className="text-right">
                  {(x.grade === "C" || x.grade === "D") ? (
                    <Link
                      href={`/review?url=${encodeURIComponent(url.trim())}&issue=${x.issue.number}`}
                      className="text-xs font-medium bg-indigo-50 text-[#6366f1] hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Post feedback →
                    </Link>
                  ) : (
                    <Link
                      href={`/review?url=${encodeURIComponent(url.trim())}&issue=${x.issue.number}`}
                      className="text-xs text-gray-600 hover:text-[#6366f1] transition-colors"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[#111827]">
              {summary.scored.filter(s => s.grade === "C" || s.grade === "D").length} issues need feedback
            </span>
            <Link
              href={reviewUrl}
              className="text-xs font-medium text-[#6366f1] hover:underline"
            >
              Open full review →
            </Link>
          </div>
        </div>
      )}

      {/* How it works — only when no results */}
      {!summary && !loading && (
        <section className="max-w-2xl mx-auto px-6 pb-20">
          <h2 className="text-lg font-semibold text-[#111827] mb-1">How it works</h2>
          <p className="text-[#111827] text-sm mb-5">Four steps from URL to feedback posted.</p>

          <div className="space-y-2">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="bg-white border border-black rounded-2xl px-5 py-4 flex items-start gap-4 transition-colors">
                <div className="text-2xl font-black text-gray-400 w-8 flex-shrink-0 select-none leading-none pt-0.5">{step.num}</div>
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-black/10 flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#111827] text-sm">{step.title}</span>
                    <span className="text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">{step.provider}</span>
                  </div>
                  <p className="text-[#111827] text-xs mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Link href="/guide" className="text-xs text-[#111827] hover:text-[#6366f1] transition-colors border border-black bg-white px-4 py-2 rounded-xl hover:border-[#6366f1]">
              Scoring guide →
            </Link>
            <a href="https://www.drips.network/blog/posts/creating-meaningful-issues" target="_blank" rel="noreferrer"
              className="text-xs text-[#111827] hover:text-[#6366f1] transition-colors border border-black bg-white px-4 py-2 rounded-xl hover:border-[#6366f1]">
              Drips issue guide ↗
            </a>
          </div>
        </section>
      )}

    </div>
  );
}
