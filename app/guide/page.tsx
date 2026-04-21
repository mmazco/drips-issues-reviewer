import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guide | Drips Issues Reviewer",
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

const PRINCIPLES_MAP = [
  { principle: "Real Impact",     checks: ["Title specificity — is the change clearly named?"] },
  { principle: "Clear Context",   checks: ["Body length — enough detail to understand the problem?", "File paths — does it point to the affected code?"] },
  { principle: "Scoped for Wave", checks: ["Area label stacking — is it one focused area, not several?"] },
  { principle: "Implementation",  checks: ["Setup steps — can a contributor reproduce or start work?"] },
  { principle: "Expectations",    checks: ["Acceptance criteria — is there a definition of done?"] },
  { principle: "Hygiene",         checks: ["Labels applied — is it categorized?", "Milestone — is it attached to a Wave?"] },
];

export default function GuidePage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-14">

        {/* Header */}
        <div className="space-y-4">
          <div>
            <div className="text-xs text-[#6366f1] font-semibold uppercase tracking-widest mb-2">Drips Wave Issues Guide</div>
            <h1 className="text-3xl font-bold text-[#111827]">How issues are scored</h1>
            <p className="text-[#111827] mt-2 leading-relaxed">
              How the reviewer scores issues and complexity tiers affect contributor earnings is based on Drips&apos; guide.
            </p>
          </div>

          {/* CTA buttons — moved here from bottom */}
          <div className="flex gap-3">
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
          <div className="space-y-3">
            {/* Principles tooltip */}
            <details className="group border border-black rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#111827]">How 5 principles become 8 checks</span>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">?</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </summary>
              <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50 text-xs text-[#111827]">
                <p className="text-gray-600 mb-3">Drips docs outlines 5 principles for a good issue. Some principles require more than one check to be measurable. That&apos;s how 5 principles expand into 8 checks.</p>
                {PRINCIPLES_MAP.map(p => (
                  <div key={p.principle} className="flex gap-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-[#111827] flex-shrink-0 h-fit mt-0.5">{p.principle}</span>
                    <ul className="space-y-0.5">
                      {p.checks.map(c => <li key={c} className="before:content-['→'] before:mr-1.5 before:text-gray-400">{c}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Score key */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pass", pts: "2 pts", sub: "Requirement clearly met", dot: "bg-[#6366f1]" },
              { label: "Warn", pts: "1 pt",  sub: "Partially met",           dot: "bg-amber-500" },
              { label: "Fail", pts: "0 pts", sub: "Not met",                 dot: "bg-red-500" },
            ].map(s => (
              <div key={s.label} className="border border-black rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="font-bold text-[#111827]">{s.label} — {s.pts}</span>
                </div>
                <div className="text-xs text-gray-600 ml-4.5">{s.sub}</div>
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
                <div key={g.grade} className="text-center py-6">
                  <div className={`text-4xl font-black ${g.color}`}>{g.grade}</div>
                  <div className="text-xs text-gray-600 mt-1.5">{g.range}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-[#111827]">
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
