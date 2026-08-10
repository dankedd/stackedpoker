import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import { publishedWikiEntries, wikiEntryBySlug } from "@/lib/seo/content/wiki";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StackedPoker poker concept explainer";

/** Pre-renders a card per article at build time instead of on first share. */
export function generateStaticParams() {
  return publishedWikiEntries().map((entry) => ({ slug: entry.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = wikiEntryBySlug(slug);
  if (!entry) notFound();

  return ogImageResponse({
    eyebrow: "Poker Wiki",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: [
      entry.authority?.difficulty ?? "",
      entry.authority ? `${entry.authority.readingTimeMin} min read` : "",
    ].filter(Boolean),
  });
}
