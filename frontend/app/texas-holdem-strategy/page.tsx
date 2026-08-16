import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { pillarEntryBySlug } from "@/lib/seo/content/pillars";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * The Texas Hold'em strategy pillar — a map of the topic that links out rather than restating theory.
 *
 * Rendered through the same ContentPage as every other content surface, so it
 * inherits breadcrumbs, structured data, FAQ markup, computed related links
 * and the CTA without a second layout.
 */
export const revalidate = 86400;

const entry = pillarEntryBySlug("texas-holdem-strategy")!;

export const metadata: Metadata = entryMetadata(entry);

export default function TexasHoldemStrategyPage() {
  if (!entry) notFound();
  return (
    <ContentPage
      entry={entry}
      eyebrow="Texas Hold'em strategy"
      ctaHeading="Start with module one — free"
      ctaBody="Reading strategy produces recognition; deciding produces recall. The first two modules are free and assume nothing."
    />
  );
}
