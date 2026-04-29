import type { Metadata } from "next";

// Client-component pages can't export metadata directly, so the title
// lives in this thin layout wrapper instead.
export const metadata: Metadata = {
  title: "Review",
  description:
    "Score every open issue on a GitHub repo against the Drips rubric and draft Vera-powered QA feedback.",
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
