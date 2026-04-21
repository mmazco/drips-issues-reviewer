"use client";
import { useState } from "react";
import { RUBRIC } from "@/lib/scoring";

const PRINCIPLE_COLORS: Record<string, string> = {
  "Real Impact": "bg-purple-100 text-purple-700",
  "Clear Context": "bg-blue-100 text-blue-700",
  "Scoped for Wave": "bg-teal-100 text-teal-700",
  "Implementation Guidelines": "bg-orange-100 text-orange-700",
  "Explicit Expectations": "bg-green-100 text-green-700",
  "Hygiene": "bg-gray-100 text-gray-600",
};

export default function RubricGuide() {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-[#6366f1] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#6366f1] text-xl">📊</span>
          <div className="text-left">
            <div className="font-bold text-[#1a1a2e] group-hover:text-[#6366f1] transition-colors">
              How Scoring Works
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              8 checks mapped to the 5 Drips principles · pass=2 · warn=1 · fail=0 · max 16pts
            </div>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left px-5 py-3">Drips Principle</th>
                <th className="text-left px-5 py-3">Check</th>
                <th className="text-left px-5 py-3">How it Scores</th>
              </tr>
            </thead>
            <tbody>
              {RUBRIC.map((r, i) => (
                <tr key={r.key} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRINCIPLE_COLORS[r.principle] || 'bg-gray-100 text-gray-600'}`}>
                      {r.principle}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-[#1a1a2e]">{r.label}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4 bg-indigo-50 border-t border-indigo-100 text-xs text-[#6366f1]">
            Each check: <strong>pass=2</strong>, <strong>warn=1</strong>, <strong>fail=0</strong>. Max 16 pts →{" "}
            <strong>A ≥80%</strong> · <strong>B ≥65%</strong> · <strong>C ≥45%</strong> · <strong>D &lt;45%</strong>.
            Issues graded C or D get a QA Agent comment with suggested improvements.
          </div>
        </div>
      )}
    </section>
  );
}
