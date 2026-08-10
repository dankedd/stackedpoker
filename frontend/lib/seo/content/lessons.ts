import {
  LEARNING_MODULES,
  LESSONS_BY_MODULE,
  MODULES_BY_SLUG,
  PUBLIC_LESSONS,
} from "@/lib/learn/curriculumPublic.generated";
import type { LearningModule, PublicLesson } from "@/lib/learn/types";
import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { coursePath, lessonPath } from "../routes";
import type { ContentDifficulty, SeoEntry } from "../types";
import { readingTimeMin } from "../reading";
import { clustersForModule } from "./clusters";
import { conceptExplainer, conceptTitle } from "./concepts";

/**
 * Public, crawlable lesson pages (§4) and course pages (§2) derived from the
 * curriculum.
 *
 * Sourced from `curriculumPublic.generated.ts` — the metadata-only build of
 * curriculum.ts — never from curriculum.ts itself. That is a hard rule in
 * this codebase (see scripts/generateCurriculumPublic.ts): the real
 * curriculum embeds every step's answer key, so a public page that imported
 * it would publish the answers to paid lessons. Everything below therefore
 * uses titles, subtitles, concept ids and counts only; the interactive
 * content stays behind /learn/lesson/[slug] and its auth check.
 *
 * Because the registry is derived, a new lesson added to curriculum.ts
 * appears as a public page, in the sitemap, in search and in the related
 * links with no further engineering (§23).
 */

/** Modules with playable lessons. `planned` modules are roadmap-only. */
export function publishedModules(): LearningModule[] {
  return LEARNING_MODULES.filter(
    (m) => m.contentStatus !== "planned" && (LESSONS_BY_MODULE[m.id]?.length ?? 0) > 0,
  ).sort((a, b) => (a.order ?? a.sort_order) - (b.order ?? b.sort_order));
}

export function publishedLessons(): PublicLesson[] {
  const liveModuleIds = new Set(publishedModules().map((m) => m.id));
  return PUBLIC_LESSONS.filter((l) => liveModuleIds.has(l.module_id)).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export function moduleForLesson(lesson: PublicLesson): LearningModule | undefined {
  return LEARNING_MODULES.find((m) => m.id === lesson.module_id);
}

/**
 * Lessons that teach a concept key such as "range_advantage".
 *
 * Matching is token-subset, not string equality: the curriculum's concept
 * vocabulary is finer-grained than the theory registry's
 * (`range_advantage_realization` vs `range_advantage`), so requiring every
 * token of the key to appear in the lesson's concept id links the two
 * namespaces without a hand-maintained alias table that would rot the moment
 * a lesson is added (§23).
 */
export function lessonsForConceptKey(key: string, limit = 6): PublicLesson[] {
  const keyTokens = key.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!keyTokens.length) return [];

  return publishedLessons()
    .filter((lesson) =>
      lesson.concept_ids.some((conceptId) => {
        const tokens = conceptId.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        return keyTokens.every((t) => tokens.includes(t));
      }),
    )
    .slice(0, limit);
}

const DIFFICULTY_BY_TYPE: Record<string, ContentDifficulty> = {
  micro: "beginner",
  concept_reveal: "beginner",
  range_trainer: "intermediate",
  puzzle_drill: "intermediate",
  simulation: "advanced",
};

/**
 * Product-level FAQs for a lesson page.
 *
 * Every answer is a fact about the lesson itself (length, cost, prerequisite,
 * format) taken from curriculum metadata. None of them state poker theory,
 * so nothing here can contradict the source material — the strategy content
 * on the page comes from the concept registry instead.
 */
function lessonFaqs(lesson: PublicLesson, courseModule: LearningModule | undefined): SeoEntry["faqs"] {
  const faqs = [
    {
      question: `What does the "${lesson.title}" lesson cover?`,
      answer: `${lesson.subtitle ?? lesson.title} It runs ${lesson.step_count} interactive steps and takes about ${lesson.estimated_min} minutes.`,
    },
    {
      question: `How long does "${lesson.title}" take?`,
      answer: `About ${lesson.estimated_min} minutes across ${lesson.step_count} steps. Progress is saved after every step, so the lesson can be finished across several sittings.`,
    },
    {
      question: "Do I need an account to take this lesson?",
      answer:
        "Yes — the interactive version requires a free StackedPoker account so your progress, XP and concept mastery are saved. This page is the free public overview of what the lesson teaches.",
    },
  ];

  if (courseModule) {
    faqs.push({
      question: `Which module is "${lesson.title}" part of?`,
      answer: `It is part of ${courseModule.title}${courseModule.subtitle ? ` — ${courseModule.subtitle}` : ""}. ${courseModule.description}`,
    });
  }
  return faqs;
}

/** Builds the public SEO entry for one lesson. */
export function lessonEntry(lesson: PublicLesson): SeoEntry {
  const courseModule = moduleForLesson(lesson);
  const explainers = lesson.concept_ids
    .map(conceptExplainer)
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const objectives = lesson.concept_ids.map(conceptTitle);

  const body: SeoEntry["body"] = [
    {
      heading: `What "${lesson.title}" teaches`,
      paragraphs: [
        lesson.subtitle ?? `${lesson.title} is an interactive StackedPoker lesson.`,
        courseModule
          ? `It sits inside ${courseModule.title}: ${courseModule.description}`
          : "",
      ].filter(Boolean),
    },
    {
      heading: "What you'll learn",
      bullets: objectives,
    },
  ];

  // Theory preview — only for concepts that already have a written
  // explanation in the theory registry. Lessons whose concepts are not in the
  // registry simply get no preview section rather than invented filler.
  if (explainers.length) {
    body.push({
      heading: "Theory preview",
      definitions: explainers.slice(0, 3).map((e) => ({
        term: e.name,
        description: e.beginner,
      })),
    });
    const example = explainers.find((e) => e.examples.length)?.examples[0];
    if (example) {
      body.push({
        heading: "Worked example",
        paragraphs: [example],
      });
    }
  }

  body.push({
    heading: "How the interactive lesson works",
    paragraphs: [
      `The full lesson is ${lesson.step_count} steps long. Each step asks you to commit to a decision before the answer is revealed, then explains why the correct line works — the reveal is what makes the concept stick.`,
      "Create a free account to play through it and keep your progress, XP and concept mastery.",
    ],
  });

  const entry: SeoEntry = {
    kind: "lesson",
    slug: lesson.slug,
    path: lessonPath(lesson.slug),
    title: lesson.title,
    summary:
      lesson.subtitle ??
      `A ${lesson.estimated_min}-minute interactive StackedPoker lesson on ${lesson.title.toLowerCase()}.`,
    status: "published",
    tags: [...lesson.concept_ids, "poker lesson", courseModule?.title ?? ""].filter(Boolean),
    clusters: clustersForModule(courseModule?.slug),
    body,
    faqs: lessonFaqs(lesson, courseModule),
    relatedPaths: courseModule ? [coursePath(courseModule.slug)] : [],
    priority: 0.7,
    changeFrequency: "monthly",
    sourceNote:
      "Lesson metadata and objectives come from the StackedPoker curriculum; any theory shown is quoted from the StackedPoker concept registry.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
    difficulty:
      (courseModule?.difficulty as ContentDifficulty | undefined) ??
      DIFFICULTY_BY_TYPE[lesson.lesson_type] ??
      "intermediate",
    relatedModuleSlug: courseModule?.slug,
  };

  return entry;
}

/** Builds the public course entry for one module. */
export function courseEntry(courseModule: LearningModule): SeoEntry {
  const lessons = (LESSONS_BY_MODULE[courseModule.id] ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const totalMin = lessons.reduce((sum, l) => sum + l.estimated_min, 0);

  const body: SeoEntry["body"] = [
    {
      heading: `What ${courseModule.title} covers`,
      paragraphs: [courseModule.description, courseModule.subtitle ?? ""].filter(Boolean),
    },
  ];

  if (courseModule.learningObjectives?.length) {
    body.push({ heading: "Learning objectives", bullets: courseModule.learningObjectives });
  }

  body.push({
    heading: "Lessons in this module",
    definitions: lessons.map((l) => ({
      term: l.title,
      description: l.subtitle ?? `${l.step_count} interactive steps, about ${l.estimated_min} minutes.`,
    })),
  });

  body.push({
    heading: "Key takeaway",
    paragraphs: [
      `${courseModule.title} is ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} and roughly ${totalMin} minutes of interactive work. ${courseModule.description}`,
    ],
  });

  const entry: SeoEntry = {
    kind: "course",
    slug: courseModule.slug,
    path: coursePath(courseModule.slug),
    title: courseModule.title,
    summary: courseModule.subtitle ?? courseModule.description,
    status: "published",
    tags: [...courseModule.concept_ids, "poker course", "poker training"],
    clusters: clustersForModule(courseModule.slug),
    body,
    faqs: [
      {
        question: `What is the ${courseModule.title} courseModule?`,
        answer: `${courseModule.description} It contains ${lessons.length} interactive lesson${lessons.length === 1 ? "" : "s"} and takes about ${totalMin} minutes to complete.`,
      },
      {
        question: `How long does ${courseModule.title} take?`,
        answer: `About ${totalMin} minutes in total, split across ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} you can take one at a time.`,
      },
      {
        question: `Is ${courseModule.title} free?`,
        answer:
          courseModule.access === "premium"
            ? "The first lesson of this module is free on every account; the rest is included in StackedPoker Plus and Elite."
            : "Yes — this module is included on the free StackedPoker plan.",
      },
    ],
    relatedPaths: lessons.map((l) => lessonPath(l.slug)),
    priority: 0.8,
    changeFrequency: "monthly",
    sourceNote: "Module structure and lesson list come from the StackedPoker curriculum.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
    difficulty: courseModule.difficulty as ContentDifficulty | undefined,
    relatedModuleSlug: courseModule.slug,
  };

  return entry;
}

let lessonCache: SeoEntry[] | null = null;
let courseCache: SeoEntry[] | null = null;

export function lessonEntries(): SeoEntry[] {
  lessonCache ??= publishedLessons().map(lessonEntry);
  return lessonCache;
}

export function courseEntries(): SeoEntry[] {
  courseCache ??= publishedModules().map(courseEntry);
  return courseCache;
}

export function lessonEntryBySlug(slug: string): SeoEntry | undefined {
  return lessonEntries().find((e) => e.slug === slug);
}

export function courseEntryBySlug(slug: string): SeoEntry | undefined {
  return courseEntries().find((e) => e.slug === slug);
}

export { MODULES_BY_SLUG, LESSONS_BY_MODULE };

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetLessonCaches(): void {
  lessonCache = null;
  courseCache = null;
}
