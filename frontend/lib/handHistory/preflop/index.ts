/**
 * Preflop check: did Hero play the spot the way the Preflop Trainer's ranges
 * say? Three steps, each its own file so new spots slot in:
 *
 *   spots.ts   recognise the spot (now: raise first in)
 *   lookup.ts  find the trainer's range for it
 *   grade.ts   grade Hero's action with the trainer's rules
 *
 * To add a spot (vs an open, 3-bet, squeeze): add its kind in types.ts, a
 * finder in spots.ts, a lookup in lookup.ts, and a branch in checkPreflop.
 */

import { MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { displayPos } from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import type { ParsedHand } from "../types";
import { gradeAction } from "./grade";
import { lookupRfi, rangeFrequencies } from "./lookup";
import { findRfiSpot } from "./spots";
import type { PreflopCheck, PreflopDetail, PreflopVerdict } from "./types";

export * from "./types";
export { findRfiSpot, handClass } from "./spots";
export { lookupRfi, rangePosition } from "./lookup";
export { gradeAction } from "./grade";

/** Bump when the check's own logic changes; range edits are picked up by the hash. */
const CHECK_LOGIC_VERSION = 1;

/**
 * Stored with every result. When the trainer's range JSON or this logic
 * changes, the stored version no longer matches and the hand is re-checked.
 */
export const PREFLOP_CHECK_VERSION = `${CHECK_LOGIC_VERSION}-${fnv1a(JSON.stringify([MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS]))}`;

/** Null when Hero's preflop spot is not one the trainer has ranges for. */
export function checkPreflop(hand: ParsedHand): PreflopCheck | null {
  const spot = findRfiSpot(hand);
  if (!spot) return null;

  const found = lookupRfi(spot);
  if (!found.ok) {
    const detail: PreflopDetail = { spot, range: null, freqs: null, expected: null, reason: found.reason };
    return { verdict: "niet_beoordeeld", detail };
  }
  const freqs = rangeFrequencies(found.scenario, spot.hand);
  const { verdict, expected } = gradeAction(freqs, spot.action);
  return { verdict, detail: { spot, range: found.ref, freqs, expected } };
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const VERDICT_LABEL: Record<PreflopVerdict, string> = {
  correct: "Correct",
  te_los: "Te los",
  te_strak: "Te strak",
  verkeerde_actie: "Verkeerde actie",
  gemengd: "Gemengd",
  niet_beoordeeld: "Niet beoordeeld",
};

export const ACTION_LABEL: Record<RangeActionKey, string> = {
  fold: "fold",
  limp: "limp",
  raise: "open-raise",
  allin: "all-in",
  call: "call",
};

function fmtBbNl(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString("nl-NL")} BB`;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** "Volgens je range: BTN, 15 BB, A5o → fold. Jij: open-raise 2 BB." */
export function describeCheck(c: PreflopCheck): { range: string; hero: string; mix: string | null } {
  const { spot, range, freqs, expected, reason } = c.detail;
  const heroSize = spot.sizeBb && spot.action !== "fold" && spot.action !== "limp" ? ` ${fmtBbNl(spot.sizeBb)}` : "";
  const hero = `Jij: ${ACTION_LABEL[spot.action]}${spot.action === "raise" ? heroSize : ""}.`;
  if (!range || !freqs || !expected) {
    return { range: `Niet beoordeeld: ${reason ?? "geen passende range."}`, hero, mix: null };
  }
  const played = (Object.entries(freqs) as [RangeActionKey, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const mix = played.length > 1 ? played.map(([k, v]) => `${ACTION_LABEL[k]} ${pct(v)}`).join(" · ") : null;
  return {
    range: `Volgens je range: ${displayPos(range.position)}, ${range.bucket} BB, ${spot.hand} → ${ACTION_LABEL[expected]}.`,
    hero,
    mix,
  };
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
