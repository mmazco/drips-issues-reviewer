"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface IssueSnapshot {
  number: number;
  title: string;
  url: string;
  grade: string;
  pct: number;
}

interface Snapshot {
  reviewedAt: string;
  avg: number;
  dist: Record<string, number>;
  totalIssues: number;
  issues: IssueSnapshot[];
}

interface HistoryEntry {
  id: number;
  repoUrl: string;
  fullName: string;
  description: string;
  latestAvg: number;
  latestDist: Record<string, number>;
  snapshots: Snapshot[];
}

function gradeStyle(grade: string) {
  if (grade === 'A') return 'text-[#6366f1] font-bold';
  if (grade === 'B') return 'text-[#818cf8] font-bold';
  if (grade === 'C') return 'text-amber-600 font-bold';
  return 'text-red-600 font-bold';
}

function overallGrade(avg: number) {
  if (avg >= 80) return 'A';
  if (avg >= 65) return 'B';
  if (avg >= 45) return 'C';
  return 'D';
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-gray-400">no change</span>;
  const up = delta > 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)}%
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function IssueProgressRow({ issue, prev }: { issue: IssueSnapshot; prev?: IssueSnapshot }) {
  const delta = prev ? issue.pct - prev.pct : 0;
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className={`text-xs font-bold w-6 text-center ${gradeStyle(issue.grade)}`}>{issue.grade}</span>
      <a href={issue.url} target="_blank" rel="noreferrer" className="text-xs text-[#6366f1] hover:underline truncate flex-1">
        #{issue.number} {issue.title}
      </a>
      <span className="text-xs text-gray-700 w-8 text-right">{issue.pct}%</span>
      {prev && <DeltaBadge delta={delta} />}
    </div>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [activeSnapshot, setActiveSnapshot] = useState<Record<number, number>>({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('drips-review-history') || '[]');
    setHistory(stored);
  }, []);

  function clearHistory() {
    if (confirm('Clear all review history?')) {
      localStorage.removeItem('drips-review-history');
      setHistory([]);
    }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="bg-white min-h-screen">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Review history</h1>
          <p className="text-gray-700 text-sm mt-1">Track issue quality improvements over time.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors border border-black px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          >
            Clear history
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-dashed border-black/30 rounded-2xl p-16 text-center text-gray-400 space-y-3">
          <div className="text-3xl">🕐</div>
          <div className="font-medium text-gray-500">No reviews yet</div>
          <div className="text-sm">Run a review on the <Link href="/review" className="text-[#6366f1] hover:underline">Review page</Link> and it will appear here.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map(entry => {
            const snapshots = entry.snapshots || [];
            const latest = snapshots[0];
            const oldest = snapshots[snapshots.length - 1];
            const hasProgression = snapshots.length > 1;
            const overallDelta = hasProgression ? latest.avg - oldest.avg : 0;
            const grade = overallGrade(entry.latestAvg);
            const isExpanded = expanded[entry.id];
            const snapshotIdx = activeSnapshot[entry.id] ?? 0;
            const activeSnap = snapshots[snapshotIdx];
            const prevSnap = snapshots[snapshotIdx + 1];

            return (
              <div key={entry.id} className="bg-white border border-black rounded-2xl overflow-hidden transition-colors">
                {/* Repo header */}
                <div className="px-4 sm:px-5 py-4 flex items-start gap-3 sm:gap-4">
                  <div className={`text-3xl font-black w-10 sm:w-12 text-center flex-shrink-0 pt-0.5 ${gradeStyle(grade)}`}>{grade}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#111827] text-sm sm:text-base break-words">{entry.fullName}</span>
                      {hasProgression && <DeltaBadge delta={overallDelta} />}
                    </div>
                    <div className="text-gray-600 text-xs mt-0.5 truncate">{entry.description || 'No description'}</div>
                    <div className="flex gap-2 sm:gap-3 mt-1.5 text-xs text-gray-700 flex-wrap">
                      <span>{entry.latestAvg}% avg</span>
                      <span className="text-[#6366f1]">{entry.latestDist?.A || 0} A</span>
                      <span className="text-[#818cf8]">{entry.latestDist?.B || 0} B</span>
                      <span className="text-amber-600">{entry.latestDist?.C || 0} C</span>
                      <span className="text-red-600">{entry.latestDist?.D || 0} D</span>
                      <span className="hidden sm:inline">·</span>
                      <span>{snapshots.length} review{snapshots.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <Link
                      href={`/review?url=${encodeURIComponent(entry.repoUrl)}`}
                      className="text-xs font-medium text-[#6366f1] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Re-review →
                    </Link>
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                    >
                      {isExpanded ? 'Hide ↑' : 'Show ↓'}
                    </button>
                  </div>
                </div>

                {/* Snapshot timeline */}
                {snapshots.length > 1 && (
                  <div className="px-4 sm:px-5 pb-3 flex items-center gap-2 overflow-x-auto">
                    {snapshots.map((snap, i) => {
                      const g = overallGrade(snap.avg);
                      const isActive = snapshotIdx === i;
                      return (
                        <button
                          key={snap.reviewedAt}
                          onClick={() => setActiveSnapshot(prev => ({ ...prev, [entry.id]: i }))}
                          className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                            isActive
                              ? 'bg-[#6366f1] text-white border-[#6366f1]'
                              : 'border-black/20 text-gray-500 hover:border-[#6366f1] hover:text-[#6366f1]'
                          }`}
                        >
                          <span className={`font-bold ${isActive ? '' : gradeStyle(g)}`}>{g}</span>
                          <span>{snap.avg}%</span>
                          <span className="opacity-60">{formatDate(snap.reviewedAt)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Issue breakdown */}
                {isExpanded && activeSnap && (
                  <div className="border-t border-[#EDECE6] px-4 sm:px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-700 font-semibold uppercase tracking-wide">
                        Issues — {formatDate(activeSnap.reviewedAt)}
                        {prevSnap && <span className="ml-2 text-gray-300">vs {formatDate(prevSnap.reviewedAt)}</span>}
                      </div>
                      <span className="text-xs text-gray-400">{activeSnap.totalIssues} issues</span>
                    </div>
                    <div>
                      {activeSnap.issues.map(issue => {
                        const prev = prevSnap?.issues.find(i => i.number === issue.number);
                        return <IssueProgressRow key={issue.number} issue={issue} prev={prev} />;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
