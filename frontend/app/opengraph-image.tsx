import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse } from "@/lib/seo/og";

/**
 * Site-wide default Open Graph card.
 *
 * Next.js's metadata-file convention cascades: this covers every route that
 * does not colocate its own `opengraph-image`, so no page can ever share as
 * a bare link with no image.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StackedPoker — poker training, preflop trainer, hand history review and an AI poker coach";

export default function Image() {
  return ogImageResponse({
    eyebrow: "Poker training · Hand review · AI coach",
    title: "Stop guessing. Know the right play.",
    subtitle: "Preflop trainer, hand history review with an AI poker coach, and a bankroll tracker.",
  });
}
