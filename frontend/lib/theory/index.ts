/**
 * Poker Theory Layer — Public API
 * ================================
 * Central export for the theory intelligence layer.
 */

export * from "./types";
export * from "./math";
export * from "./puzzleTags";

// ─────────────────────────────────────────────────────────────────────────────
// Concept Registry — static JSON, no backend call required
// ─────────────────────────────────────────────────────────────────────────────

import conceptsRaw from "./concepts.json";
import type { PokerConcept, StrategicCategory } from "./types";

// JSON uses snake_case keys (mirrors Python); remap to camelCase for TS consumers.
function _mapConcept(raw: Record<string, unknown>): PokerConcept {
  return {
    conceptId:         raw.concept_id as string,
    name:              raw.name as string,
    category:          raw.category as StrategicCategory,
    tags:              raw.tags as string[],
    relatedConcepts:   raw.related_concepts as string[],
    relatedNodes:      raw.related_nodes as string[],
    relatedBoardTypes: raw.related_board_types as PokerConcept["relatedBoardTypes"],
    explanation:       raw.explanation as PokerConcept["explanation"],
    coachingTags:      raw.coaching_tags as string[],
    puzzleTags:        raw.puzzle_tags as string[],
    solverRelevance:   raw.solver_relevance as string[],
    formula:           raw.formula as string | undefined,
    exampleSituations: raw.example_situations as string[],
  };
}

const _registry: Record<string, PokerConcept> = Object.fromEntries(
  Object.entries(conceptsRaw as Record<string, Record<string, unknown>>).map(
    ([id, raw]) => [id, _mapConcept(raw)]
  )
);

/** Look up a single concept by ID. Returns undefined if not found. */
export function getConcept(id: string): PokerConcept | undefined {
  return _registry[id];
}

/** All concepts as an array. */
export function getAllConcepts(): PokerConcept[] {
  return Object.values(_registry);
}

/** Filter concepts by strategic category. */
export function getConceptsByCategory(category: StrategicCategory): PokerConcept[] {
  return Object.values(_registry).filter((c) => c.category === category);
}

/** Find concepts that include a specific tag string. */
export function getConceptsByTag(tag: string): PokerConcept[] {
  return Object.values(_registry).filter((c) => c.tags.includes(tag));
}

/** Get all concepts related to a given concept ID. */
export function getRelatedConcepts(id: string): PokerConcept[] {
  const concept = _registry[id];
  if (!concept) return [];
  return concept.relatedConcepts.flatMap((rid) =>
    _registry[rid] ? [_registry[rid]] : []
  );
}

// Concept descriptions (human-readable summaries)
export const CONCEPT_SUMMARIES: Record<string, string> = {
  mdf: "Minimum Defense Frequency — how often to defend vs a bet to prevent auto-profitable bluffs.",
  alpha: "Alpha — how often a bluff must succeed to break even (= bet / (bet + pot)).",
  nash_equilibrium: "GTO strategy — unexploitable, maximally exploiting any deviation.",
  indifference: "At equilibrium, bluff frequency makes caller indifferent to calling or folding.",
  equity_realization: "How much of your theoretical equity you capture in practice.",
  spr_theory: "Stack-to-pot ratio determines which hand strengths justify commitment.",
  range_advantage: "Your range has more equity than opponent's on this board.",
  nut_advantage: "You can have the nuts; opponent cannot — enables overbets.",
  capped_range: "Missing strongest hands — vulnerable to large bets.",
  equity_bucket: "EQB: Strong ≥75%, Good 50-74%, Weak 33-49%, Trash <33% equity vs range.",
  cbet_theory: "C-bet strategy: dry boards = merged small; wet boards = polarized large.",
  donk_bet: "OOP leads vs aggressor — valid on low connected boards with nut/range advantage.",
  overbet: "Bet >100% pot — requires nut advantage and polarized range.",
  polarized_betting: "Betting nuts + bluffs at large size; checking medium hands.",
  merged_betting: "Betting most of range at small size — exploits range advantage.",
  geometric_sizing: "Equal fraction per street to go all-in on the river.",
  exploitative_play: "Deviating from GTO to exploit specific opponent tendencies.",
  position_value: "IP realizes ~10% more equity than OOP with symmetric ranges.",
  blockers: "Cards in hand that reduce combos of certain hands villain can have.",
};

// Board family coaching snippets
export const BOARD_COACHING_SNIPPETS: Record<string, string> = {
  A_high_dry: "Ace-high dry board: IP has massive range advantage. C-bet 80%+ with 25-33% pot sizing (merged).",
  A_high_wet: "Ace-high wet board: IP still leads, but charge the draws. C-bet 60-70% with 50-67% sizing.",
  K_high_dry: "King-high dry board: Similar to ace-high dry — high frequency small c-bet.",
  K_high_wet: "King-high wet board: More contested. Polarized c-bet at medium-large sizing.",
  mid_high_dry: "Mid-high dry board: IP moderate advantage. High frequency, small-medium sizing.",
  mid_high_wet: "Mid-high wet board: Contested equity. Balanced approach — check medium hands.",
  low_connected: "Low connected board: OOP (BB) range advantage. Donk bet often dominant (25% pot, wide range).",
  low_paired: "Low paired board: Equity compressed. Kicker and overpairs dominate.",
  paired_board: "Paired board: IP advantage but muted. Small-medium c-bet frequency.",
  monotone: "Monotone board: Flush equity dominant. Check frequently without a flush.",
};

// SPR coaching snippets
export const SPR_COACHING_SNIPPETS: Record<string, string> = {
  micro: "SPR ≤1: Pot-committed. Any pair or reasonable draw justifies calling.",
  low: "SPR 1–5: Top pair top kicker+ commits stacks. Draws need to be strong.",
  medium: "SPR 5–11: Standard SRP. Two pair+ typically commits. SPR dictates pot-plan.",
  high: "SPR 11–20: Sets and better commit. Speculative hands gain value.",
  deep: "SPR 20+: Only the nuts. Implied odds for suited connectors and small pairs.",
};
