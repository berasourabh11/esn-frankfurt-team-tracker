import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Removes emoji, which the default OG font cannot render. */
export function stripEmoji(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Shared social-preview card. Rendered with next/og (Satori), so only
 * inline styles and flexbox are available.
 */
export function renderOgImage({
  eyebrow,
  title,
  subtitle,
  accent = "#00AEEF",
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: string;
  footer?: string;
}) {
  title = stripEmoji(title);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #2E3192 0%, #1b1e6e 55%, #0d0f3a 100%)",
        color: "white",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -120,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: accent,
          opacity: 0.35,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #00AEEF, #EC008C 50%, #F47B20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
          }}
        >
          <svg width="30" height="30" viewBox="0 0 100 100" fill="white">
            <path d="M50 4l9.5 29.2H90L65.2 51.3l9.5 29.2L50 62.4 25.3 80.5l9.5-29.2L10 33.2h30.5z" />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>ESN Frankfurt</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: accent === "#2E3192" ? "#9fdcf5" : accent,
            textTransform: "uppercase",
            letterSpacing: 3,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 40 ? 64 : 80,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        {subtitle && <div style={{ display: "flex", fontSize: 32, opacity: 0.85 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", fontSize: 24, opacity: 0.7 }}>
        {footer ?? "Events for international students in Frankfurt"}
      </div>
    </div>,
    OG_SIZE,
  );
}
