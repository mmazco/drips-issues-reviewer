import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

// metadataBase is required so relative URLs in OG/Twitter images
// resolve correctly when shared. Falls back to localhost in dev so
// `next build` doesn't warn locally; Railway sets NEXT_PUBLIC_BASE_URL
// to the prod domain so social cards point at the live site.
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const BRAND = "Drips Wave Issues Reviewer";
const TAGLINE =
  "Internal tool to audit and optimize GitHub Issues quality for maintainers.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    // Homepage gets the full brand. Inner pages use a shorter suffix
    // ("Wave · Drips Issues Reviewer") to avoid repeating "Wave" twice
    // in titles like "Wave · Drips Wave Issues Reviewer".
    default: BRAND,
    template: "%s · Drips Issues Reviewer",
  },
  description: TAGLINE,
  applicationName: BRAND,
  keywords: [
    "Drips Network",
    "Drips Wave",
    "open source",
    "GitHub issue quality",
    "issue rubric",
    "Stellar Wave",
  ],
  authors: [{ name: "Drips Network" }],
  openGraph: {
    type: "website",
    url: baseUrl,
    siteName: BRAND,
    title: BRAND,
    description: TAGLINE,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND,
    description: TAGLINE,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="text-center text-xs text-[#111827] py-6 px-4 border-t border-gray-100 bg-white">
          Drips Wave Issues Reviewer · Internal Tool ·{" "}
          <a href="https://www.drips.network" target="_blank" rel="noreferrer" className="hover:text-[#6366f1]">
            drips.network
          </a>
        </footer>
      </body>
    </html>
  );
}
