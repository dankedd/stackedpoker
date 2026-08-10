import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Layers, ListChecks, Timer } from "lucide-react";
import { ContentPage } from "@/components/seo/ContentPage";
import { TrackedLink } from "@/components/seo/TrackedLink";
import {
  lessonEntryBySlug,
  MODULES_BY_SLUG,
  publishedLessons,
} from "@/lib/seo/content/lessons";
import { entryMetadata } from "@/lib/seo/metadata";
import { lessonPlayerPath } from "@/lib/seo/routes";

/**
 * The public, crawlable page for one lesson (§4).
 *
 * This is the SEO surface; `/learn/lesson/[slug]` remains the authenticated
 * interactive player. The split matters: Google indexes what the lesson
 * teaches, while the steps and their answer keys stay behind the auth check
 * (see lib/seo/content/lessons.ts for why this page reads the metadata-only
 * curriculum build).
 *
 * The route is public even though /learn is otherwise gated — middleware.ts
 * shares `isPublicSeoPath()` with this module's routing rules, so a lesson
 * slug is reachable while /learn, /learn/lesson/* and /learn/module/* are
 * not.
 */
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedLessons().map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = lessonEntryBySlug(slug);
  if (!entry) return {};
  return entryMetadata(entry);
}

export default async function PublicLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = lessonEntryBySlug(slug);
  if (!entry) notFound();

  const moduleSlug = entry.authority?.relatedModuleSlug;
  const courseModule = moduleSlug ? MODULES_BY_SLUG[moduleSlug] : undefined;
  const lesson = publishedLessons().find((l) => l.slug === slug)!;
  const context = { contentKind: entry.kind, contentSlug: entry.slug, cluster: entry.clusters?.[0] };

  return (
    <ContentPage
      entry={entry}
      eyebrow={courseModule ? courseModule.title : "Lesson"}
      moduleTitle={courseModule?.title}
      ctaHeading={`Play "${lesson.title}" free`}
      ctaBody="The interactive version puts you in the spot, makes you choose, then shows you why the right line is right. Free account, no card required."
      intro={
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat icon={<Timer aria-hidden="true" className="h-4 w-4" />} label="Time" value={`${lesson.estimated_min} min`} />
          <Stat icon={<ListChecks aria-hidden="true" className="h-4 w-4" />} label="Steps" value={`${lesson.step_count}`} />
          <Stat
            icon={<Layers aria-hidden="true" className="h-4 w-4" />}
            label="Module"
            value={courseModule?.title ?? "StackedPoker"}
          />
        </div>
      }
    >
      <div className="mt-10 rounded-xl border border-border/60 bg-card/40 p-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Start the interactive lesson
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The full {lesson.step_count}-step version is free to start with a StackedPoker account.
          Your progress, XP and concept mastery are saved as you go.
        </p>
        <TrackedLink
          href={lessonPlayerPath(lesson.slug)}
          context={context}
          label="lesson-player"
          event="cta"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Open the lesson
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </TrackedLink>
      </div>
    </ContentPage>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
