import { ImageResponse } from "next/og";
import { BRAND, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_NAME } from "./config";

/**
 * Shared Open Graph image renderer (§18).
 *
 * Every `opengraph-image.tsx` in the app delegates here, so a lesson card, a
 * wiki card and a tool card are visibly the same product. Consistent share
 * cards are a brand signal that compounds: the image is what a link looks
 * like in Slack, Discord, X and an AI chat citation.
 *
 * Deliberately font-free — `next/og` renders with its built-in font rather
 * than fetching Geist at request time. A remote font fetch inside image
 * generation is a network dependency on a code path that must never fail,
 * and the payoff is cosmetic.
 */

export const OG_SIZE = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const OG_CONTENT_TYPE = "image/png";

export interface OgImageInput {
  /** The card headline — the page's own title. */
  title: string;
  /** Small label above the title, e.g. "Poker Wiki" or "Lesson". */
  eyebrow?: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Small facts rendered as pills, e.g. ["12 min", "Intermediate"]. */
  badges?: string[];
}

/** Longer titles step down a size so they never overflow the card. */
function titleFontSize(title: string): number {
  if (title.length > 90) return 44;
  if (title.length > 60) return 54;
  if (title.length > 38) return 64;
  return 72;
}

export function ogImageResponse(input: OgImageInput): ImageResponse {
  const { title, eyebrow, subtitle, badges = [] } = input;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BRAND.background,
          backgroundImage: `radial-gradient(900px 500px at 12% -10%, rgba(124,92,255,0.30), transparent 60%), radial-gradient(700px 400px at 95% 0%, rgba(56,189,248,0.16), transparent 55%)`,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: BRAND.violet,
                fontWeight: 600,
              }}
            >
              {eyebrow}
            </div>
          )}

          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: titleFontSize(title),
              lineHeight: 1.1,
              fontWeight: 700,
              color: BRAND.text,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>

          {subtitle && (
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 28,
                lineHeight: 1.35,
                color: BRAND.muted,
                maxWidth: 900,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundImage: `linear-gradient(135deg, ${BRAND.violet}, ${BRAND.blue})`,
                color: "#fff",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              ♠
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: BRAND.text }}>
              {SITE_NAME}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {badges.slice(0, 3).map((badge) => (
              <div
                key={badge}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: `1px solid ${BRAND.border}`,
                  backgroundColor: BRAND.surface,
                  color: BRAND.muted,
                  fontSize: 22,
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/** Trims a title to something that still reads as a headline on a card. */
export function ogTitle(title: string, max = 96): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}
