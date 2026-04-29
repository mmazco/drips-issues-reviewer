import { ImageResponse } from "next/og";

export const alt = "Drips Wave Issues Reviewer — audit and optimize GitHub Issues quality for maintainers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 1200×630 OG card. Static-rendered at build time. Brand palette pulled
// from the rest of the app: white background, indigo accent (#6366f1),
// near-black body text (#111827).
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f5f5ff 50%, #eef0ff 100%)",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 44, lineHeight: 1 }}>💧</span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#6366f1",
              letterSpacing: -0.5,
            }}
          >
            DRIPS
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#111827",
              marginLeft: 4,
            }}
          >
            Wave Issues Reviewer
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: -2,
              lineHeight: 1.05,
              margin: 0,
              maxWidth: 1000,
            }}
          >
            Audit and optimize GitHub Issues quality for maintainers.
          </h1>
          <p
            style={{
              fontSize: 30,
              color: "#475569",
              margin: 0,
              maxWidth: 860,
              lineHeight: 1.3,
            }}
          >
            Score every issue against the Drips Wave rubric. QA feedback in one click.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            color: "#6366f1",
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9ca3af" }}>—</span>
            5 principles · 8 checks · A/B/C/D grades
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
