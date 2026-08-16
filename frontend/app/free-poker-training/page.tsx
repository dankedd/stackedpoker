import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { pillarEntryBySlug } from "@/lib/seo/content/pillars";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * What the free tier actually includes, itemised from the entitlement code.
 *
 * Rendered through the same ContentPage as every other content surface, so it
 * inherits breadcrumbs, structured data, FAQ markup, computed related links
 * and the CTA without a second layout.
 */
export const revalidate = 86400;

const entry = pillarEntryBySlug("free-poker-training")!;

export const metadata: Metadata = entryMetadata(entry);

export default function FreePokerTrainingPage() {
  if (!entry) notFound();
  return (
    <ContentPage
      entry={entry}
      eyebrow="Free poker training"
      ctaHeading="Start with the calculators — no account needed"
      ctaBody="Every calculator is free and needs no signup. When you want the lessons, a free account opens the first two modules in full."
    />
  );
}
