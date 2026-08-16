import { glossaryLetterPath, lessonPath, toolPath, wikiPath } from "@/lib/seo/routes";
import { glossaryTerms, letterOf } from "@/lib/seo/content/glossary";
import { lessonsForConceptKey } from "@/lib/seo/content/lessons";
import { wikiSlugForConceptId } from "@/lib/seo/content/wiki";
import type { PublicLesson } from "@/lib/learn/types";

/**
 * "What to study next" (§8), resolved from the existing content index.
 *
 * Computed on the SERVER at build time and handed to the analyzer widget as a
 * prop. The widget is a client component, and importing the content index into
 * it would pull the whole corpus — curriculum metadata, glossary, wiki, tools —
 * into the browser bundle to produce a handful of links. This map is a few
 * kilobytes and covers every concept the analyser can detect.
 *
 * Nothing here is hardcoded: the wiki article, the lessons and the glossary
 * letter all come from the same registries the rest of the site reads, so a
 * new lesson on a concept appears here with no change to this file.
 */

export interface ConceptLink {
  label: string;
  path: string;
}

export interface ConceptRecommendation {
  conceptId: string;
  /** The authoritative explainer, when one is published. */
  wiki?: ConceptLink;
  /** Lessons that teach it, most relevant first — see `rankLessons`. */
  lessons: ConceptLink[];
  /** The glossary page defining the term. */
  glossary?: ConceptLink;
  /** A calculator that puts the concept to work, where one applies. */
  tool?: ConceptLink;
  /** Why the top lesson is the one being offered. Shown under the CTA. */
  reason?: string;
}

/**
 * Concepts whose maths a shipped calculator already does.
 *
 * Only mapped where the tool genuinely computes THAT concept — a loose
 * association would send a reader to a page that does not answer the question
 * the analysis just raised.
 */
const CONCEPT_TOOLS: Record<string, string> = {
  mdf: "pot-odds-calculator",
  alpha: "pot-odds-calculator",
  equity_bucket: "equity-calculator",
  equity_realization: "equity-calculator",
  position_value: "position-trainer",
  spr_theory: "bankroll-calculator",
};

function glossaryLinkFor(conceptId: string): ConceptLink | undefined {
  const term = glossaryTerms().find(
    (candidate) => candidate.wikiPath === wikiPathFor(conceptId),
  );
  if (!term) return undefined;
  return { label: term.term, path: `${glossaryLetterPath(letterOf(term.term))}#${term.slug}` };
}

function wikiPathFor(conceptId: string): string | undefined {
  const slug = wikiSlugForConceptId(conceptId);
  return slug ? wikiPath(slug) : undefined;
}

/**
 * Ranking (§8), because "the first lesson whose concept ids happen to match"
 * is not a recommendation — it is an accident of registry order.
 *
 * The order of the criteria is the order the brief asks for, and each one is
 * a property of the CONTENT, so nothing here has to be maintained by hand:
 *
 *  1. exact concept      — the lesson lists this concept id verbatim, not a
 *                          token-overlapping cousin like `range_advantage`
 *                          matching `range_advantage_realization`.
 *  2. direct relevance   — the concept is the lesson's FIRST concept id, i.e.
 *                          what the lesson is actually about rather than
 *                          something it touches on the way past.
 *  3. module context     — the lesson sits in the module that teaches this
 *                          concept most, so a reader lands in the right part
 *                          of the curriculum rather than a one-off mention.
 *  4. difficulty         — earlier in the curriculum wins ties, because the
 *                          reader arrived from a free tool and may be new.
 *  5. related concepts   — a lesson that also covers the hand's other detected
 *                          concepts teaches more of this specific hand.
 */
export function rankLessons(conceptId: string, alsoDetected: readonly string[] = []): PublicLesson[] {
  const matches = lessonsForConceptKey(conceptId, 12);
  if (matches.length <= 1) return matches;

  // The module that teaches this concept most often is its home; a lesson
  // elsewhere that merely mentions it should not outrank one from there.
  const moduleTally = new Map<string, number>();
  for (const lesson of matches) {
    moduleTally.set(lesson.module_id, (moduleTally.get(lesson.module_id) ?? 0) + 1);
  }
  const homeModule = [...moduleTally.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];

  const score = (lesson: PublicLesson): number => {
    let points = 0;
    if (lesson.concept_ids.includes(conceptId)) points += 100;
    if (lesson.concept_ids[0] === conceptId) points += 40;
    if (lesson.concept_ids.length) points += Math.round(20 / lesson.concept_ids.length);
    if (lesson.module_id === homeModule) points += 15;
    points += lesson.concept_ids.filter((id) => alsoDetected.includes(id)).length * 5;
    return points;
  };

  return [...matches].sort(
    (a, b) => score(b) - score(a) || a.sort_order - b.sort_order || a.slug.localeCompare(b.slug),
  );
}

/** Why the top lesson is the one on offer — shown next to the CTA. */
function reasonFor(conceptId: string, top: PublicLesson | undefined): string | undefined {
  if (!top) return undefined;
  return top.concept_ids.includes(conceptId)
    ? "This lesson explains the concept that mattered most in your hand."
    : "This is the closest lesson in the curriculum to the concept your hand raised.";
}

export function recommendationFor(
  conceptId: string,
  alsoDetected: readonly string[] = [],
): ConceptRecommendation {
  const slug = wikiSlugForConceptId(conceptId);
  const toolSlug = CONCEPT_TOOLS[conceptId];
  const ranked = rankLessons(conceptId, alsoDetected).slice(0, 3);

  return {
    conceptId,
    ...(slug ? { wiki: { label: "Read the concept", path: wikiPath(slug) } } : {}),
    lessons: ranked.map((lesson) => ({
      label: lesson.title,
      path: lessonPath(lesson.slug),
    })),
    ...(glossaryLinkFor(conceptId) ? { glossary: glossaryLinkFor(conceptId) } : {}),
    ...(toolSlug ? { tool: { label: "Use the calculator", path: toolPath(toolSlug) } } : {}),
    ...(reasonFor(conceptId, ranked[0]) ? { reason: reasonFor(conceptId, ranked[0]) } : {}),
  };
}

/**
 * Every concept the analyser can detect, resolved once.
 *
 * The full id list doubles as the "related concepts" context for each entry:
 * a lesson that covers several of the concepts this analyser surfaces is a
 * better landing place than one that covers exactly one of them in passing.
 */
export function conceptRecommendations(conceptIds: string[]): Record<string, ConceptRecommendation> {
  return Object.fromEntries(conceptIds.map((id) => [id, recommendationFor(id, conceptIds)]));
}

/**
 * The concepts `analyze.ts` can currently emit.
 *
 * Kept beside the detector so the build-time map covers exactly what the
 * runtime can produce — a test asserts the two agree, so a new detection rule
 * cannot ship without its recommendations.
 */
export const DETECTABLE_CONCEPT_IDS = [
  "position_value",
  "mdf",
  "alpha",
  "overbet",
  "cbet_theory",
  "equity_bucket",
  "spr_theory",
] as const;
