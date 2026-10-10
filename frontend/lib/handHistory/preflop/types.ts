/**
 * Preflop check — data model. A check runs three steps (index.ts):
 * recognise the spot (spots.ts) → find the trainer's range (lookup.ts) →
 * grade Hero's action against it (grade.ts).
 */

import type { RangeActionKey } from "@/lib/ranges/types";

export type PreflopVerdict = "correct" | "te_los" | "te_strak" | "verkeerde_actie" | "gemengd" | "niet_beoordeeld";

export const PREFLOP_VERDICTS: PreflopVerdict[] = [
  "te_los",
  "te_strak",
  "verkeerde_actie",
  "gemengd",
  "correct",
  "niet_beoordeeld",
];
export const PREFLOP_ERRORS: PreflopVerdict[] = ["te_los", "te_strak", "verkeerde_actie"];

/** The kinds of spot the check knows. Add "vs_open", "3bet", "squeeze", … here. */
export type PreflopSpotKind = "rfi";

export type HeroPreflopAction = "fold" | "limp" | "raise" | "allin";

/** A recognised spot, before any range is involved. */
export interface PreflopSpot {
  kind: PreflopSpotKind;
  /** Position label at this table (lib/replay/positions.ts naming), e.g. "UTG". */
  tablePosition: string;
  /** Players still to act after Hero, blinds included. */
  playersBehind: number;
  /** min(Hero's stack, biggest stack still to act) at the start of the hand, in BB. */
  effStackBb: number;
  /** "AQo", "JJ", "T9s". */
  hand: string;
  action: HeroPreflopAction;
  /** Raise-to size in BB (raise and all-in by raising). */
  sizeBb?: number;
}

/** Which trainer chart a spot was graded against. */
export interface RangeRef {
  kind: "open" | "pushfold";
  /** Chart position in the trainer's 9-max naming ("UTG+1", "BN", …). */
  position: string;
  /** Stack bucket in BB the effective stack was rounded to. */
  bucket: number;
  page: number;
  hr: string;
}

export interface PreflopDetail {
  spot: PreflopSpot;
  range: RangeRef | null;
  /** Frequency per action for Hero's hand (0–1), as the trainer computes it. */
  freqs: Partial<Record<RangeActionKey, number>> | null;
  /** The range's most frequent action — what Hero "should" have done. */
  expected: RangeActionKey | null;
  /** Why the spot could not be graded (niet_beoordeeld). */
  reason?: string;
}

export interface PreflopCheck {
  verdict: PreflopVerdict;
  detail: PreflopDetail;
}
