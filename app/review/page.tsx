"use client";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { summarizeRepo, RUBRIC } from "@/lib/scoring";
import type { GitHubIssue, ScoredIssue, RepoSummary } from "@/lib/scoring";
import { fetchAllIssues, fetchRepoMeta, parseRepoUrl, postGitHubComment, buildVeraComment } from "@/lib/github";
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

interface VeraMessage {
  role: "user" | "vera";
  text: string;
  commentDraft?: string;
}

function getFailAdvice(label: string): string {
  const m: Record<string, string> = {
    Title: "Use 5+ words describing the specific change needed",
    Context: "Expand the body to 200+ characters explaining the why",
    "File Paths": "Reference at least 2 specific files in the codebase",
    Scope: "Reduce to a single focus area",
    "Setup Steps": "Add a code block with setup or repro commands",
    Acceptance: "Add a checklist of what a successful PR must include",
    Labels: "Apply at least 2 labels",
    Milestone: "Attach to a Wave milestone",
  };
  return m[label] || "Add more detail";
}

function generateVeraResponse(message: string, scored: ScoredIssue): { text: string; commentDraft?: string } {
  const fails = Object.entries(scored.checks).filter(([, v]) => v.status === "fail");
  const failLabels = fails.map(([k]) => RUBRIC.find(r => r.key === k)?.label || k);
  const lower = message.toLowerCase();

  if (/write|draft|comment|feedback|post/.test(lower)) {
    const missing = failLabels.length ? failLabels.map(l => `Missing ${l}`) : ["No critical gaps — issue looks well-structured"];
    const suggestions = failLabels.length
      ? `1. ${getFailAdvice(failLabels[0] ?? "Title")}. 2. Add file paths to guide contributors. 3. Include acceptance criteria as a checklist.`
      : "Consider adding a milestone and more specific acceptance criteria for contributors.";
    const draft = buildVeraComment(scored.issue.title, missing, suggestions, scored.suggestedComplexity);
    return { text: `Here's a draft QA comment for issue #${scored.issue.number}. Click "Use as feedback" to load it into the composer.`, commentDraft: draft };
  }

  if (/miss|wrong|what|problem|fail|gap/.test(lower)) {
    if (!failLabels.length) return { text: `Issue #${scored.issue.number} passes all rubric checks at ${scored.pct}% (grade ${scored.grade}). No critical gaps — it's Wave-ready.` };
    const lines = failLabels.map(l => `• **${l}**: ${getFailAdvice(l)}`).join("\n");
    return { text: `Issue #${scored.issue.number} scored ${scored.pct}% (grade ${scored.grade}). What's missing:\n\n${lines}\n\nType "write feedback" to draft a comment.` };
  }

  if (/complex|tier|point|bounty/.test(lower)) {
    const pts = scored.suggestedComplexity === "Trivial" ? 100 : scored.suggestedComplexity === "Medium" ? 150 : 200;
    return { text: `Suggested tier: **${scored.suggestedComplexity}** (${pts} pts). Based on title keywords and body length. Maintainers set the final tier in the Drips dashboard.` };
  }

  if (/grade|score|rating/.test(lower)) {
    return { text: `Issue #${scored.issue.number} scored **${scored.pct}%** — grade **${scored.grade}**. ${scored.grade === "A" || scored.grade === "B" ? "Looking good for the Wave." : "Needs some work before contributors can pick it up confidently."}` };
  }

  if (failLabels.length) {
    return { text: `Issue #${scored.issue.number} scored ${scored.pct}% (${scored.grade}). Main gaps: ${failLabels.join(", ")}. Type "write feedback" to draft a QA comment, or ask me what's missing for detail.` };
  }
  return { text: `Issue #${scored.issue.number} looks solid at ${scored.pct}% (${scored.grade}). No major gaps. Ready for Wave contributors.` };
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const prefilledUrl = searchParams.get("url") || "";
  const prefilledIssue = searchParams.get("issue");
  const { token, isConnected, username } = useGitHubAuth();

  const [repoUrl, setRepoUrl] = useState(prefilledUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [repoMeta, setRepoMeta] = useState<{ full_name: string; description: string; stargazers_count: number; forks_count: number; language: string } | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "failing" | "passing">("all");
  const [aiReviews, setAiReviews] = useState<Record<number, Record<string, unknown>>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});
  const [qaComments, setQaComments] = useState<Record<number, string>>({});
  const [qaPosting, setQaPosting] = useState<Record<number, boolean>>({});
  const [qaPosted, setQaPosted] = useState<Record<number, boolean>>({});
  const [veraChats, setVeraChats] = useState<Record<number, VeraMessage[]>>({});
  const [veraInput, setVeraInput] = useState<Record<number, string>>({});
  const [veraSending, setVeraSending] = useState<Record<number, boolean>>({});
  const autoRan = useRef(false);

  const summary = useMemo(() => summarizeRepo(issues), [issues]);
  const visibleIssues = useMemo(() => {
    if (!summary) return [];
    if (filter === "failing") return summary.scored.filter(s => s.grade === "C" || s.grade === "D");
    if (filter === "passing") return summary.scored.filter(s => s.grade === "A" || s.grade === "B");
    return summary.scored;
  }, [summary, filter]);

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
        prepareQAComment(found.issue, found);
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

  async function runAIReview(issue: GitHubIssue) {
    const key = issue.number;
    if (aiReviews[key] || aiLoading[key]) return;
    setAiLoading(prev => ({ ...prev, [key]: true }));

    const scored = summary?.scored.find(s => s.issue.number === key);
    if (!scored) {
      setAiReviews(prev => ({ ...prev, [key]: simulatedReview(issue, key) }));
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
        }),
      });

      if (!res.ok) {
        // Vera unreachable or returned an error — fall back to the deterministic
        // rubric-based review so the UI still produces useful output.
        setAiReviews(prev => ({ ...prev, [key]: simulatedReview(issue, key) }));
        return;
      }

      const data = await res.json();
      if (data?.review && !("error" in data.review)) {
        setAiReviews(prev => ({ ...prev, [key]: data.review }));
      } else {
        setAiReviews(prev => ({ ...prev, [key]: simulatedReview(issue, key) }));
      }
    } catch {
      setAiReviews(prev => ({ ...prev, [key]: simulatedReview(issue, key) }));
    } finally {
      setAiLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  function prepareQAComment(issue: GitHubIssue, scored: ScoredIssue) {
    if (qaComments[issue.number]) return;
    const ai = aiReviews[issue.number] as { missing?: string[]; suggestions?: string; suggested_complexity?: string } | undefined;
    const missing = ai?.missing || Object.entries(scored.checks).filter(([, v]) => v.status === "fail").map(([k]) => { const r = RUBRIC.find(r => r.key === k); return r ? `Missing ${r.label}` : k; });
    const suggestions = ai?.suggestions || "Add file paths, acceptance criteria, and setup steps per the Drips rubric.";
    const complexity = ai?.suggested_complexity || scored.suggestedComplexity;
    setQaComments(prev => ({ ...prev, [issue.number]: buildVeraComment(issue.title, missing as string[], suggestions as string, complexity as string) }));
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

  async function sendToVera(issue: GitHubIssue, scored: ScoredIssue) {
    const n = issue.number;
    const msg = (veraInput[n] || "").trim();
    if (!msg) return;
    const userMsg: VeraMessage = { role: "user", text: msg };
    setVeraChats(prev => ({ ...prev, [n]: [...(prev[n] || []), userMsg] }));
    setVeraInput(prev => ({ ...prev, [n]: "" }));
    setVeraSending(prev => ({ ...prev, [n]: true }));
    await new Promise(r => setTimeout(r, 800));
    const response = generateVeraResponse(msg, scored);
    const veraMsg: VeraMessage = { role: "vera", text: response.text, commentDraft: response.commentDraft };
    setVeraChats(prev => ({ ...prev, [n]: [...(prev[n] || []), veraMsg] }));
    setVeraSending(prev => ({ ...prev, [n]: false }));
  }

  return (
    <div className="bg-white min-h-screen">
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Review a repository</h1>
        <p className="text-gray-600 text-sm mt-1">Score all open issues against the Drips Wave rubric.</p>
      </div>

      {/* Search */}
      <div className="border border-black rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <input
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runReview()}
          placeholder="https://github.com/owner/repo"
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] text-[#111827] placeholder:text-gray-400"
        />
        <div className="flex items-center gap-2">
          {isConnected ? (
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

      {/* Empty state */}
      {!summary && !loading && !error && (
        <div className="border border-dashed border-black/20 rounded-2xl p-14 text-center">
          <div className="text-gray-300 text-3xl mb-3">◎</div>
          <div className="text-sm font-medium text-gray-700">Paste a GitHub repo URL above</div>
          <div className="text-xs text-gray-600 mt-1.5">Scoring runs locally — no auth needed to read public repos.</div>
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
          <div className="flex items-center gap-1.5">
            {(["all", "failing", "passing"] as const).map(f => {
              const count = f === "all" ? summary.scored.length : f === "failing" ? summary.scored.filter(s => s.grade === "C" || s.grade === "D").length : summary.scored.filter(s => s.grade === "A" || s.grade === "B").length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${filter === f ? "bg-[#6366f1] text-white font-medium" : "text-gray-500 border border-gray-200 hover:border-[#6366f1] hover:text-[#6366f1]"}`}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>

          {/* Issues accordion */}
          <div className="border border-black rounded-2xl overflow-hidden">
            {/* Column header */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-700">
              <span className="w-6">#</span>
              <span className="flex-1">Title</span>
              <span className="w-8 text-center flex-shrink-0">%</span>
              <span className="w-[7rem] flex-shrink-0">Rubric</span>
              <span className="w-28 text-right flex-shrink-0" />
            </div>

            {visibleIssues.map((x, idx) => {
              const isOpen = expandedIssues.has(x.issue.number);
              const chat = veraChats[x.issue.number] || [];
              const ai = aiReviews[x.issue.number];
              const needsFeedback = x.grade === "C" || x.grade === "D";

              return (
                <div key={x.issue.id} className={idx < visibleIssues.length - 1 ? "border-b border-gray-100" : ""}>
                  {/* Row */}
                  <button
                    onClick={() => toggleExpand(x.issue.number)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xs text-gray-700 w-6 flex-shrink-0">{x.issue.number}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={`text-xs font-bold flex-shrink-0 ${gradeStyle(x.grade)}`}>{x.grade}</span>
                      <span className="text-sm text-[#111827] truncate">{x.issue.title}</span>
                    </span>
                    <span className={`text-xs font-semibold w-8 text-center flex-shrink-0 ${gradeStyle(x.grade)}`}>{x.pct}</span>
                    <span className="flex gap-0.5 flex-shrink-0 w-[7rem]">
                      {RUBRIC.map(r => (
                        <span
                          key={r.key}
                          title={`${r.label}: ${x.checks[r.key as keyof typeof x.checks].note}`}
                          className="w-3 h-3 rounded-full"
                          style={{ background: STATUS_COLORS[x.checks[r.key as keyof typeof x.checks].status] }}
                        />
                      ))}
                    </span>
                    <span className="w-28 text-right flex-shrink-0">
                      {needsFeedback ? (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap ${qaPosted[x.issue.number] ? "bg-green-50 text-green-700" : "text-[#6366f1]"}`}>
                          {qaPosted[x.issue.number] ? "✓ sent" : "Post feedback"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">{isOpen ? "↑" : "↓"}</span>
                      )}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-6">

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

                      {/* Vera chat */}
                      <div>
                        <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide mb-3">QA chat with Vera</div>
                        <div className="bg-white border border-black rounded-xl overflow-hidden">
                          <div className="px-4 py-3 space-y-3 min-h-[80px] max-h-64 overflow-y-auto">
                            {chat.length === 0 && (
                              <div className="text-xs text-gray-700 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
                                👋 Hi, I'm Vera. Ask me what's missing, or say <span className="font-medium text-gray-500">"write feedback"</span> to draft a QA comment for this issue.
                              </div>
                            )}
                            {chat.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`text-xs px-3 py-2 rounded-xl max-w-[85%] leading-relaxed ${msg.role === "user" ? "bg-[#6366f1] text-white" : "bg-gray-100 text-gray-700"}`}>
                                  <div className="whitespace-pre-wrap">{msg.text}</div>
                                  {msg.commentDraft && (
                                    <button
                                      onClick={() => { setQaComments(prev => ({ ...prev, [x.issue.number]: msg.commentDraft! })); }}
                                      className="mt-2 text-xs font-semibold bg-white text-[#6366f1] px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors block w-full text-left"
                                    >
                                      Use as feedback →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {veraSending[x.issue.number] && (
                              <div className="flex justify-start">
                                <div className="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-xl animate-pulse">Vera is typing…</div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
                            <input
                              value={veraInput[x.issue.number] || ""}
                              onChange={e => setVeraInput(prev => ({ ...prev, [x.issue.number]: e.target.value }))}
                              onKeyDown={e => e.key === "Enter" && sendToVera(x.issue, x)}
                              placeholder="Ask Vera about this issue…"
                              className="flex-1 text-xs bg-transparent outline-none text-[#111827] placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => sendToVera(x.issue, x)}
                              disabled={!veraInput[x.issue.number]?.trim() || veraSending[x.issue.number]}
                              className="text-xs font-semibold text-[#6366f1] hover:text-[#4f52cc] disabled:opacity-30 transition-colors px-1"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* QA comment composer */}
                      {(qaComments[x.issue.number] || qaPosted[x.issue.number]) && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">QA comment</div>
                            {qaPosted[x.issue.number] && <span className="text-xs text-green-600 font-medium">✓ Posted</span>}
                          </div>
                          {qaPosted[x.issue.number] ? (
                            <div className="bg-white border border-black rounded-xl px-4 py-3 text-xs font-mono text-[#111827] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{qaComments[x.issue.number]}</div>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={qaComments[x.issue.number] || ""}
                                onChange={e => setQaComments(prev => ({ ...prev, [x.issue.number]: e.target.value }))}
                                rows={7}
                                className="w-full bg-white border border-black rounded-xl px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-[#6366f1] resize-none"
                              />
                              <div className="flex items-center gap-2">
                                {!isConnected && <span className="text-xs text-gray-600 flex-1">⚡ Simulated — <a href="/api/auth/github" className="text-[#6366f1] hover:underline">connect GitHub</a> to post for real</span>}
                                <button onClick={() => setQaComments(prev => { const n = { ...prev }; delete n[x.issue.number]; return n; })} className="text-xs text-[#111827] hover:text-red-500 transition-colors ml-auto">Discard</button>
                                <button
                                  onClick={() => submitQAComment(x.issue)}
                                  disabled={qaPosting[x.issue.number]}
                                  className="text-xs font-semibold bg-[#6366f1] text-white px-4 py-2 rounded-lg hover:bg-[#4f52cc] disabled:opacity-50 transition-colors"
                                >
                                  {qaPosting[x.issue.number] ? "Posting…" : isConnected ? "Post to GitHub" : "Simulate post ⚡"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Draft QA comment CTA (if no draft yet) */}
                      {needsFeedback && !qaComments[x.issue.number] && !qaPosted[x.issue.number] && (
                        <button
                          onClick={() => prepareQAComment(x.issue, x)}
                          className="w-full py-2 text-sm font-semibold bg-[#6366f1] text-white rounded-xl hover:bg-[#4f52cc] transition-colors"
                        >
                          Draft QA comment
                        </button>
                      )}

                      {/* AI deep review */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">
                            Vera Deep Review
                            {(ai as { _simulated?: boolean })?._simulated && <span className="ml-1.5 text-amber-500 normal-case">⚡ simulated</span>}
                          </div>
                          {!ai && !aiLoading[x.issue.number] && (
                            <button onClick={() => runAIReview(x.issue)} className="text-xs font-semibold text-[#6366f1] hover:text-[#4f52cc] transition-colors">
                              Run AI review
                            </button>
                          )}
                        </div>

                        {aiLoading[x.issue.number] && (
                          <div className="text-xs text-gray-400 animate-pulse bg-white border border-gray-100 rounded-xl px-4 py-3">Claude Opus 4.7 is reviewing…</div>
                        )}

                        {ai && !(ai as { error?: string }).error && (() => {
                          const r = ai as { verdict: string; suggested_complexity: string; complexity_reasoning?: string; rewritten_title?: string; missing?: string[]; scope_concern?: string; suggestions?: string };
                          return (
                            <div className="bg-white border border-black rounded-xl p-4 space-y-3 text-sm">
                              <div className="flex gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${r.verdict === "ready" ? "bg-green-50 text-green-700" : r.verdict === "needs-work" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>{r.verdict}</span>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${complexityBadge(r.suggested_complexity)}`}>{r.suggested_complexity}</span>
                              </div>
                              {r.complexity_reasoning && <p className="text-xs text-[#111827]">{r.complexity_reasoning}</p>}
                              {r.rewritten_title && (
                                <div className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">Suggested title: "{r.rewritten_title}"</div>
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
