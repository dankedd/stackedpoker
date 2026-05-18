/**
 * Canonical Hand Schema — TypeScript mirror of backend/app/models/canonical.py
 *
 * This is the SINGLE SOURCE OF TRUTH for all hand data on the frontend.
 * Every component that displays, edits, or replays a hand uses these types.
 * Schema version: 1.0
 */

// ── Enums / Literals ─────────────────────────────────────────────────────────

export type CanonicalSite =
  | "GGPoker" | "PokerStars" | "Winamax"
  | "PartyPoker" | "WPN" | "Unknown";

export type CanonicalGameType =
  | "NLHE" | "PLO" | "PLO5"
  | "MTT-NLHE" | "MTT-PLO" | "SNG-NLHE" | "SPIN";

export type CanonicalStreetName = "preflop" | "flop" | "turn" | "river";

export type CanonicalActionType =
  | "fold" | "check" | "call" | "bet" | "raise"
  | "post_sb" | "post_bb" | "post_ante" | "post_straddle";

export type CanonicalPosition =
  | "BTN" | "SB" | "BB" | "UTG" | "UTG+1" | "UTG+2" | "LJ" | "HJ" | "CO";

export type ParseSource = "text_history" | "screenshot" | "manual";

export type ValidationSeverity = "error" | "warning";

// ── Cards ─────────────────────────────────────────────────────────────────────

export interface CanonicalCard {
  rank: string;      // "2"-"9", "T", "J", "Q", "K", "A"
  suit: string;      // "c", "d", "h", "s"
  notation: string;  // "Ah", "Td", "2c"
}

/** Parse a card notation string into a CanonicalCard */
export function parseCard(s: string): CanonicalCard {
  if (s.length !== 2) throw new Error(`Invalid card: ${s}`);
  const rank = s[0].toUpperCase();
  const suit = s[1].toLowerCase();
  const validRanks = new Set("23456789TJQKA".split(""));
  const validSuits = new Set(["c","d","h","s"]);
  if (!validRanks.has(rank)) throw new Error(`Invalid rank in card: ${s}`);
  if (!validSuits.has(suit)) throw new Error(`Invalid suit in card: ${s}`);
  return { rank, suit, notation: rank + suit };
}

// ── Stakes ────────────────────────────────────────────────────────────────────

export interface CanonicalStakes {
  small_blind_bb: number;  // always 0.5
  big_blind: number;       // in currency units
  ante_bb: number;
  straddle_bb: number;
  currency: string;        // "USD" | "EUR" | "" | "chips"
  display: string;         // "$0.50/$1.00"
}

// ── Players ───────────────────────────────────────────────────────────────────

export interface CanonicalPlayer {
  id: string;              // "seat_N"
  name: string;
  seat: number;
  position: string;        // canonical position
  stack_bb: number;        // starting stack
  hole_cards: CanonicalCard[];
  is_hero: boolean;
  is_active: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface CanonicalAction {
  sequence: number;
  street: CanonicalStreetName;
  player_id: string;
  player_name: string;
  action: CanonicalActionType;
  amount_bb: number;       // chips put into pot this action
  total_bet_bb: number;    // cumulative total on this street
  is_hero: boolean;
  is_all_in: boolean;
  stack_before_bb: number;
  stack_after_bb: number;
  pot_before_bb: number;
  pot_after_bb: number;
}

// ── Streets ───────────────────────────────────────────────────────────────────

export interface CanonicalStreet {
  name: CanonicalStreetName;
  board_cards: CanonicalCard[];
  pot_start_bb: number;
  actions: CanonicalAction[];
}

// ── Showdown ──────────────────────────────────────────────────────────────────

export interface ShowdownPlayer {
  player_id: string;
  player_name: string;
  cards: CanonicalCard[];
  hand_rank: string;
  hand_description: string;
}

export interface ShowdownResult {
  players: ShowdownPlayer[];
  winners: string[];       // player_ids
  main_pot_bb: number;
  side_pots: Array<{ amount_bb: number; eligible_player_ids: string[] }>;
}

// ── Canonical Hand ────────────────────────────────────────────────────────────

export interface CanonicalHand {
  schema_version: string;  // "1.0"

  // Identity
  hand_id: string;
  site: CanonicalSite;
  game_type: CanonicalGameType | string;
  is_tournament: boolean;

  // Stakes
  stakes: CanonicalStakes;

  // Table
  table_name: string;
  table_max_seats: number;

  // Players
  players: CanonicalPlayer[];
  hero_id: string;

  // Streets
  streets: CanonicalStreet[];

  // Showdown
  showdown: ShowdownResult | null;

  // Computed
  effective_stack_bb: number;
  final_pot_bb: number;

  // Provenance
  parse_source: ParseSource;
  raw_text: string | null;
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ValidationErrorCode =
  | "INVALID_CARD_FORMAT" | "DUPLICATE_CARD"
  | "BOARD_PROGRESSION_SKIP" | "WRONG_BOARD_CARD_COUNT"
  | "HERO_NOT_IN_PLAYERS" | "DUPLICATE_SEAT" | "NEGATIVE_STACK"
  | "TOO_FEW_PLAYERS" | "TOO_MANY_PLAYERS"
  | "HERO_CARDS_MISSING" | "HERO_POSITION_UNKNOWN"
  | "ACTION_OUT_OF_ORDER" | "NEGATIVE_ACTION_AMOUNT"
  | "RAISE_BELOW_MIN" | "ACTION_BY_FOLDED_PLAYER" | "NO_HERO_ACTIONS"
  | "IMPOSSIBLE_POT_SIZE" | "NEGATIVE_STACK_AFTER_ACTION" | "OVERBET_STACK"
  | "MISSING_BIG_BLIND" | "NO_ACTIONS_PARSED" | "EFFECTIVE_STACK_ZERO";

export interface PipelineValidationError {
  code: ValidationErrorCode | string;
  message: string;
  severity: ValidationSeverity;
  field: string | null;
}

export interface PipelineValidationResult {
  valid: boolean;
  can_analyze: boolean;
  errors: PipelineValidationError[];
  warnings: PipelineValidationError[];
  confidence: number;          // 0.0–1.0
  hero_detected_by: string;
}

// ── Pipeline result (prepare endpoint response) ───────────────────────────────

export interface PipelineResult {
  canonical: CanonicalHand;
  validation: PipelineValidationResult;
  parse_diagnostics: Record<string, unknown> | null;
  raw_extracted_entities: Record<string, unknown> | null;
}

// ── Repair UI state ───────────────────────────────────────────────────────────

/** A field the user can edit in the RepairUI */
export interface RepairableField {
  path: string;                // e.g. "players[0].position"
  label: string;               // human-readable label
  current_value: unknown;
  suggested_value: unknown;
  error: PipelineValidationError | null;
  confidence: number;
}

export interface RepairState {
  canonical: CanonicalHand;
  edits: Record<string, unknown>;  // path → new value
  revalidating: boolean;
}

// ── Helper utilities ──────────────────────────────────────────────────────────

/** Get all board cards across all streets as a flat array */
export function getAllBoardCards(hand: CanonicalHand): CanonicalCard[] {
  return hand.streets.flatMap(s => s.board_cards);
}

/** Get the hero player from a canonical hand */
export function getHero(hand: CanonicalHand): CanonicalPlayer | undefined {
  return hand.players.find(p => p.id === hand.hero_id);
}

/** Get all hero actions across all streets */
export function getHeroActions(hand: CanonicalHand): CanonicalAction[] {
  return hand.streets.flatMap(s => s.actions).filter(a => a.is_hero);
}

/** Get a street by name */
export function getStreet(
  hand: CanonicalHand,
  name: CanonicalStreetName,
): CanonicalStreet | undefined {
  return hand.streets.find(s => s.name === name);
}

/** Flatten all actions from all streets */
export function getAllActions(hand: CanonicalHand): CanonicalAction[] {
  return hand.streets.flatMap(s => s.actions);
}

/** Check if a hand has valid analysis data */
export function isAnalyzable(result: PipelineResult): boolean {
  return result.validation.can_analyze;
}

/** Get error count by severity */
export function countErrors(
  validation: PipelineValidationResult,
  severity: ValidationSeverity,
): number {
  const list = severity === "error" ? validation.errors : validation.warnings;
  return list.filter(e => e.severity === severity).length;
}
