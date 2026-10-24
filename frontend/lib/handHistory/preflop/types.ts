/**
 * Preflop check — data model. A check runs three steps (index.ts):
 * recognise the spot (spots.ts) → find the trainer's range (lookup.ts) →
 * grade Hero's action against it (grade.ts).
 */

import type { DefenseSpot, RangeActionKey } from "@/lib/ranges/types";

export type PreflopVerdict = "correct" | "too_loose" | "too_tight" | "wrong_action" | "mixed" | "not_evaluated";

export const PREFLOP_VERDICTS: PreflopVerdict[] = [
  "too_loose",
  "too_tight",
  "wrong_action",
  "mixed",
  "correct",
  "not_evaluated",
];
export const PREFLOP_ERRORS: PreflopVerdict[] = ["too_loose", "too_tight", "wrong_action"];

/**
 * The kinds of spot the check knows:
 *  - rfi            everyone before Hero folded
 *  - vs_open        one raise before Hero, no callers
 *  - vs_push        one all-in (or 90%+ of the stack) raise before Hero, no callers
 *  - vs_limp        one limper before Hero, no raise
 *  - vs_4bet        Hero 3-bet an open, the opener 4-bet (or shoved)
 *  - vs_limp_raise  Hero raised a limp, the limper re-raised
 *  - other          Hero faced action no chart covers (squeeze, cold 4-bet,
 *                   several limpers, limp + raise): always not_evaluated
 */
export type PreflopSpotKind = "rfi" | "vs_open" | "vs_push" | "vs_limp" | "vs_4bet" | "vs_limp_raise" | "other";

export const DEFENSE_SPOT_KINDS = ["vs_open", "vs_push", "vs_limp", "vs_4bet", "vs_limp_raise"] as const;
export type DefenseSpotKind = (typeof DEFENSE_SPOT_KINDS)[number];

/** Spot kind → the trainer's DefenseChart `spot`. */
export const CHART_SPOT: Record<DefenseSpotKind, DefenseSpot> = {
  vs_open: "open",
  vs_push: "push",
  vs_limp: "limp",
  vs_4bet: "4bet",
  vs_limp_raise: "lr",
};

/** Overview filter / summary groups ("Spot type"). */
export type SpotGroup = "open" | "vs_open" | "vs_push" | "vs_limp" | "vs_4bet";
export const SPOT_GROUPS: SpotGroup[] = ["open", "vs_open", "vs_push", "vs_limp", "vs_4bet"];
export const SPOT_GROUP_KINDS: Record<SpotGroup, PreflopSpotKind[]> = {
  open: ["rfi"],
  vs_open: ["vs_open"],
  vs_push: ["vs_push"],
  vs_limp: ["vs_limp", "vs_limp_raise"],
  vs_4bet: ["vs_4bet"],
};
export function spotGroup(kind: PreflopSpotKind | null | undefined): SpotGroup | null {
  if (!kind) return null;
  return SPOT_GROUPS.find((g) => SPOT_GROUP_KINDS[g].includes(kind)) ?? null;
}

/** "limp" only first in; "call" only when facing a bet (a check in the BB vs a limp counts as call). */
export type HeroPreflopAction = "fold" | "limp" | "call" | "raise" | "allin";

/** The opponent whose action Hero faces (defense spots). */
export interface SpotVillain {
  name: string;
  /** Position label at this table, e.g. "CO". */
  tablePosition: string;
  /** The trainer's 9-max position, null when it can't be mapped. */
  position: string | null;
  /** Villain's raise-to (or limp) in BB. For vs_4bet / vs_limp_raise: the re-raise. */
  sizeBb: number;
  allIn: boolean;
}

/** A recognised spot, before any range is involved. */
export interface PreflopSpot {
  kind: PreflopSpotKind;
  /** Position label at this table (lib/replay/positions.ts naming), e.g. "UTG". */
  tablePosition: string;
  /** Players still to act after Hero, blinds included. */
  playersBehind: number;
  /**
   * rfi: min(Hero's stack, biggest stack still to act) at the start of the hand.
   * Defense: min(Hero's stack, villain's stack). In BB.
   */
  effStackBb: number;
  /** "AQo", "JJ", "T9s". */
  hand: string;
  action: HeroPreflopAction;
  /** Raise-to size in BB (raise and all-in by raising). */
  sizeBb?: number;
  /** Hero's 9-max chart position (defense spots). */
  position?: string | null;
  villain?: SpotVillain;
  /** "other" spots: what made it unmatched. */
  unmatched?: UnmatchedWhy;
}

export type UnmatchedWhy = "squeeze" | "cold_4bet" | "multi_limp" | "limp_then_raise" | "multi_allin";

/** Which trainer chart a spot was graded against. */
export interface RangeRef {
  kind: "open" | "pushfold" | "defense";
  /** Hero's chart position in the trainer's 9-max naming ("UTG+1", "BN", …). */
  position: string;
  /** Stack bucket in BB the effective stack was rounded to. */
  bucket: number;
  /** Chart id (lib/ranges/types.ts). Checks stored before ids existed lack it and are re-checked. */
  chart?: string;
  /** Defense charts: villain position, chart spot and group. */
  vil?: string;
  spot?: DefenseSpot;
  group?: "mtt" | "cash";
  /** Defense charts with a printed open size ("3.3x"). */
  size?: string | null;
}

/** A second graded decision in the same hand (e.g. the 3-bet before a 4-bet). */
export interface PreflopSubCheck {
  kind: PreflopSpotKind;
  verdict: PreflopVerdict;
  action: HeroPreflopAction;
  expected: RangeActionKey | null;
}

export interface PreflopDetail {
  spot: PreflopSpot;
  range: RangeRef | null;
  /** Frequency per action for Hero's hand (0–1), as the trainer computes it. */
  freqs: Partial<Record<RangeActionKey, number>> | null;
  /** The range's most frequent action — what Hero "should" have done. */
  expected: RangeActionKey | null;
  /** The chart action Hero's action was graded as (a raise in an all-in-only chart counts as all-in). */
  graded?: RangeActionKey;
  /** Why the spot could not be graded (not_evaluated); worded by strings.ts. */
  reason?: NotEvaluatedReason;
  /** The other graded decision of this hand, when Hero acted twice. */
  also?: PreflopSubCheck;
}

export type NotEvaluatedReason =
  | { code: "no_position"; playersBehind: number }
  | { code: "too_deep"; effStackBb: number }
  | { code: "too_short"; effStackBb: number }
  | { code: "no_chart"; position: string }
  | { code: "no_defense_chart"; kind: DefenseSpotKind; hero: string | null; vil: string | null }
  | { code: "unmatched"; why: UnmatchedWhy }
  | { code: "not_in_range" };

export interface PreflopCheck {
  verdict: PreflopVerdict;
  detail: PreflopDetail;
}
