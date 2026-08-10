import { notFound } from "next/navigation";
import { OG_CONTENT_TYPE, OG_SIZE, ogImageResponse, ogTitle } from "@/lib/seo/og";
import {
  lessonEntryBySlug,
  MODULES_BY_SLUG,
  publishedLessons,
} from "@/lib/seo/content/lessons";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StackedPoker interactive poker lesson";

export function generateStaticParams() {
  return publishedLessons().map((lesson) => ({ slug: lesson.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = lessonEntryBySlug(slug);
  if (!entry) notFound();

  const lesson = publishedLessons().find((l) => l.slug === slug);
  const moduleSlug = entry.authority?.relatedModuleSlug;
  const courseModule = moduleSlug ? MODULES_BY_SLUG[moduleSlug] : undefined;

  return ogImageResponse({
    eyebrow: courseModule?.title ?? "Lesson",
    title: ogTitle(entry.title),
    subtitle: entry.summary,
    badges: [
      lesson ? `${lesson.estimated_min} min` : "",
      lesson ? `${lesson.step_count} steps` : "",
    ].filter(Boolean),
  });
}
