import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SignupCta } from "@/components/seo/SignupCta";
import {
  courseEntries,
  LESSONS_BY_MODULE,
  MODULES_BY_SLUG,
  publishedLessons,
} from "@/lib/seo/content/lessons";
import { staticPageEntry } from "@/lib/seo/content/pages";
import { hubListEntries, structuredDataFor } from "@/lib/seo/structuredData";
import { entryMetadata } from "@/lib/seo/metadata";
import { ROUTES } from "@/lib/seo/routes";

/**
 * The curriculum index (§2).
 *
 * Modules appear in journey order, not alphabetically — the order IS the
 * pedagogy, and presenting it that way is also what makes the page a useful
 * hub link rather than a sitemap in disguise.
 */
export const revalidate = 86400;

const entry = staticPageEntry(ROUTES.courses)!;

export const metadata: Metadata = entryMetadata(entry);

export default function CoursesIndexPage() {
  const courses = courseEntries();
  const lessonCount = publishedLessons().length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <JsonLd data={structuredDataFor(entry, { listEntries: hubListEntries(entry) })} />

      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6">
        <Breadcrumbs entry={entry} />

        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80">
            The curriculum
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            Poker Courses
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {courses.length} modules and {lessonCount} interactive lessons, in the order they are
            meant to be taken — from the rules of Texas Hold&apos;em through preflop ranges, board
            texture and range-versus-range thinking.
          </p>
        </header>

        <ol className="mt-12 space-y-3">
          {courses.map((courseEntry, index) => {
            const courseModule = MODULES_BY_SLUG[courseEntry.slug];
            const lessons = LESSONS_BY_MODULE[courseModule.id] ?? [];
            const minutes = lessons.reduce((sum, l) => sum + l.estimated_min, 0);

            return (
              <li key={courseEntry.path}>
                <Link
                  href={courseEntry.path}
                  className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-violet-500/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {courseEntry.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {courseEntry.summary}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 text-[11px] uppercase tracking-wide text-muted-foreground/70">
                      <span>{lessons.length} lessons</span>
                      <span>{minutes} min</span>
                      {courseModule.difficulty && <span>{courseModule.difficulty}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <SignupCta
          context={{ contentKind: "page", contentSlug: "courses" }}
          heading="Start at lesson one"
          body="The free plan covers the first two modules in full, plus the opening lesson of every module after that."
        />
      </main>

      <Footer />
    </div>
  );
}
