"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useGitHubAuth } from "@/lib/useGitHubAuth";

const LINKS = [
  { href: "/review", label: "Review" },
  { href: "/wave", label: "Wave" },
  { href: "/history", label: "History" },
  { href: "/guide", label: "Guide" },
];

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const { isConnected, username, loading: authLoading } = useGitHubAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock background scroll while the mobile menu is open so the page
  // beneath doesn't shift around. Touching `document.body.style` is an
  // external-system sync, which is the canonical effect use case.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="bg-white sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0 flex-shrink"
          onClick={closeMenu}
        >
          <span className="text-[#6366f1] font-black text-base tracking-tight">
            DRIPS
          </span>
          <span className="text-[#111827] text-xs font-medium whitespace-nowrap">
            Issues Reviewer
          </span>
        </Link>

        {/* Desktop nav (md+) */}
        <div className="hidden md:flex items-center gap-2">
          {LINKS.map((l) => (
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

          {authLoading ? (
            <span className="text-xs text-transparent bg-gray-100 px-3 py-1.5 rounded-lg select-none animate-pulse">
              ⬡ checking…
            </span>
          ) : isConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#111827] bg-gray-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
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
              className="flex items-center gap-1.5 bg-[#1a1a2e] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2d2d45] transition-colors whitespace-nowrap"
            >
              <GithubIcon />
              Connect GitHub
            </a>
          )}
        </div>

        {/* Mobile: auth quick-action visible in the header bar itself, before
            the burger, so users can sign in without opening the menu. */}
        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
          {!authLoading && (
            isConnected ? (
              <span className="text-xs text-[#111827] bg-gray-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap max-w-[90px] truncate">
                @{username}
              </span>
            ) : (
              <a
                href="/api/auth/github"
                className="flex items-center gap-1 bg-[#1a1a2e] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#2d2d45] transition-colors whitespace-nowrap"
              >
                <GithubIcon size={12} />
                Connect
              </a>
            )
          )}

          {/* Hamburger (below md) */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#111827] hover:bg-gray-100 transition-colors flex-shrink-0"
          >
          {menuOpen ? (
            // Close icon
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <>
          {/* Click-outside backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="md:hidden fixed inset-0 top-14 bg-black/20 z-40"
          />

          <div
            id="mobile-menu"
            className="md:hidden absolute left-0 right-0 top-14 bg-white border-b border-gray-100 shadow-sm z-50"
          >
            <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={closeMenu}
                  className={`px-4 py-3 rounded-lg text-base transition-colors ${
                    pathname === l.href
                      ? "bg-[#6366f1] text-white font-medium"
                      : "text-[#111827] hover:bg-gray-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}

              {isConnected && (
                <>
                  <div className="h-px bg-gray-100 my-2" />
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-[#111827]">⬡ @{username}</span>
                    <a
                      href="/api/auth/logout"
                      className="text-sm text-[#111827] hover:text-red-500 transition-colors"
                    >
                      Disconnect
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
