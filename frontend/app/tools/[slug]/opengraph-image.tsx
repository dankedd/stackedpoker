import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import { toolEntries, toolEntryBySlug } from "@/lib/seo/content/tools";
import { PREFLOP_RANGES_SLUG } from "@/lib/ranges/feature";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Free StackedPoker poker tool";

export function generateStaticParams() {
  // preflop-ranges has its own route and its own image.
  return toolEntries()
    .filter((entry) => entry.slug !== PREFLOP_RANGES_SLUG)
    .map((entry) => ({ slug: entry.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = toolEntryBySlug(slug);
  if (!entry) notFound();

  return ogImageResponse({
    eyebrow: "Free poker tool",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: entry.status === "planned" ? ["In development"] : ["Free", "No account needed"],
  });
}
