/**
 * Poker Theory Type Definitions
 * ===============================
 * Original TypeScript types for the poker intelligence layer.
 * These types mirror the Python theory layer and drive UI/coaching.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Equity Bucket System
// ─────────────────────────────────────────────────────────────────────────────

export type EquityBucket = "strong" | "good" | "weak" | "trash";

export interface EQBThresholds {
  strong: 0.75;
  good: 0.50;
  weak: 0.33;
  trash: 0.0;
}

export interface EQBDistribution {
  strongPct: number;  // fraction ≥75% equity
  goodPct: number;    // fraction 50–74%
  weakPct: number;    // fraction 33–49%
  trashPct: number;   // fraction <33%
}

export interface EQBStrategyNote {
  bucket: EquityBucket;
  preferredAction: "bet_or_raise" | "bet_or_call" | "check_or_call" | "fold_or_bluff";
  sizingPreference: string;
  rationale: string;
  coachingTag: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPR Theory
// ─────────────────────────────────────────────────────────────────────────────

export type SPRZone = "micro" | "low" | "medium" | "high" | "deep";

export interface SPRGuidelines {
  zone: SPRZone;
  sprRange: [number, number];
  description: string;
  commitmentThreshold: string;
  preferredHandTypes: string[];
  underperformingTypes: string[];
  betSizePreference: string;
  keyConcept: string;
  coachingTag: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Range Morphology
// ─────────────────────────────────────────────────────────────────────────────

export type RangeMorphology =
  | "linear"
  | "polarized"
  | "condensed"
  | "capped"
  | "uncapped"
  | "merged";

export interface RangeMorphologyProfile {
  morphology: RangeMorphology;
  description: string;
  nutPresence: "present" | "absent" | "limited";
  airPresence: "present" | "absent" | "limited";
  bettingStyle: string;
  typicalSpot: string;
  coachingImplication: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Board Theory
// ─────────────────────────────────────────────────────────────────────────────

export type BoardFamily =
  | "A_high_dry"
  | "A_high_wet"
  | "K_high_dry"
  | "K_high_wet"
  | "mid_high_dry"
  | "mid_high_wet"
  | "low_connected"
  | "low_paired"
  | "paired_board"
  | "monotone";

export type DonkBetFrequencyClass = "none" | "low" | "mid" | "high";

export interface BoardTextureProfile {
  family: BoardFamily;
  description: string;
  ipCbetFrequency: string;
  ipCbetSize: string;
  ipCbetRationale: string;
  oopDonkFrequency: string;
  oopDonkRationale: string;
  rangeAdvantage: "ip_strong" | "ip_moderate" | "neutral" | "oop_moderate";
  nutAdvantage: "ip" | "oop" | "neutral";
  keyConcept: string;
  coachingTags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Library
// ─────────────────────────────────────────────────────────────────────────────

export type PotType = "srp" | "3bet" | "4bet";
export type StackDepth = "short" | "medium" | "deep" | "very_deep";
export type PositionAdvantage = "ip" | "oop";

export interface NodeRangeProfile {
  morphology: RangeMorphology;
  approximatePct: number;
  nutPresence: boolean;
  keyHands: string[];
  description: string;
}

export interface PokerNode {
  nodeId: string;
  label: string;
  potType: PotType;
  stackDepth: StackDepth;
  ipPosition: string;
  oopPosition: string;
  aggressor: string;
  ipRange: NodeRangeProfile;
  oopRange: NodeRangeProfile;
  rangeAdvantageHolder: PositionAdvantage;
  nutAdvantageHolder: PositionAdvantage;
  recommendedIpSizing: string;
  recommendedOopSizing: string;
  keyConcept: string;
  coachingTags: string[];
  typicalSprRange: [number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// MDF / Alpha Mathematics
// ─────────────────────────────────────────────────────────────────────────────

export interface AlphaMdfResult {
  betFraction: number;       // bet as fraction of pot
  alpha: number;             // required fold frequency for bluff to break even
  mdf: number;               // minimum defense frequency
  bluffFraction: number;     // fraction of betting range that should be bluffs
  valueFraction: number;     // fraction of betting range that should be value
  bluffToValueLabel: string; // e.g. "1 bluff : 2 value"
}

export type BetSizeLabel =
  | "25%_pot"
  | "33%_pot"
  | "50%_pot"
  | "67%_pot"
  | "75%_pot"
  | "pot"
  | "1.5x_pot"
  | "2x_pot"
  | "all_in";

// ─────────────────────────────────────────────────────────────────────────────
// Concept Registry
// ─────────────────────────────────────────────────────────────────────────────

export type StrategicCategory =
  | "game_theory"
  | "preflop"
  | "postflop"
  | "hand_reading"
  | "bet_sizing"
  | "ranges"
  | "position"
  | "tournament"
  | "equity"
  | "exploitative"
  | "mental_game";

export interface ConceptExplanation {
  beginner: string;
  intermediate: string;
  advanced: string;
}

export interface PokerConcept {
  conceptId: string;
  name: string;
  category: StrategicCategory;
  tags: string[];
  relatedConcepts: string[];
  relatedNodes: string[];
  relatedBoardTypes: BoardFamily[];
  explanation: ConceptExplanation;
  coachingTags: string[];
  puzzleTags: string[];
  solverRelevance: string[];
  formula?: string;
  exampleSituations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Puzzle Tagging System
// ─────────────────────────────────────────────────────────────────────────────

export type PuzzleTag =
  // Range & equity
  | "range_advantage"
  | "nut_advantage"
  | "capped_range"
  | "bluff_catcher"
  | "equity_realization"
  // Board texture
  | "dry_board"
  | "wet_board"
  | "low_connected_board"
  | "ace_high_board"
  | "paired_board"
  | "monotone_board"
  // Betting concepts
  | "merged_cbet"
  | "polarized_cbet"
  | "donk_bet"
  | "check_raise"
  | "overbet_spot"
  | "delayed_cbet"
  | "geometric_sizing"
  // MDF / alpha
  | "MDF_pressure"
  | "alpha_calculation"
  | "fold_too_much"
  | "call_too_much"
  // SPR
  | "spr_commitment"
  | "low_spr_top_pair"
  | "high_spr_nuttiness"
  // Draws
  | "semi_bluff"
  | "flush_draw"
  | "oesd"
  | "gutshot"
  | "backdoor_draw"
  | "combo_draw"
  // Position
  | "ip_advantage"
  | "oop_challenge"
  | "bvb_dynamics"
  // Preflop
  | "rfi_spot"
  | "3bet_spot"
  | "4bet_spot"
  | "squeeze_spot"
  | "cold_call"
  | "steal_spot"
  | "push_fold"
  // Exploit
  | "exploit_spot"
  | "leak_detection"
  | "gto_deviation"
  // Tournament
  | "icm_pressure"
  | "bubble_factor"
  // Strategy quality
  | "value_bet_strong"
  | "thin_value"
  | "bluff_candidate"
  | "showdown_value"
  | "pot_control";

export interface PuzzleTagMetadata {
  tag: PuzzleTag;
  category: StrategicCategory;
  displayName: string;
  description: string;
  relatedConcepts: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
}

// ─────────────────────────────────────────────────────────────────────────────
// Coaching Enrichment
// ─────────────────────────────────────────────────────────────────────────────

export interface TheoryEnrichedAnalysis {
  detectedBoardFamily: BoardFamily;
  boardProfile: BoardTextureProfile;
  detectedNode: PokerNode | null;
  sprZone: SPRZone;
  sprGuidelines: SPRGuidelines;
  equityBucket: EquityBucket;
  alphaAtCurrentBet: number | null;
  mdfAtCurrentBet: number | null;
  relevantConcepts: PokerConcept[];
  puzzleTags: PuzzleTag[];
  coachingTags: string[];
  rangeNotes: string;
  theoryWarnings: string[];
}
