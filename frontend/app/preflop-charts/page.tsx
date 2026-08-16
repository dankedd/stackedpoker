import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { pillarEntryBySlug } from "@/lib/seo/content/pillars";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * Preflop charts, with their sources named.
 *
 * Rendered through the same ContentPage as every other content surface, so it
 * inherits breadcrumbs, structured data, FAQ markup, computed related links
 * and the CTA without a second layout.
 */
export const revalidate = 86400;

const entry = pillarEntryBySlug("preflop-charts")!;

export const metadata: Metadata = entryMetadata(entry);

export default function PreflopChartsPage() {
  if (!entry) notFound();
  return (
    <ContentPage
      entry={entry}
      eyebrow="Preflop charts"
      ctaHeading="Build a range instead of reading one"
      ctaBody="The range trainer asks you to place every hand yourself, then shows you which cells you got wrong. Free with an account."
    />
  );
}
