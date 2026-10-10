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
import { fmtNum } from "../format";
import { t } from "../strings";
import type { ParsedHand } from "../types";
import { gradeAction } from "./grade";
import { lookupRfi, rangeFrequencies } from "./lookup";
import { findRfiSpot } from "./spots";
import type { NotEvaluatedReason, PreflopCheck, PreflopDetail, PreflopVerdict } from "./types";

export * from "./types";
export { findRfiSpot, handClass } from "./spots";
export { lookupRfi, rangePosition } from "./lookup";
export { gradeAction } from "./grade";

/**
 * Bump when the check's own logic changes; range edits are picked up by the hash.
 * 2: English verdict values and a reason code instead of Dutch text in preflop_detail.
 */
const CHECK_LOGIC_VERSION = 2;

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
    return { verdict: "not_evaluated", detail };
  }
  const freqs = rangeFrequencies(found.scenario, spot.hand);
  const { verdict, expected } = gradeAction(freqs, spot.action);
  return { verdict, detail: { spot, range: found.ref, freqs, expected } };
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const VERDICT_LABEL: Record<PreflopVerdict, string> = t.verdict;

export const ACTION_LABEL = t.preflop.action as Record<RangeActionKey, string>;

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function reasonText(r: NotEvaluatedReason | undefined): string {
  if (!r) return t.preflop.noMatchingRange;
  if (r.code === "no_position") return t.preflop.reason.no_position(r.playersBehind);
  if (r.code === "too_deep") return t.preflop.reason.too_deep(r.effStackBb);
  return t.preflop.reason.no_chart(displayPos(r.position));
}

/** "Your range: BTN, 15 BB, A5o → fold. You: open-raise 2 BB." */
export function describeCheck(c: PreflopCheck): { range: string; hero: string; mix: string | null } {
  const { spot, range, freqs, expected, reason } = c.detail;
  const heroSize = spot.sizeBb && spot.action !== "fold" && spot.action !== "limp" ? ` ${fmtNum(spot.sizeBb, 1)} BB` : "";
  const hero = t.preflop.you(`${ACTION_LABEL[spot.action]}${spot.action === "raise" ? heroSize : ""}`);
  if (!range || !freqs || !expected) {
    return { range: t.preflop.notEvaluated(reasonText(reason)), hero, mix: null };
  }
  const played = (Object.entries(freqs) as [RangeActionKey, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const mix = played.length > 1 ? played.map(([k, v]) => `${ACTION_LABEL[k]} ${pct(v)}`).join(" · ") : null;
  return {
    range: t.preflop.yourRange(displayPos(range.position), range.bucket, spot.hand, ACTION_LABEL[expected]),
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
