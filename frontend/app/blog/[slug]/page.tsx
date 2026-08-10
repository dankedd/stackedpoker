import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/seo/ContentPage";
import { blogEntries, blogEntryBySlug } from "@/lib/seo/content/blog";
import { entryMetadata } from "@/lib/seo/metadata";

/**
 * A blog post (§2, §3 Article schema).
 *
 * `generateStaticParams` returns an empty array while the registry is empty,
 * and `dynamicParams = false` means every /blog/* URL 404s cleanly until a
 * real post exists — no placeholder page ever gets crawled.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return blogEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = blogEntryBySlug(slug);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = blogEntryBySlug(slug);
  if (!entry) notFound();

  return <ContentPage entry={entry} eyebrow="Poker strategy" />;
}
