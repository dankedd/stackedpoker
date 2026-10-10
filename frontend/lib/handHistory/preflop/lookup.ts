/**
 * Step 2 — find the Preflop Trainer's range for a spot.
 *
 * Reads the trainer's own data (lib/ranges/data.ts → data/ranges/*.json) and
 * computes frequencies with the trainer's own `frequencies`, so changing a
 * range in the trainer changes the analysis too. Nothing here holds a number
 * from a chart.
 *
 * Mapping decisions (implementation choices, not book theory):
 *  - Position: the trainer's MTT charts are 9-max (Modern Poker Theory p.293).
 *    A seat is mapped by how many players are still to act behind it. MPT
 *    p.17–18: with fewer players the early positions "are the first positions
 *    to be removed", so LJ/HJ/CO/BN keep their names and an 8-handed UTG plays
 *    the 9-max UTG+1 range.
 *  - Stack: effective stack in BB, rounded to the nearest bucket the trainer
 *    has for that position (ties go to the deeper one): push/fold 2–10bb, open
 *    charts above that. Up to 70bb uses the 60bb chart; deeper is not graded.
 */

import { MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { frequencies, type Scenario } from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import type { NotEvaluatedReason, PreflopSpot, RangeRef } from "./types";

export const MAX_GRADED_STACK_BB = 70;
const PUSH_FOLD_STACKS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Players still to act behind Hero → 9-max chart position. */
const POSITION_BY_BEHIND: Record<number, string> = {
  1: "SB",
  2: "BN",
  3: "CO",
  4: "HJ",
  5: "LJ",
  6: "UTG+2",
  7: "UTG+1",
  8: "UTG",
};

export function rangePosition(playersBehind: number): string | null {
  return POSITION_BY_BEHIND[playersBehind] ?? null;
}

export type LookupResult =
  | { ok: true; ref: RangeRef; scenario: Scenario }
  | { ok: false; reason: NotEvaluatedReason; position: string | null };

export function lookupRfi(spot: PreflopSpot): LookupResult {
  const position = rangePosition(spot.playersBehind);
  if (!position) {
    return { ok: false, reason: { code: "no_position", playersBehind: spot.playersBehind }, position };
  }
  if (spot.effStackBb > MAX_GRADED_STACK_BB) {
    return { ok: false, reason: { code: "too_deep", effStackBb: Math.round(spot.effStackBb) }, position };
  }

  const open = MTT_OPEN_CHARTS.filter((c) => c.pos === position);
  const pf = PUSH_FOLD_CHARTS.find((c) => c.pos === position);
  const buckets = [
    ...(pf ? PUSH_FOLD_STACKS.map((stack) => ({ stack, kind: "pushfold" as const })) : []),
    ...open.map((c) => ({ stack: c.stack, kind: "open" as const })),
  ];
  if (!buckets.length) return { ok: false, reason: { code: "no_chart", position }, position };

  const eff = spot.effStackBb;
  const best = buckets.reduce((b, c) => {
    const d = Math.abs(c.stack - eff) - Math.abs(b.stack - eff);
    return d < 0 || (d === 0 && c.stack > b.stack) ? c : b;
  });

  if (best.kind === "pushfold" && pf) {
    return {
      ok: true,
      ref: { kind: "pushfold", position, bucket: best.stack, page: pf.page, hr: pf.hr },
      scenario: { type: "open", kind: "pf", chart: pf, stack: best.stack, fmt: "mtt", hero: position, w: 1 },
    };
  }
  const chart = open.find((c) => c.stack === best.stack)!;
  return {
    ok: true,
    ref: { kind: "open", position, bucket: chart.stack, page: chart.page, hr: chart.hr },
    scenario: { type: "open", kind: "freq", chart, stack: chart.stack, fmt: "mtt", hero: position },
  };
}

export function rangeFrequencies(scenario: Scenario, hand: string): Partial<Record<RangeActionKey, number>> {
  return frequencies(scenario, hand);
}
