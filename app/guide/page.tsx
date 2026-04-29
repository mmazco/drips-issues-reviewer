import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guide",
  description: "How the Drips Wave issue rubric works: 5 principles, 8 automated checks, complexity tiers.",
};

const COMPLEXITY = [
  { dot: "bg-[#6366f1]", label: "Trivial", pts: "100 pts", desc: "Small fixes, copy changes, clearly bounded tasks. Obvious acceptance criteria." },
  { dot: "bg-[#818cf8]", label: "Medium", pts: "150 pts", desc: "Standard features, bugs touching multiple parts of the codebase." },
  { dot: "bg-[#111827]", label: "High", pts: "200 pts", desc: "Complex integrations, refactors, architectural changes." },
];

const CHECKS = [
  { principle: "Real Impact",     check: "Title specificity",    pass: "5+ word descriptive title",        fail: 'Vague like "fix bug"',       tooltip: "Does the title clearly describe the change? Vague titles like \"fix bug\" force contributors to open the issue just to understand what it's about." },
  { principle: "Clear Context",   check: "Body length",          pass: "200+ characters",                  fail: "Empty or under 200 chars",  tooltip: "Is there enough context for a contributor to understand the problem without asking questions? Short or empty bodies lead to back-and-forth." },
  { principle: "Clear Context",   check: "File paths",           pass: "2+ file refs in body",             fail: "No paths mentioned",        tooltip: "Does the issue point to the specific files or modules a contributor should look at? Without this, they have to search the whole codebase." },
  { principle: "Scoped for Wave", check: "Area label stacking",  pass: "1 area label",                     fail: "3+ area labels stacked",    tooltip: "Does the issue stay focused on one area of the codebase? Issues spanning frontend + backend + contracts should be split into separate issues." },
  { principle: "Implementation",  check: "Setup steps",          pass: "Code block or command present",    fail: "No setup instructions",     tooltip: "Can a contributor clone the repo and start working from the instructions in the issue? Include build commands or how to reproduce the problem." },
  { principle: "Expectations",    check: "Acceptance criteria",  pass: "Explicit checklist or criteria",   fail: "No definition of done",     tooltip: "Will a contributor know when they're done? Define what the PR must include and how it will be reviewed." },
  { principle: "Hygiene",         check: "Labels applied",       pass: "2+ labels",                        fail: "No labels",                 tooltip: "Is the issue categorized so contributors can filter by area, type, or difficulty? Unlabeled issues get overlooked." },
  { principle: "Hygiene",         check: "Milestone",            pass: "Attached to a milestone",          fail: "No milestone (warn = 1pt)", tooltip: "Is the issue tied to a milestone or sprint? This signals planning maturity and helps contributors understand priority." },
];

export default function GuidePage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-14">

        {/* Header */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[#6366f1] font-semibold uppercase tracking-widest mb-2">Drips Wave Issues Guide</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111827]">How issues are scored</h1>
            <p className="text-[#111827] text-sm sm:text-base mt-2 leading-relaxed">
              Drips&apos; 5 principles for a good issue, operationalized as 8 deterministic checks. Complexity tiers map to contributor earnings.
            </p>
          </div>

          {/* CTA buttons — moved here from bottom */}
          <div className="flex gap-3 flex-wrap">
            <Link href="/review" className="bg-[#6366f1] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4f52cc] transition-colors">
              Review a repo →
            </Link>
            <a href="https://www.drips.network/blog/posts/creating-meaningful-issues" target="_blank" rel="noreferrer"
              className="border border-black text-[#111827] px-5 py-2.5 rounded-xl text-sm font-medium hover:border-[#6366f1] hover:text-[#6366f1] transition-colors">
              Drips docs ↗
            </a>
          </div>
        </div>

        {/* Scoring system */}
        <section className="space-y-6">
          {/* Score key */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Pass", pts: "2 pts", sub: "Requirement clearly met", dot: "bg-[#6366f1]" },
              { label: "Warn", pts: "1 pt",  sub: "Partially met",           dot: "bg-amber-500" },
              { label: "Fail", pts: "0 pts", sub: "Not met",                 dot: "bg-red-500" },
            ].map(s => (
              <div key={s.label} className="border border-black rounded-2xl px-3 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <span className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="font-bold text-[#111827] text-sm sm:text-base">{s.label}</span>
                </div>
                <div className="text-[#111827] text-xs font-semibold ml-3.5 sm:ml-4.5">{s.pts}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 ml-3.5 sm:ml-4.5 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Grade thresholds */}
          <div className="bg-white border border-black rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {[
                { grade: "A", range: "≥ 80%", color: "text-[#6366f1]" },
                { grade: "B", range: "≥ 65%", color: "text-[#818cf8]" },
                { grade: "C", range: "≥ 45%", color: "text-amber-600" },
                { grade: "D", range: "< 45%",  color: "text-red-600" },
              ].map(g => (
                <div key={g.grade} className="text-center py-5 sm:py-6">
                  <div className={`text-3xl sm:text-4xl font-black ${g.color}`}>{g.grade}</div>
                  <div className="text-[10px] sm:text-xs text-gray-600 mt-1 sm:mt-1.5 whitespace-nowrap">{g.range}</div>
                </div>
              ))}
            </div>
            <div className="px-4 sm:px-5 py-3 border-t border-gray-100 text-xs text-[#111827]">
              Issues graded <strong>C or D</strong> get a Vera comment on GitHub with specific fixes.
            </div>
          </div>

          {/* 8 checks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHECKS.map((r, i) => (
              <div key={i} className="bg-white border border-black rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-[#111827]">{r.principle}</span>
                  <span className="text-xs text-gray-600">0–2 pts</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="font-semibold text-[#111827] text-sm">{r.check}</span>
                  <div className="relative group flex-shrink-0">
                    <span className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-[10px] flex items-center justify-center cursor-help hover:border-[#6366f1] hover:text-[#6366f1] transition-colors select-none">i</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#111827] text-white text-xs rounded-xl px-3 py-2.5 leading-relaxed hidden group-hover:block z-50 shadow-lg pointer-events-none">
                      {r.tooltip}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111827]" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-[#6366f1] flex-shrink-0 mt-0.5" />
                    <span className="text-[#111827]">{r.pass}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{r.fail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Complexity tiers */}
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Complexity and points</h2>
            <p className="text-[#111827] text-sm mt-1">
              In Drips Waves, each issue should be tagged with a complexity level, which maps directly to points.
            </p>
          </div>
          <div className="bg-white border border-black rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#6366f1] text-white text-sm font-semibold">Complexity levels</div>
            {COMPLEXITY.map((c, i) => (
              <div key={i} className={`flex items-start gap-4 px-5 py-4 ${i < COMPLEXITY.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${c.dot}`} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-bold text-[#111827]">{c.label}</span>
                    <span className="text-[#6366f1] font-bold text-sm">{c.pts}</span>
                  </div>
                  <p className="text-[#111827] text-sm mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 text-xs text-[#111827]">
              Maintainers add complexity labels on issues to capture relevant contributors. Unresolved issues roll over to the next Wave.
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
