import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import {
  courseEntryBySlug,
  LESSONS_BY_MODULE,
  MODULES_BY_SLUG,
  publishedModules,
} from "@/lib/seo/content/lessons";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StackedPoker poker course";

export function generateStaticParams() {
  return publishedModules().map((courseModule) => ({ slug: courseModule.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = courseEntryBySlug(slug);
  if (!entry) notFound();

  const courseModule = MODULES_BY_SLUG[slug];
  const lessons = LESSONS_BY_MODULE[courseModule.id] ?? [];

  return ogImageResponse({
    eyebrow: "Poker course",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: [
      `${lessons.length} lessons`,
      courseModule.difficulty ?? "",
    ].filter(Boolean),
  });
}
