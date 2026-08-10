import { AUTHORITY_TEAM, DEFAULT_CONTENT_DATE } from "../config";
import { readingTimeMin } from "../reading";
import { glossaryLetterPath, lessonPath, ROUTES, toSlug } from "../routes";
import type { SeoEntry } from "../types";
import {
  allConceptExplainers,
  allTagDefinitions,
  firstSentence,
  type TagDefinition,
} from "./concepts";
import { lessonsForConceptKey } from "./lessons";
import { wikiPathForConceptId } from "./wiki";

/**
 * The alphabetical glossary (§6).
 *
 * Terms come from the two existing definition sources in the repo:
 *   - the 19 theory-registry concepts (rich: explanation + formula + examples)
 *   - the 50 puzzle tags (one precise sentence each)
 *
 * Terms are rendered in full on their letter page rather than each getting
 * its own URL. A one-sentence definition on a dedicated page is thin content
 * that competes with the wiki article on the same term; grouping them keeps
 * every glossary URL substantial and every term one hop from a real article.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** The definition, verbatim from its source. */
  definition: string;
  /** A worked example, when the source provides one. */
  example?: string;
  category: string;
  difficulty?: string;
  /** Deep link to the full wiki article, when one is published. */
  wikiPath?: string;
  /** Lessons that teach this term. */
  lessonPaths: { title: string; path: string }[];
  relatedTerms: string[];
  source: "concept-registry" | "puzzle-tag-registry";
}

function relatedLessonLinks(key: string) {
  return lessonsForConceptKey(key, 3).map((l) => ({ title: l.title, path: lessonPath(l.slug) }));
}

function buildTerms(): GlossaryTerm[] {
  const bySlug = new Map<string, GlossaryTerm>();

  // Concept-registry terms first — they carry the most content, and win any
  // slug collision with a puzzle tag describing the same idea.
  for (const concept of allConceptExplainers()) {
    const slug = toSlug(concept.name.replace(/\s*[—–-]\s.*$/, ""));
    bySlug.set(slug, {
      slug,
      term: concept.name,
      definition: concept.summary ?? firstSentence(concept.beginner),
      example: concept.examples[0],
      category: concept.category,
      wikiPath: wikiPathForConceptId(concept.id),
      lessonPaths: relatedLessonLinks(concept.id),
      relatedTerms: concept.related,
      source: "concept-registry",
    });
  }

  for (const tag of allTagDefinitions() as TagDefinition[]) {
    const slug = toSlug(tag.name);
    if (bySlug.has(slug)) continue;
    bySlug.set(slug, {
      slug,
      term: tag.name,
      definition: tag.description,
      category: tag.category,
      difficulty: tag.difficulty,
      wikiPath: tag.relatedConcepts.map(wikiPathForConceptId).find(Boolean),
      lessonPaths: relatedLessonLinks(tag.tag),
      relatedTerms: tag.relatedConcepts,
      source: "puzzle-tag-registry",
    });
  }

  return [...bySlug.values()].sort((a, b) => a.term.localeCompare(b.term));
}

let termCache: GlossaryTerm[] | null = null;

export function glossaryTerms(): GlossaryTerm[] {
  termCache ??= buildTerms();
  return termCache;
}

/**
 * The bucket a term belongs to.
 *
 * Terms starting with a digit ("3-Bet Spot", "4-Bet Spot") bucket under
 * "0-9" rather than "#": the bucket key becomes a URL segment, and "#" would
 * produce `/glossary/#` — a fragment, not a path, so the page would 404 and
 * the sitemap would advertise a broken URL.
 */
export const NUMERIC_BUCKET = "0-9";

export function letterOf(term: string): string {
  const first = term.trim()[0]?.toLowerCase() ?? NUMERIC_BUCKET;
  return /[a-z]/.test(first) ? first : NUMERIC_BUCKET;
}

/** Human-facing label for a bucket key. */
export function letterLabel(letter: string): string {
  return letter === NUMERIC_BUCKET ? NUMERIC_BUCKET : letter.toUpperCase();
}

export function glossaryLetters(): string[] {
  const letters = new Set(glossaryTerms().map((t) => letterOf(t.term)));
  return [...letters].sort();
}

export function termsForLetter(letter: string): GlossaryTerm[] {
  const key = letter.toLowerCase();
  return glossaryTerms().filter((t) => letterOf(t.term) === key);
}

// ── SEO entries ──────────────────────────────────────────────────────────────

function letterEntry(letter: string): SeoEntry {
  const terms = termsForLetter(letter);
  const display = letterLabel(letter);

  const entry: SeoEntry = {
    kind: "glossary",
    slug: letter,
    path: glossaryLetterPath(letter),
    title: `Poker Terms Starting With ${display}`,
    summary: `${terms.length} poker term${terms.length === 1 ? "" : "s"} beginning with ${display}, defined with examples and linked to the lessons that teach them: ${terms
      .slice(0, 4)
      .map((t) => t.term)
      .join(", ")}.`,
    status: "published",
    tags: ["poker glossary", "poker terms", ...terms.slice(0, 12).map((t) => t.term.toLowerCase())],
    clusters: ["glossary"],
    body: [
      {
        heading: `Poker terms beginning with ${display}`,
        definitions: terms.map((t) => ({ term: t.term, description: t.definition })),
      },
    ],
    relatedPaths: [ROUTES.glossary, ROUTES.wiki],
    priority: 0.5,
    changeFrequency: "monthly",
    sourceNote:
      "Definitions are quoted from the StackedPoker poker-theory concept registry and puzzle-tag registry.",
  };

  entry.authority = {
    reviewedBy: AUTHORITY_TEAM,
    updated: DEFAULT_CONTENT_DATE,
    readingTimeMin: readingTimeMin(entry),
  };
  return entry;
}

let entryCache: SeoEntry[] | null = null;

/** One entry per populated letter — empty letters get no URL at all. */
export function glossaryEntries(): SeoEntry[] {
  entryCache ??= glossaryLetters().map(letterEntry);
  return entryCache;
}

export function glossaryEntryForLetter(letter: string): SeoEntry | undefined {
  return glossaryEntries().find((e) => e.slug === letter.toLowerCase());
}

/** Test/build hook — see resetSeoCaches() in lib/seo/content/index.ts. */
export function resetGlossaryCache(): void {
  termCache = null;
  entryCache = null;
}
