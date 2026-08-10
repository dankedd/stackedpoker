import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { ContentPage } from "@/components/seo/ContentPage";
import { TrackedLink } from "@/components/seo/TrackedLink";
import {
  courseEntryBySlug,
  LESSONS_BY_MODULE,
  MODULES_BY_SLUG,
  publishedModules,
} from "@/lib/seo/content/lessons";
import { entryMetadata } from "@/lib/seo/metadata";
import { lessonPath } from "@/lib/seo/routes";

/**
 * A public course page — one per curriculum module (§2, §3 Course schema).
 *
 * Deliberately on `/courses/[slug]` rather than under `/learn`: the
 * signed-in module view already owns `/learn/module/[slug]`, and "course" is
 * both the schema.org type and the query people actually search.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedModules().map((courseModule) => ({ slug: courseModule.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = courseEntryBySlug(slug);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = courseEntryBySlug(slug);
  if (!entry) notFound();

  const courseModule = MODULES_BY_SLUG[slug];
  const lessons = (LESSONS_BY_MODULE[courseModule.id] ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const context = { contentKind: entry.kind, contentSlug: entry.slug, cluster: entry.clusters?.[0] };

  return (
    <ContentPage
      entry={entry}
      eyebrow="Poker course"
      ctaHeading={`Start ${courseModule.title} free`}
      ctaBody="Create a free StackedPoker account to work through the lessons, keep your progress and unlock the next module."
    >
      <section aria-labelledby="lesson-list" className="mt-12">
        <h2 id="lesson-list" className="text-xl font-semibold tracking-tight text-foreground">
          Every lesson in {courseModule.title}
        </h2>
        <ol className="mt-4 space-y-2.5">
          {lessons.map((lesson, index) => (
            <li key={lesson.slug}>
              <TrackedLink
                href={lessonPath(lesson.slug)}
                context={context}
                label="course-lesson"
                className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-[11px] font-semibold text-muted-foreground"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2 text-sm font-medium text-foreground">
                    {lesson.title}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                    />
                  </span>
                  {lesson.subtitle && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {lesson.subtitle}
                    </span>
                  )}
                  <span className="mt-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground/70">
                    {lesson.step_count} steps · {lesson.estimated_min} min
                  </span>
                </span>
              </TrackedLink>
            </li>
          ))}
        </ol>
      </section>
    </ContentPage>
  );
}
