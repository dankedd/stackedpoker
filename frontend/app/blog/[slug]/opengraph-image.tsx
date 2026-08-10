import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import { blogEntries, blogEntryBySlug } from "@/lib/seo/content/blog";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StackedPoker poker strategy article";

export function generateStaticParams() {
  return blogEntries().map((entry) => ({ slug: entry.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = blogEntryBySlug(slug);
  if (!entry) notFound();

  return ogImageResponse({
    eyebrow: "Poker strategy",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: entry.authority ? [`${entry.authority.readingTimeMin} min read`] : [],
  });
}
