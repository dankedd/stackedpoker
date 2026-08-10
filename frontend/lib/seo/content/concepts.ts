import {
  CONCEPT_SUMMARIES,
  getAllConcepts,
  getConcept,
  PUZZLE_TAG_REGISTRY,
} from "@/lib/theory";
import type { PokerConcept, PuzzleTagMetadata } from "@/lib/theory/types";

/**
 * The bridge between StackedPoker's existing poker-theory data and the public
 * content surfaces.
 *
 * Everything the wiki and glossary say about poker comes through this file,
 * and this file only reads material that already exists in the repository:
 *
 *   - lib/theory/concepts.json      — 19 concepts with beginner / intermediate
 *                                     / advanced explanations, formulas and
 *                                     worked example situations
 *   - lib/theory/puzzleTags.ts      — 50 tagged strategic patterns, each with
 *                                     a one-sentence definition
 *   - lib/theory/index.ts           — CONCEPT_SUMMARIES one-liners
 *
 * Nothing is paraphrased into new strategy claims and nothing is generated.
 * Where a page needs a section this data cannot support, the section is
 * omitted and the gap is surfaced by `missingWikiSources()` rather than
 * filled in — see CLAUDE.md's "never fabricate theory to fill gaps" rule.
 */

export interface ConceptExplainer {
  id: string;
  name: string;
  category: string;
  beginner: string;
  intermediate: string;
  advanced: string;
  formula?: string;
  examples: string[];
  related: string[];
  puzzleTags: string[];
  /** One-line summary, when the registry defines one. */
  summary?: string;
}

/** Full explainer for a theory-registry concept id, or undefined if absent. */
export function conceptExplainer(conceptId: string): ConceptExplainer | undefined {
  const concept = getConcept(conceptId);
  if (!concept) return undefined;
  return toExplainer(concept);
}

function toExplainer(concept: PokerConcept): ConceptExplainer {
  return {
    id: concept.conceptId,
    name: concept.name,
    category: concept.category,
    beginner: concept.explanation.beginner,
    intermediate: concept.explanation.intermediate,
    advanced: concept.explanation.advanced,
    formula: concept.formula,
    examples: concept.exampleSituations ?? [],
    related: concept.relatedConcepts ?? [],
    puzzleTags: concept.puzzleTags ?? [],
    summary: CONCEPT_SUMMARIES[concept.conceptId],
  };
}

export function allConceptExplainers(): ConceptExplainer[] {
  return getAllConcepts().map(toExplainer);
}

/**
 * Human-readable label for ANY concept id, including the ~177 curriculum
 * concept ids that have no registry entry. For those it title-cases the id
 * (`equity_realization` → "Equity realization"), which restates the
 * curriculum's own metadata rather than asserting anything new about poker.
 */
export function conceptTitle(conceptId: string): string {
  const known = getConcept(conceptId);
  if (known) return known.name;
  const words = conceptId.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** First sentence of a block of prose — used for summaries and card text. */
export function firstSentence(text: string): string {
  const match = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (match?.[0] ?? text).trim();
}

// ── Puzzle tags as glossary source ───────────────────────────────────────────

export interface TagDefinition {
  tag: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  relatedConcepts: string[];
}

export function allTagDefinitions(): TagDefinition[] {
  return Object.values(PUZZLE_TAG_REGISTRY).map((meta: PuzzleTagMetadata) => ({
    tag: meta.tag,
    name: meta.displayName,
    description: meta.description,
    category: meta.category,
    difficulty: meta.difficulty,
    relatedConcepts: meta.relatedConcepts ?? [],
  }));
}

export function tagDefinition(tag: string): TagDefinition | undefined {
  const meta = PUZZLE_TAG_REGISTRY[tag as keyof typeof PUZZLE_TAG_REGISTRY];
  if (!meta) return undefined;
  return {
    tag: meta.tag,
    name: meta.displayName,
    description: meta.description,
    category: meta.category,
    difficulty: meta.difficulty,
    relatedConcepts: meta.relatedConcepts ?? [],
  };
}

/**
 * Documented mistake patterns attached to a concept.
 *
 * A concept's own `puzzle_tags`, filtered to the `exploitative` category —
 * i.e. the tags the theory layer already classifies as errors (folding above
 * MDF, calling beyond MDF, deviating from equilibrium). This is a derivation
 * from existing data, not authored advice, which is why the "Common
 * mistakes" section only appears on concepts that actually have such tags.
 */
export function mistakePatternsFor(conceptId: string): TagDefinition[] {
  const concept = getConcept(conceptId);
  if (!concept) return [];
  return concept.puzzleTags
    .map(tagDefinition)
    .filter((t): t is TagDefinition => Boolean(t) && t!.category === "exploitative");
}

/**
 * The situations a concept shows up in — its own `puzzle_tags`, minus the
 * error patterns that `mistakePatternsFor` already renders.
 *
 * Not every id in a concept's `puzzle_tags` is a registered PuzzleTag (the
 * registry and the concept file drifted apart before this code existed), so
 * unresolvable ids are dropped rather than rendered as bare slugs. That is
 * why some articles show this section and some do not: it appears only where
 * there is a real definition behind it.
 */
export function applicationPatternsFor(conceptId: string): TagDefinition[] {
  const concept = getConcept(conceptId);
  if (!concept) return [];
  return concept.puzzleTags
    .map(tagDefinition)
    .filter((t): t is TagDefinition => Boolean(t) && t!.category !== "exploitative");
}
