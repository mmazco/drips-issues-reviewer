import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
  description:
    "Track issue-quality scores over time per repo. See how maintainers improved between Wave reviews.",
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
