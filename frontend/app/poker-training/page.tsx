import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { landingEntryBySlug } from "@/lib/seo/content/landing";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * The commercial landing page (§9) — the searcher choosing a platform.
 *
 * Renders through the same ContentPage every other content surface uses, so
 * it inherits breadcrumbs, structured data, the FAQ markup, computed related
 * links and the CTA without a second layout. Its content comes from the
 * content registry like everything else.
 */
export const revalidate = 86400;

const entry = landingEntryBySlug("poker-training")!;

export const metadata: Metadata = entryMetadata(entry);

export default function PokerTrainingPage() {
  if (!entry) notFound();
  return (
    <ContentPage
      entry={entry}
      eyebrow="Poker training"
      ctaHeading="Start with module one — free"
      ctaBody="Two full modules and every calculator cost nothing. Create an account to keep your progress, XP and concept mastery."
    />
  );
}
