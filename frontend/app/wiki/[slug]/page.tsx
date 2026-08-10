import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { MODULES_BY_SLUG } from "@/lib/seo/content/lessons";
import { wikiEntries, wikiEntryBySlug } from "@/lib/seo/content/wiki";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * A Poker Wiki article (§5).
 *
 * Statically generated for the full, closed set of wiki routes, revalidated
 * daily so an edit to the theory registry propagates without a deploy (§19).
 * `dynamicParams = false` makes an unknown slug a 404 rather than an
 * on-demand render — soft-404s are one of the fastest ways to lose crawl
 * budget on a large content site.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return wikiEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = wikiEntryBySlug(slug);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function WikiArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = wikiEntryBySlug(slug);
  if (!entry) notFound();

  const moduleSlug = entry.authority?.relatedModuleSlug;
  const moduleTitle = moduleSlug ? MODULES_BY_SLUG[moduleSlug]?.title : undefined;

  return (
    <ContentPage
      entry={entry}
      eyebrow="Poker Wiki"
      moduleTitle={moduleTitle}
      ctaHeading={`Practise ${entry.title.replace(/\s*\(.*\)\s*$/, "")}, don't just read it`}
      ctaBody="Reading a concept and applying it under pressure are different skills. StackedPoker's interactive lessons make you commit to a decision before revealing the answer — free account, no card required."
    />
  );
}
