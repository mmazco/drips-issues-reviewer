import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

export const metadata: Metadata = {
  title: "Drips Wave Issue Reviewer",
  description: "Internal tool for reviewing GitHub issue quality against the Drips Wave rubric",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="text-center text-xs text-[#111827] py-6 border-t border-gray-100 bg-white">
          Drips Wave Issue Reviewer · Internal Tool ·{" "}
          <a href="https://www.drips.network" target="_blank" rel="noreferrer" className="hover:text-[#6366f1]">
            drips.network
          </a>
        </footer>
      </body>
    </html>
  );
}
