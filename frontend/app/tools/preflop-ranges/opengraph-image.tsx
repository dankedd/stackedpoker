import { notFound } from "next/navigation";
import { PREFLOP_RANGES_ENABLED, PREFLOP_RANGES_SLUG } from "@/lib/ranges/feature";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import { toolEntryBySlug } from "@/lib/seo/content/tools";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Free StackedPoker poker tool";

export default async function Image() {
  const entry = PREFLOP_RANGES_ENABLED ? toolEntryBySlug(PREFLOP_RANGES_SLUG) : undefined;
  if (!entry) notFound();

  return ogImageResponse({
    eyebrow: "Free poker tool",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: ["Free", "No account needed"],
  });
}
