import { SITE_TAGLINE } from "@/lib/seo/config";
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
export const alt = "StackedPoker — learn poker strategy the right way";

export default function Image() {
  return ogImageResponse({
    eyebrow: "Poker strategy, properly taught",
    title: SITE_TAGLINE,
    subtitle: "Interactive lessons, a poker concept wiki and free tools.",
  });
}
