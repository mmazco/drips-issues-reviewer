"use client";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { summarizeRepo, RUBRIC } from "@/lib/scoring";
import type { GitHubIssue, ScoredIssue, RepoSummary } from "@/lib/scoring";
import { fetchAllIssues, fetchRepoMeta, parseRepoUrl, postGitHubComment, buildVeraComment, createGitHubIssue } from "@/lib/github";
import { useGitHubAuth } from "@/lib/useGitHubAuth";

const STATUS_COLORS = { pass: "#16a34a", warn: "#d97706", fail: "#dc2626" };

function gradeStyle(grade: string) {
  if (grade === "A") return "text-[#6366f1]";
  if (grade === "B") return "text-[#818cf8]";
  if (grade === "C") return "text-amber-600";
  return "text-red-600";
}

function complexityBadge(c: string) {
  if (c === "Trivial") return "bg-green-50 text-green-700";
  if (c === "Medium") return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

// Drips Wave teams label issues they want included in the Wave with a
// "Stellar Wave" label. We pull all open issues so maintainers can see
// the full picture, but flag the Wave-tagged ones since those are the
// ones Drips actually scores at https://www.drips.network/wave/stellar.
function isWaveTagged(issue: GitHubIssue): boolean {
  return (issue.labels || []).some(l => {
    const name = (typeof l === "string" ? l : l.name).toLowerCase();
    return name === "stellar wave";
  });
}

function saveToHistory(repoUrl: string, repoMeta: { full_name: string; description: string }, summary: RepoSummary) {
  const all = JSON.parse(localStorage.getItem("drips-review-history") || "[]");
  const snapshot = {
    reviewedAt: new Date().toISOString(),
    avg: summary.avg,
    dist: summary.dist,
    totalIssues: summary.scored.length,
    issues: summary.scored.map(s => ({ number: s.issue.number, title: s.issue.title, url: s.issue.html_url, grade: s.grade, pct: s.pct })),
  };
  const existing = all.find((h: { fullName: string }) => h.fullName === repoMeta.full_name);
  if (existing) {
    existing.snapshots = [snapshot, ...(existing.snapshots || [])].slice(0, 10);
    existing.latestAvg = summary.avg;
    existing.latestDist = summary.dist;
  } else {
    all.unshift({ id: Date.now(), repoUrl, fullName: repoMeta.full_name, description: repoMeta.description || "", latestAvg: summary.avg, latestDist: summary.dist, snapshots: [snapshot] });
  }
  localStorage.setItem("drips-review-history", JSON.stringify(all.slice(0, 30)));
}

interface RepoCheckResult {
  mode: "docs" | "setup";
  verdict: "good" | "needs-work" | "broken";
  summary: string;
  findings: string[];
  issue_title: string | null;
  issue_body: string | null;
}

interface VeraReview {
  verdict?: string;
  suggested_complexity?: string;
  complexity_reasoning?: string;
  rewritten_title?: string | null;
  missing?: string[];
  scope_concern?: string | null;
  suggestions?: string;
  comment_draft?: string;
  _simulated?: boolean;
  error?: string;
}

// Build the QA comment textarea contents from a Vera review. Prefers the
// markdown `comment_draft` the agent returns (per the system prompt in
// lib/prompts.ts); falls back to the local template if the model didn't
// include one (e.g. on parse error or rate-limit fallback).
function draftCommentFrom(
  review: VeraReview | undefined,
  issue: GitHubIssue,
  scored: ScoredIssue,
  reviewerUsername?: string | null,
): string {
  if (review?.comment_draft && review.comment_draft.trim()) return review.comment_draft;

  const missing =
    review?.missing && review.missing.length > 0
      ? review.missing
      : Object.entries(scored.checks)
          .filter(([, v]) => v.status === "fail")
          .map(([k]) => {
            const r = RUBRIC.find(r => r.key === k);
            return r ? `Missing ${r.label}` : k;
          });
  const suggestions =
    review?.suggestions || "Add file paths, acceptance criteria, and setup steps per the Drips rubric.";
  const complexity = review?.suggested_complexity || scored.suggestedComplexity;
  return buildVeraComment(issue.title, missing, suggestions, complexity, reviewerUsername ?? undefined);
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const prefilledUrl = searchParams.get("url") || "";
  const prefilledIssue = searchParams.get("issue");
  const { token, isConnected, username, loading: authLoading } = useGitHubAuth();

  const [repoUrl, setRepoUrl] = useState(prefilledUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [repoMeta, setRepoMeta] = useState<{ full_name: string; description: string; stargazers_count: number; forks_count: number; language: string } | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "wave" | "failing" | "passing">("all");
  const [aiReviews, setAiReviews] = useState<Record<number, Record<string, unknown>>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
  const [qaComments, setQaComments] = useState<Record<number, string>>({});
  const [qaPosting, setQaPosting] = useState<Record<number, boolean>>({});
  const [qaPosted, setQaPosted] = useState<Record<number, boolean>>({});
  // Repo-level checks (docs / setup) — keyed by mode since there's a single
  // active repo per page session. Cleared when repoUrl changes via runReview.
  const [repoChecks, setRepoChecks] = useState<Record<"docs" | "setup", RepoCheckResult | undefined>>({ docs: undefined, setup: undefined });
  const [repoCheckLoading, setRepoCheckLoading] = useState<Record<"docs" | "setup", boolean>>({ docs: false, setup: false });
  const [repoCheckBodies, setRepoCheckBodies] = useState<Record<"docs" | "setup", string>>({ docs: "", setup: "" });
  const [repoCheckTitles, setRepoCheckTitles] = useState<Record<"docs" | "setup", string>>({ docs: "", setup: "" });
  const [repoCheckPosting, setRepoCheckPosting] = useState<Record<"docs" | "setup", boolean>>({ docs: false, setup: false });
  const [repoCheckPosted, setRepoCheckPosted] = useState<Record<"docs" | "setup", { number: number; html_url: string } | undefined>>({ docs: undefined, setup: undefined });
  const autoRan = useRef(false);

  const summary = useMemo(() => summarizeRepo(issues), [issues]);
  const visibleIssues = useMemo(() => {
    if (!summary) return [];
    if (filter === "wave") return summary.scored.filter(s => isWaveTagged(s.issue));
    if (filter === "failing") return summary.scored.filter(s => s.grade === "C" || s.grade === "D");
    if (filter === "passing") return summary.scored.filter(s => s.grade === "A" || s.grade === "B");
    return summary.scored;
  }, [summary, filter]);

  const waveTaggedCount = useMemo(
    () => (summary ? summary.scored.filter(s => isWaveTagged(s.issue)).length : 0),
    [summary],
  );

  function toggleExpand(n: number) {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(n)) { next.delete(n); } else { next.add(n); }
      return next;
    });
  }

  async function runReview(urlOverride?: string) {
    const targetUrl = urlOverride ?? repoUrl;
    setError(""); setIssues([]); setAiReviews({}); setExpandedIssues(new Set());
    setRepoChecks({ docs: undefined, setup: undefined });
    setRepoCheckBodies({ docs: "", setup: "" });
    setRepoCheckTitles({ docs: "", setup: "" });
    setRepoCheckPosted({ docs: undefined, setup: undefined });
    const parsed = parseRepoUrl(targetUrl);
    if (!parsed) { setError("Could not parse repo URL. Use https://github.com/owner/repo"); return; }
    setLoading(true);
    try {
      const [meta, allIssues] = await Promise.all([
        fetchRepoMeta(parsed.owner, parsed.repo, token ?? undefined),
        fetchAllIssues(parsed.owner, parsed.repo, token ?? undefined),
      ]);
      setRepoMeta(meta);
      setIssues(allIssues);
      if (allIssues.length > 0) {
        const s = summarizeRepo(allIssues);
        if (s) saveToHistory(targetUrl, meta, s);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (prefilledUrl && !autoRan.current) { autoRan.current = true; runReview(prefilledUrl); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefilledIssue && issues.length > 0) {
      const num = parseInt(prefilledIssue, 10);
      const found = summary?.scored.find(s => s.issue.number === num);
      if (found) {
        setExpandedIssues(prev => new Set([...prev, num]));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, prefilledIssue]);

  function simulatedReview(issue: GitHubIssue, key: number) {
    const scored = summary?.scored.find(s => s.issue.number === key);
    const fails = scored
      ? Object.entries(scored.checks)
          .filter(([, v]) => v.status === "fail")
          .map(([k]) => {
            const r = RUBRIC.find(r => r.key === k);
            return r ? `Add ${r.label.toLowerCase()}` : k;
          })
      : [];
    return {
      verdict: (scored?.pct ?? 0) >= 65 ? "ready" : (scored?.pct ?? 0) >= 45 ? "needs-work" : "reject",
      suggested_complexity: scored?.suggestedComplexity ?? "Medium",
      complexity_reasoning: "Based on title and body length heuristics.",
      rewritten_title: (scored?.pct ?? 0) < 65 ? `[Improved] ${issue.title}` : null,
      missing: fails.length ? fails : ["Looks complete — no major gaps found."],
      scope_concern: null,
      suggestions: fails.length
        ? `1. ${fails[0] ?? "Clarify the problem statement"}. 2. Add file paths pointing to relevant code. 3. Include acceptance criteria as a checklist.`
        : "Issue is well-structured. Consider adding a milestone for Wave tracking.",
      _simulated: true,
    };
  }

  // Apply a review to state: store it, and auto-draft the editable QA
  // comment unless the user has already edited one for this issue.
  function applyReview(issue: GitHubIssue, scored: ScoredIssue, review: VeraReview) {
    const key = issue.number;
    setAiReviews(prev => ({ ...prev, [key]: review as unknown as Record<string, unknown> }));
    setQaComments(prev => (prev[key] ? prev : { ...prev, [key]: draftCommentFrom(review, issue, scored, username) }));
  }

  async function runAIReview(issue: GitHubIssue) {
    const key = issue.number;
    if (aiReviews[key] || aiLoading[key]) return;
    setAiLoading(prev => ({ ...prev, [key]: true }));

    const scored = summary?.scored.find(s => s.issue.number === key);
    if (!scored) {
      setAiLoading(prev => ({ ...prev, [key]: false }));
      return;
    }

    try {
      const res = await fetch("/api/vera/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            html_url: issue.html_url,
            labels: issue.labels,
            milestone: issue.milestone,
          },
          scorecard: {
            pct: scored.pct,
            grade: scored.grade,
            suggestedComplexity: scored.suggestedComplexity,
            checks: scored.checks,
          },
          reviewer: username ? { username } : undefined,
        }),
      });

      if (!res.ok) {
        applyReview(issue, scored, simulatedReview(issue, key));
        return;
      }

      const data = await res.json();
      if (data?.review && !("error" in data.review)) {
        applyReview(issue, scored, data.review as VeraReview);
      } else {
        applyReview(issue, scored, simulatedReview(issue, key));
      }
    } catch {
      applyReview(issue, scored, simulatedReview(issue, key));
    } finally {
      setAiLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  async function submitQAComment(issue: GitHubIssue) {
    setQaPosting(prev => ({ ...prev, [issue.number]: true }));
    if (!token) {
      await new Promise(r => setTimeout(r, 900));
      setQaPosted(prev => ({ ...prev, [issue.number]: true }));
      setQaPosting(prev => ({ ...prev, [issue.number]: false }));
      return;
    }
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return;
    try {
      await postGitHubComment(parsed.owner, parsed.repo, issue.number, qaComments[issue.number], token!);
      setQaPosted(prev => ({ ...prev, [issue.number]: true }));
    } catch (e) {
      alert(`Failed to post: ${(e as Error).message}`);
    } finally {
      setQaPosting(prev => ({ ...prev, [issue.number]: false }));
    }
  }

  async function runRepoCheck(mode: "docs" | "setup") {
    if (repoCheckLoading[mode] || repoChecks[mode]) return;
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return;
    setRepoCheckLoading(prev => ({ ...prev, [mode]: true }));

    try {
      const res = await fetch("/api/vera/repo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: parsed.owner,
          repo: parsed.repo,
          mode,
          reviewer: username ? { username } : undefined,
          githubToken: token || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`${mode} review failed: ${text.slice(0, 200)}`);
        return;
      }

      const data = await res.json();
      if (data?.review) {
        const review = data.review as RepoCheckResult;
        setRepoChecks(prev => ({ ...prev, [mode]: review }));
        if (review.issue_title) setRepoCheckTitles(prev => ({ ...prev, [mode]: review.issue_title || "" }));
        if (review.issue_body) setRepoCheckBodies(prev => ({ ...prev, [mode]: review.issue_body || "" }));
      }
    } catch (e) {
      alert(`${mode} review failed: ${(e as Error).message}`);
    } finally {
      setRepoCheckLoading(prev => ({ ...prev, [mode]: false }));
    }
  }

  async function submitRepoCheckIssue(mode: "docs" | "setup") {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return;
    const title = repoCheckTitles[mode]?.trim();
    const body = repoCheckBodies[mode]?.trim();
    if (!title || !body) return;

    setRepoCheckPosting(prev => ({ ...prev, [mode]: true }));
    if (!token) {
      // Simulated post — same convention as the issue-comment flow.
      await new Promise(r => setTimeout(r, 900));
      setRepoCheckPosted(prev => ({ ...prev, [mode]: { number: 0, html_url: "" } }));
      setRepoCheckPosting(prev => ({ ...prev, [mode]: false }));
      return;
    }

    try {
      const created = await createGitHubIssue(parsed.owner, parsed.repo, title, body, token);
      setRepoCheckPosted(prev => ({ ...prev, [mode]: { number: created.number, html_url: created.html_url } }));
    } catch (e) {
      alert(`Failed to create issue: ${(e as Error).message}`);
    } finally {
      setRepoCheckPosting(prev => ({ ...prev, [mode]: false }));
    }
  }

  function discardRepoCheck(mode: "docs" | "setup") {
    setRepoChecks(prev => ({ ...prev, [mode]: undefined }));
    setRepoCheckBodies(prev => ({ ...prev, [mode]: "" }));
    setRepoCheckTitles(prev => ({ ...prev, [mode]: "" }));
    setRepoCheckPosted(prev => ({ ...prev, [mode]: undefined }));
  }

  return (
    <div className="bg-white min-h-screen">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Review a repository</h1>
        <p className="text-gray-600 text-sm mt-1">Score all open issues against the Drips Wave rubric.</p>
      </div>

      {/* Search */}
      <div className="border border-black rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runReview()}
          placeholder="https://github.com/owner/repo"
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] text-[#111827] placeholder:text-gray-400"
        />
        <div className="flex items-center gap-2">
          {authLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-transparent bg-gray-100 px-3 py-2 rounded-xl select-none animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />checking…
            </span>
          ) : isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />@{username}
            </span>
          ) : (
            <a href="/api/auth/github" className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:border-[#6366f1] hover:text-[#6366f1] transition-colors whitespace-nowrap">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Connect GitHub
            </a>
          )}
          <button
            onClick={() => runReview()}
            disabled={loading || !repoUrl.trim()}
            className="bg-[#6366f1] text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-[#4f52cc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? "Reviewing…" : "Run review"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-20 bg-gray-50 rounded-2xl border border-gray-100" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl border border-gray-100" />)}
        </div>
      )}

      {/* Empty state — no repo loaded yet */}
      {!summary && !repoMeta && !loading && !error && (
        <div className="border border-dashed border-black/20 rounded-2xl p-14 text-center">
          <div className="text-gray-300 text-3xl mb-3">◎</div>
          <div className="text-sm font-medium text-gray-700">Paste a GitHub repo URL above</div>
          <div className="text-xs text-gray-600 mt-1.5">Scoring runs locally — no auth needed to read public repos.</div>
        </div>
      )}

      {/* No-open-issues state — the fetch succeeded but the repo has no
          open issues to score. Common when a maintainer has addressed
          all feedback (e.g. MañanaSeguro). */}
      {!summary && repoMeta && !loading && !error && (
        <div className="border border-black rounded-2xl p-8 text-center space-y-3">
          <div className="text-3xl">✓</div>
          <div className="text-sm font-semibold text-[#111827]">{repoMeta.full_name}</div>
          <div className="text-sm text-gray-700">No open issues to review.</div>
          <div className="text-xs text-gray-600 max-w-md mx-auto">
            All issues on this repo are closed. If the maintainer is mid-Wave, this often means they&rsquo;ve addressed prior feedback and need to open new tasks.
          </div>
          <a
            href={`https://github.com/${repoMeta.full_name}/issues?q=is%3Aissue`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline"
          >
            View all issues on GitHub ↗
          </a>
        </div>
      )}

      {summary && repoMeta && (
        <>
          {/* Repo summary */}
          <div className="border border-black rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[#111827]">{repoMeta.full_name}</div>
                <div className="text-gray-600 text-xs mt-0.5">{repoMeta.description || "No description"}</div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">★ {repoMeta.stargazers_count}</span>
                  <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">⑂ {repoMeta.forks_count}</span>
                  {repoMeta.language && <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{repoMeta.language}</span>}
                  <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{issues.length} issues</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                      waveTaggedCount > 0
                        ? "bg-indigo-50 text-[#6366f1]"
                        : "bg-amber-50 text-amber-700"
                    }`}
                    title={
                      waveTaggedCount > 0
                        ? "Issues tagged for the Stellar Wave by the maintainer"
                        : "No issues tagged 'Stellar Wave' — maintainer needs to add the label"
                    }
                  >
                    {waveTaggedCount > 0
                      ? `${waveTaggedCount} tagged for Wave`
                      : "0 tagged for Wave"}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-4xl font-black ${gradeStyle(summary.avg >= 80 ? "A" : summary.avg >= 65 ? "B" : summary.avg >= 45 ? "C" : "D")}`}>
                  {summary.avg}<span className="text-base text-gray-300 font-normal">%</span>
                </div>
                <div className="flex gap-3 mt-1 justify-end text-xs font-semibold">
                  <span className="text-[#6366f1]">{summary.dist.A} A</span>
                  <span className="text-[#818cf8]">{summary.dist.B} B</span>
                  <span className="text-amber-600">{summary.dist.C} C</span>
                  <span className="text-red-600">{summary.dist.D} D</span>
                </div>
              </div>
            </div>
            {summary.topFails.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                <span className="text-xs text-gray-700 mr-1">Top failures:</span>
                {summary.topFails.map(([key, count]) => {
                  const r = RUBRIC.find(r => r.key === key);
                  return <span key={key} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-md">{r?.label} × {count}</span>;
                })}
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "wave", "failing", "passing"] as const).map(f => {
              const count =
                f === "all" ? summary.scored.length
                : f === "wave" ? waveTaggedCount
                : f === "failing" ? summary.scored.filter(s => s.grade === "C" || s.grade === "D").length
                : summary.scored.filter(s => s.grade === "A" || s.grade === "B").length;
              const label = f === "wave" ? "wave-tagged" : f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === f ? "bg-[#6366f1] text-white font-medium" : "text-gray-500 border border-gray-200 hover:border-[#6366f1] hover:text-[#6366f1]"}`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Issues accordion */}
          <div className="border border-black rounded-2xl overflow-hidden">
            {/* Column header (desktop only — too cramped to fit on mobile) */}
            <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-700">
              <span className="w-6">#</span>
              <span className="flex-1">Title</span>
              <span className="w-8 text-center flex-shrink-0">%</span>
              <span className="w-[7rem] flex-shrink-0">Rubric</span>
              <span className="w-28 text-right flex-shrink-0" />
            </div>

            {visibleIssues.map((x, idx) => {
              const isOpen = expandedIssues.has(x.issue.number);
              const ai = aiReviews[x.issue.number];
              const needsFeedback = x.grade === "C" || x.grade === "D";

              return (
                <div key={x.issue.id} className={idx < visibleIssues.length - 1 ? "border-b border-gray-100" : ""}>
                  {/* Row — single line on desktop, title row + meta row on mobile */}
                  <button
                    onClick={() => toggleExpand(x.issue.number)}
                    className="w-full px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs text-gray-700 w-6 flex-shrink-0">{x.issue.number}</span>
                      <span className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
                        <span className={`text-xs font-bold flex-shrink-0 ${gradeStyle(x.grade)}`}>{x.grade}</span>
                        <span className="text-sm text-[#111827] truncate">{x.issue.title}</span>
                        {isWaveTagged(x.issue) && (
                          <span
                            className="hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-[#6366f1] flex-shrink-0"
                            title="Tagged for the Stellar Wave by the maintainer"
                          >
                            Stellar Wave
                          </span>
                        )}
                      </span>
                      {/* Hidden on mobile — moved to the meta row below to avoid crushing the title */}
                      <span className={`hidden sm:inline-block text-xs font-semibold w-8 text-center flex-shrink-0 ${gradeStyle(x.grade)}`}>{x.pct}</span>
                      <span className="hidden sm:flex gap-0.5 flex-shrink-0 w-[7rem]">
                        {RUBRIC.map(r => (
                          <span
                            key={r.key}
                            title={`${r.label}: ${x.checks[r.key as keyof typeof x.checks].note}`}
                            className="w-3 h-3 rounded-full"
                            style={{ background: STATUS_COLORS[x.checks[r.key as keyof typeof x.checks].status] }}
                          />
                        ))}
                      </span>
                      <span className="w-auto sm:w-28 text-right flex-shrink-0">
                        {needsFeedback ? (
                          <span className={`text-xs font-medium px-2 sm:px-2.5 py-1 rounded-lg whitespace-nowrap ${qaPosted[x.issue.number] ? "bg-green-50 text-green-700" : "text-[#6366f1]"}`}>
                            {qaPosted[x.issue.number] ? "✓ sent" : <><span className="hidden sm:inline">Post feedback</span><span className="sm:hidden">Review</span></>}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">{isOpen ? "↑" : "↓"}</span>
                        )}
                      </span>
                    </div>
                    {/* Mobile-only meta row: % + rubric dots + Stellar Wave pill */}
                    <div className="flex sm:hidden items-center gap-2 mt-1.5 pl-8">
                      <span className={`text-xs font-semibold ${gradeStyle(x.grade)}`}>{x.pct}%</span>
                      <span className="flex gap-1">
                        {RUBRIC.map(r => (
                          <span
                            key={r.key}
                            title={`${r.label}: ${x.checks[r.key as keyof typeof x.checks].note}`}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: STATUS_COLORS[x.checks[r.key as keyof typeof x.checks].status] }}
                          />
                        ))}
                      </span>
                      {isWaveTagged(x.issue) && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-[#6366f1]">
                          Stellar Wave
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 sm:px-5 py-4 sm:py-5 space-y-5 sm:space-y-6">

                      {/* Issue meta + GitHub link */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${gradeStyle(x.grade)}`}>{x.grade} · {x.pct}%</span>
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${complexityBadge(x.suggestedComplexity)}`}>{x.suggestedComplexity}</span>
                        </div>
                        <a href={x.issue.html_url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-[#6366f1] transition-colors">
                          GitHub ↗
                        </a>
                      </div>

                      {/* Rubric breakdown */}
                      <div>
                        <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-2">Rubric breakdown</div>
                        <div className="bg-white border border-black rounded-xl overflow-hidden">
                          {RUBRIC.map((r, i) => {
                            const c = x.checks[r.key as keyof typeof x.checks];
                            return (
                              <div key={r.key} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i < RUBRIC.length - 1 ? "border-b border-gray-100" : ""}`}>
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[c.status] }} />
                                <span className="text-gray-800 text-xs w-24 flex-shrink-0">{r.label}</span>
                                <span className="text-xs text-gray-600 flex-1">{c.note}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 1. Pre-review: prominent CTA. Post-review: review card + re-run. */}
                      {!ai && !aiLoading[x.issue.number] && (
                        <button
                          onClick={() => runAIReview(x.issue)}
                          className="w-full py-3.5 text-sm font-semibold bg-[#6366f1] text-white rounded-xl hover:bg-[#4f52cc] transition-colors"
                        >
                          Run review with Vera
                        </button>
                      )}

                      {aiLoading[x.issue.number] && (
                        <div>
                          <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-2">Review with Vera</div>
                          <div className="text-xs text-gray-400 animate-pulse bg-white border border-gray-100 rounded-xl px-4 py-3">Vera is reviewing…</div>
                        </div>
                      )}

                      {ai && !aiLoading[x.issue.number] && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">
                              Review with Vera
                              {(ai as { _simulated?: boolean })?._simulated && <span className="ml-1.5 text-amber-500 normal-case">⚡ simulated</span>}
                            </div>
                            <button
                              onClick={() => {
                                const key = x.issue.number;
                                setAiReviews(prev => { const n = { ...prev }; delete n[key]; return n; });
                                runAIReview(x.issue);
                              }}
                              className="text-xs text-gray-400 hover:text-[#6366f1] transition-colors"
                            >
                              ↻ Re-run
                            </button>
                          </div>

                          {!(ai as { error?: string }).error && (() => {
                            const r = ai as { verdict: string; suggested_complexity: string; complexity_reasoning?: string; rewritten_title?: string; missing?: string[]; scope_concern?: string; suggestions?: string };
                            return (
                              <div className="bg-white border border-black rounded-xl p-4 space-y-3 text-sm">
                                <div className="flex gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${r.verdict === "ready" ? "bg-green-50 text-green-700" : r.verdict === "needs-work" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>{r.verdict}</span>
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${complexityBadge(r.suggested_complexity)}`}>{r.suggested_complexity}</span>
                                </div>
                                {r.complexity_reasoning && <p className="text-xs text-[#111827]">{r.complexity_reasoning}</p>}
                                {r.rewritten_title && (
                                  <div className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">Suggested title: &ldquo;{r.rewritten_title}&rdquo;</div>
                                )}
                                {r.missing && r.missing.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1 font-medium">Missing</div>
                                    <ul className="text-xs text-gray-800 space-y-0.5 list-disc list-inside">{r.missing.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
                                  </div>
                                )}
                                {r.scope_concern && <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2"><strong>Scope:</strong> {r.scope_concern}</div>}
                                {r.suggestions && (
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1 font-medium">Suggestions</div>
                                    <div className="text-xs text-gray-600 whitespace-pre-wrap">{r.suggestions}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {(ai as { error?: string })?.error && (
                            <div className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">Error: {(ai as { error: string }).error}</div>
                          )}
                        </div>
                      )}

                      {/* 2. QA comment — auto-drafted from review, editable, posts to GitHub */}
                      {(qaComments[x.issue.number] || qaPosted[x.issue.number]) && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">Comment for GitHub</div>
                            <div className="flex items-center gap-3">
                              {qaPosted[x.issue.number] && <span className="text-xs text-green-600 font-medium">✓ Posted</span>}
                              {!qaPosted[x.issue.number] && ai && (
                                <button
                                  onClick={() => {
                                    const scoredNow = summary?.scored.find(s => s.issue.number === x.issue.number);
                                    if (!scoredNow) return;
                                    const review = aiReviews[x.issue.number] as VeraReview | undefined;
                                    setQaComments(prev => ({ ...prev, [x.issue.number]: draftCommentFrom(review, x.issue, scoredNow, username) }));
                                  }}
                                  className="text-xs text-gray-400 hover:text-[#6366f1] transition-colors"
                                  title="Restore Vera's original draft (discards your edits)"
                                >
                                  ↻ reset from review
                                </button>
                              )}
                            </div>
                          </div>
                          {qaPosted[x.issue.number] ? (
                            <div className="bg-white border border-black rounded-xl px-4 py-3 text-xs font-mono text-[#111827] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{qaComments[x.issue.number]}</div>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={qaComments[x.issue.number] || ""}
                                onChange={e => setQaComments(prev => ({ ...prev, [x.issue.number]: e.target.value }))}
                                rows={10}
                                className="w-full bg-white border border-black rounded-xl px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-[#6366f1] resize-y"
                              />
                              {!isConnected && <div className="text-xs text-gray-600">⚡ Simulated — <a href="/api/auth/github" className="text-[#6366f1] hover:underline">connect GitHub</a> to post for real</div>}
                              <div className="flex items-center gap-2 justify-end flex-wrap">
                                <button onClick={() => setQaComments(prev => { const n = { ...prev }; delete n[x.issue.number]; return n; })} className="text-xs text-[#111827] hover:text-red-500 transition-colors">Discard</button>
                                <button
                                  onClick={() => submitQAComment(x.issue)}
                                  disabled={qaPosting[x.issue.number] || !qaComments[x.issue.number]?.trim()}
                                  className="text-xs font-semibold bg-[#6366f1] text-white px-4 py-2 rounded-lg hover:bg-[#4f52cc] disabled:opacity-50 transition-colors"
                                >
                                  {qaPosting[x.issue.number] ? "Posting…" : isConnected ? "Post to GitHub" : "Simulate post ⚡"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. More checks — repo-level docs / setup reviews. Each one
                          opens a NEW issue on the repo (not a comment on this issue).
                          Lives under each issue panel for momentum: "while you're here,
                          want to also flag the repo's docs?" */}
                      {ai && (
                        <div>
                          <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-2">More checks</div>
                          <div className="flex gap-2 flex-wrap">
                            {(["docs", "setup"] as const).map(mode => {
                              const result = repoChecks[mode];
                              const loading = repoCheckLoading[mode];
                              const label = mode === "docs" ? "Review docs" : "Check setup";
                              return (
                                <button
                                  key={mode}
                                  onClick={() => runRepoCheck(mode)}
                                  disabled={loading || !!result}
                                  className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 hover:border-[#6366f1] hover:text-[#6366f1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[#111827] bg-white"
                                >
                                  {loading ? `${label}…` : label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Result cards — one per mode, only for the active issue
                              panel. Repo-level data so all panels see the same result. */}
                          {(["docs", "setup"] as const).map(mode => {
                            const result = repoChecks[mode];
                            if (!result) return null;
                            const posted = repoCheckPosted[mode];
                            const verdictColor =
                              result.verdict === "good" ? "bg-green-50 text-green-700"
                              : result.verdict === "needs-work" ? "bg-yellow-50 text-yellow-700"
                              : "bg-red-50 text-red-700";
                            const modeLabel = mode === "docs" ? "Documentation review" : "Setup review";

                            return (
                              <div key={mode} className="mt-3 bg-white border border-black rounded-xl p-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">{modeLabel}</div>
                                  <button onClick={() => discardRepoCheck(mode)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Dismiss</button>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${verdictColor}`}>{result.verdict}</span>
                                </div>
                                <p className="text-xs text-[#111827]">{result.summary}</p>
                                {result.findings.length > 0 && (
                                  <div>
                                    <div className="text-xs text-gray-600 mb-1 font-medium">Findings</div>
                                    <ul className="text-xs text-gray-800 space-y-0.5 list-disc list-inside">
                                      {result.findings.map((f, i) => <li key={i}>{f}</li>)}
                                    </ul>
                                  </div>
                                )}

                                {/* Issue draft — editable title + body, only when there's something to post */}
                                {result.verdict !== "good" && (result.issue_title || result.issue_body) && (
                                  <div className="space-y-2 pt-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs text-gray-600 font-medium">Open as new issue</div>
                                      {posted && (
                                        posted.html_url
                                          ? <a href={posted.html_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 font-medium hover:underline">✓ Created — issue #{posted.number} ↗</a>
                                          : <span className="text-xs text-green-600 font-medium">✓ Simulated</span>
                                      )}
                                    </div>
                                    {posted ? (
                                      <>
                                        <div className="text-xs text-gray-600 italic">{repoCheckTitles[mode]}</div>
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-mono text-[#111827] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{repoCheckBodies[mode]}</div>
                                      </>
                                    ) : (
                                      <>
                                        <input
                                          value={repoCheckTitles[mode]}
                                          onChange={e => setRepoCheckTitles(prev => ({ ...prev, [mode]: e.target.value }))}
                                          placeholder="Issue title"
                                          className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
                                        />
                                        <textarea
                                          value={repoCheckBodies[mode]}
                                          onChange={e => setRepoCheckBodies(prev => ({ ...prev, [mode]: e.target.value }))}
                                          rows={8}
                                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-[#6366f1] resize-y"
                                        />
                                        {!isConnected && <div className="text-xs text-gray-600">⚡ Simulated — <a href="/api/auth/github" className="text-[#6366f1] hover:underline">connect GitHub</a> to open for real</div>}
                                        <div className="flex items-center gap-2 justify-end flex-wrap">
                                          <button
                                            onClick={() => submitRepoCheckIssue(mode)}
                                            disabled={repoCheckPosting[mode] || !repoCheckTitles[mode]?.trim() || !repoCheckBodies[mode]?.trim()}
                                            className="text-xs font-semibold bg-[#6366f1] text-white px-4 py-2 rounded-lg hover:bg-[#4f52cc] disabled:opacity-50 transition-colors"
                                          >
                                            {repoCheckPosting[mode] ? "Opening…" : isConnected ? "Open issue on GitHub" : "Simulate open ⚡"}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-6 py-10 text-[#111827] text-sm">Loading…</div>}>
      <ReviewContent />
    </Suspense>
  );
}
