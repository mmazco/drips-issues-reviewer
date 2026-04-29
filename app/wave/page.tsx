import type { Metadata } from "next";
import Link from "next/link";
import { WAVE4_TEAMS } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Wave",
  description: "Drips Wave 4 hackathon teams — 14 approved projects with issue scores and review status.",
};

function gradeColor(grade: string | null) {
  if (grade === 'A') return 'text-[#6366f1] font-bold';
  if (grade === 'B') return 'text-[#818cf8] font-bold';
  if (grade === 'C') return 'text-amber-600 font-bold';
  if (grade === 'D' || grade === 'F') return 'text-red-600 font-bold';
  return 'text-gray-300';
}

export default function WavePage() {
  return (
    <div className="bg-white min-h-screen">
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <div className="space-y-3">
        <div>
          <div className="text-xs text-[#6366f1] font-semibold uppercase tracking-widest mb-2">Drips Wave 4 · 22–29 Apr 2026</div>
          <h1 className="text-2xl font-bold text-[#111827]">Wave 4 Hackathon projects</h1>
          <p className="text-gray-600 text-sm mt-1">{WAVE4_TEAMS.length} teams approved</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://landing.drips.network/codigoalebrije/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-black text-[#111827] text-sm font-medium px-4 py-2 rounded-xl hover:border-[#6366f1] hover:text-[#6366f1] transition-colors"
          >
            Código Alebrije × Stellar Wave ↗
          </a>
          <a
            href="https://www.drips.network/wave/stellar/issues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-black text-[#111827] text-sm font-medium px-4 py-2 rounded-xl hover:border-[#6366f1] hover:text-[#6366f1] transition-colors"
          >
            Stellar Wave #4 ↗
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black overflow-hidden">
        {WAVE4_TEAMS.map((team, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-[#EDECE6] last:border-0 hover:bg-gray-50 transition-colors">
            <div className={`text-xl font-bold w-8 text-center pt-0.5 ${gradeColor(team.issueGrade)}`}>
              {team.issueGrade ?? '—'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#111827] text-sm">{team.name}</span>
                {team.openIssues !== null && (
                  <span className="text-xs text-[#111827]">{team.openIssues} issues</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{team.status}</div>
              {team.notes && (
                <div className="text-xs text-gray-700 mt-1.5 leading-relaxed bg-gray-50 px-3 py-2 rounded-lg">{team.notes}</div>
              )}
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              {team.repoUrl && !team.repoUrl.startsWith('❓') ? (
                <>
                  <Link
                    href={`/review?url=${encodeURIComponent(team.repoUrl)}`}
                    className="block text-xs text-[#6366f1] hover:underline"
                  >
                    Review →
                  </Link>
                  <a href={team.repoUrl} target="_blank" rel="noreferrer" className="block text-xs text-[#111827] hover:text-[#6366f1]">
                    GitHub ↗
                  </a>
                </>
              ) : (
                <span className="text-xs text-gray-500">No repo</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
