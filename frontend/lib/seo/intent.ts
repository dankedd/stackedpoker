import { hubPathForKind } from "./content";
import type { SeoEntry } from "./types";

/**
 * Search intent, derived per URL (§1).
 *
 * Derived rather than authored: a `kind` plus its cluster already says what a
 * page is for, and hand-labelling 200 URLs would rot the first time content
 * was added. Only genuine exceptions are declared, and each one says why.
 *
 * The four classes are the standard ones, used here with poker meanings:
 *
 *   informational  "what is a c-bet"          — the wiki and glossary
 *   transactional  "poker equity calculator"  — the tools; the user wants to DO something
 *   commercial     "best poker training site" — comparing before choosing
 *   navigational   "stackedpoker login"       — already knows where they are going
 *
 * Intent drives two things that matter: the opportunity score (commercial
 * intent is worth more per visit than informational) and the internal-link
 * ordering (a reader on an informational page should be offered the
 * transactional page next, not another definition).
 */

export type SearchIntent = "informational" | "transactional" | "commercial" | "navigational";

export const INTENT_WEIGHT: Record<SearchIntent, number> = {
  // Not a claim about traffic volume — a claim about what a visit is worth to
  // a learning product. Someone comparing platforms is one decision away from
  // signing up; someone looking up a definition is many.
  commercial: 1,
  transactional: 0.85,
  informational: 0.6,
  navigational: 0.2,
};

/**
 * Pages whose intent their `kind` gets wrong.
 *
 * Kept deliberately short. Every entry is a page whose URL and content serve a
 * different job from the rest of its kind — not a place to hand-tune scores.
 */
const INTENT_OVERRIDES: Record<string, SearchIntent> = {
  // Marketing pages: the visitor is choosing a product, not learning poker.
  "/": "commercial",
  "/poker-training": "commercial",
  "/pricing": "commercial",
  "/courses": "commercial",
  // Legal pages are reached deliberately or not at all.
  "/privacy": "navigational",
  "/terms": "navigational",
  // The topics hub is a directory of this site, not an answer to a question.
  "/search": "navigational",
};

const INTENT_BY_KIND: Record<SeoEntry["kind"], SearchIntent> = {
  wiki: "informational",
  glossary: "informational",
  blog: "informational",
  lesson: "informational",
  // A course page is where someone decides whether to spend time (and money)
  // on a curriculum — that is a comparison, not a lookup.
  course: "commercial",
  tool: "transactional",
  search: "informational",
  page: "navigational",
};

export function intentOf(entry: SeoEntry): SearchIntent {
  return INTENT_OVERRIDES[entry.path] ?? INTENT_BY_KIND[entry.kind];
}

/**
 * The question a page exists to answer, in the user's words (§4).
 *
 * Built from the entry rather than authored, so it cannot drift from the
 * page. Used by the audit report to make "does this page answer its question
 * immediately?" a question a human can check at a glance.
 */
export function primaryQuestion(entry: SeoEntry): string {
  const name = entry.title.replace(/\s*[—–-]\s.*$/, "").replace(/\s*\(.*\)\s*$/, "");
  switch (entry.kind) {
    case "wiki":
      return `What is ${name.toLowerCase()} in poker, and when does it matter?`;
    case "glossary":
      return `What does this poker term mean?`;
    case "tool":
      return `Work out ${name.toLowerCase().replace(/^poker\s+/, "").replace(/\s*calculator$/, "")} for my own numbers.`;
    case "lesson":
      return `How do I actually play ${name.toLowerCase()}?`;
    case "course":
      return `Is ${name} worth my time, and what will I be able to do afterwards?`;
    case "blog":
      return name;
    case "search":
      return `What does StackedPoker have on this topic?`;
    default:
      return `What is ${name}?`;
  }
}

/**
 * Where a page sits in the learning funnel, 0 (first contact) to 3 (decision).
 *
 * Used to order internal links so they move a reader FORWARD — a definition
 * should offer the drill, and the drill should offer the curriculum, rather
 * than every page offering every other page.
 */
export function funnelStage(entry: SeoEntry): number {
  switch (entry.kind) {
    case "glossary":
      return 0;
    case "wiki":
    case "blog":
    case "search":
      return 1;
    case "tool":
    case "lesson":
      return 2;
    case "course":
      return 3;
    default:
      return hubPathForKind(entry.kind) ? 1 : 3;
  }
}
