import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { PreflopRangesTool } from "@/components/tools/preflop-ranges/PreflopRangesTool";
import { PREFLOP_RANGES_ENABLED, PREFLOP_RANGES_SLUG } from "@/lib/ranges/feature";
import { toolEntryBySlug } from "@/lib/seo/content/tools";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * Preflop ranges & trainer. Its own route (not tools/[slug]) only because the
 * widget needs more width than the article column; the entry, metadata,
 * structured data, FAQ and provenance all still come from the tools registry
 * and render through the shared ContentPage.
 *
 * Feature-flagged: with NEXT_PUBLIC_FEATURE_PREFLOP_RANGES unset this 404s and
 * the registry has no entry for it — see lib/ranges/feature.ts.
 */
export const revalidate = 86400;

export function generateMetadata(): Metadata {
  const entry = PREFLOP_RANGES_ENABLED ? toolEntryBySlug(PREFLOP_RANGES_SLUG) : undefined;
  return entry ? entryMetadata(entry) : { robots: { index: false, follow: false } };
}

export default function PreflopRangesPage() {
  const entry = PREFLOP_RANGES_ENABLED ? toolEntryBySlug(PREFLOP_RANGES_SLUG) : undefined;
  if (!entry) notFound();

  return (
    <ContentPage
      entry={entry}
      eyebrow="Free poker tool"
      wideIntro
      intro={<PreflopRangesTool />}
      ctaHeading="Ranges are the start, not the finish"
      ctaBody="StackedPoker's lessons take you from the preflop chart into the flop, turn and river decisions that follow. Free account, no card required."
    />
  );
}
