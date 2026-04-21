"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGitHubAuth } from "@/lib/useGitHubAuth";

export default function Nav() {
  const pathname = usePathname();
  const { isConnected, username } = useGitHubAuth();

  const links = [
    { href: "/review", label: "Review" },
    { href: "/wave", label: "Wave" },
    { href: "/history", label: "History" },
    { href: "/guide", label: "Guide" },
  ];

  return (
    <nav className="bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#6366f1] font-black text-base tracking-tight">DRIPS</span>
          <span className="text-[#111827] text-xs font-medium">Issues Reviewer</span>
        </Link>

        <div className="flex items-center gap-2">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === l.href
                  ? "bg-[#6366f1] text-white font-medium"
                  : "text-[#111827] hover:bg-gray-100"
              }`}
            >
              {l.label}
            </Link>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-1.5" />

          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#111827] bg-gray-100 px-3 py-1.5 rounded-lg">
                ⬡ @{username}
              </span>
              <a
                href="/api/auth/logout"
                className="text-xs text-[#111827] hover:text-red-500 transition-colors px-2 py-1.5"
              >
                Disconnect
              </a>
            </div>
          ) : (
            <a
              href="/api/auth/github"
              className="flex items-center gap-1.5 bg-[#1a1a2e] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2d2d45] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Connect GitHub
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
