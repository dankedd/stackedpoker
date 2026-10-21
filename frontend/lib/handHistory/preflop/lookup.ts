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

import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { frequencies, type Scenario } from "@/lib/ranges/logic";
import type { DefenseChart, RangeActionKey } from "@/lib/ranges/types";
import { CHART_SPOT, type DefenseSpotKind, type NotEvaluatedReason, type PreflopSpot, type RangeRef } from "./types";

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

// ── Defense charts ───────────────────────────────────────────────────────────

/**
 * Defense stack window. Below ~10bb the trainer only has push/fold opens, and
 * its shallowest defense charts are 15bb; deeper than 70bb is past its 60bb charts.
 * Cash charts are all 100bb.
 */
export const MIN_DEFENSE_STACK_BB = 10.5;
const CASH_STACK_WINDOW: [number, number] = [50, 150];

/**
 * The trainer's DefenseChart for a defense spot — exact hero and villain
 * positions (9-max naming, as for the RFI check) and chart spot only. A spot
 * whose position pair has no chart is not graded: the nearest chart would be
 * a different spot.
 */
export function lookupDefense(spot: PreflopSpot, group: "mtt" | "cash"): LookupResult {
  const kind = spot.kind as DefenseSpotKind;
  const hero = spot.position ?? null;
  const vil = spot.villain?.position ?? null;
  if (!hero || !vil) {
    return { ok: false, reason: { code: "no_defense_chart", kind, hero, vil }, position: hero };
  }
  const pool = DEFENSE_CHARTS.filter((c) => c.group === group && c.spot === CHART_SPOT[kind] && c.hero === hero && c.vil === vil);
  if (!pool.length) return { ok: false, reason: { code: "no_defense_chart", kind, hero, vil }, position: hero };

  const eff = spot.effStackBb;
  if (group === "mtt" && eff > MAX_GRADED_STACK_BB) return { ok: false, reason: { code: "too_deep", effStackBb: Math.round(eff) }, position: hero };
  if (group === "mtt" && eff < MIN_DEFENSE_STACK_BB) return { ok: false, reason: { code: "too_short", effStackBb: Math.round(eff * 10) / 10 }, position: hero };
  if (group === "cash" && eff > CASH_STACK_WINDOW[1]) return { ok: false, reason: { code: "too_deep", effStackBb: Math.round(eff) }, position: hero };
  if (group === "cash" && eff < CASH_STACK_WINDOW[0]) return { ok: false, reason: { code: "too_short", effStackBb: Math.round(eff * 10) / 10 }, position: hero };

  // Nearest stack bucket (ties go deeper), then — when the charts print an open size — the nearest size.
  const stack = pool.map((c) => c.stack).reduce((b, s) => {
    const d = Math.abs(s - eff) - Math.abs(b - eff);
    return d < 0 || (d === 0 && s > b) ? s : b;
  });
  const atStack = pool.filter((c) => c.stack === stack);
  const sizeOf = (c: DefenseChart) => (c.size ? parseFloat(c.size) : NaN);
  const want = spot.villain?.sizeBb ?? NaN;
  const chart = atStack.reduce((b, c) =>
    Number.isFinite(sizeOf(c)) && Number.isFinite(want) && Math.abs(sizeOf(c) - want) < Math.abs(sizeOf(b) - want) ? c : b,
  );

  return {
    ok: true,
    ref: { kind: "defense", position: hero, bucket: chart.stack, page: chart.page, hr: `Hand Range ${chart.n}`, n: chart.n, vil, spot: chart.spot, group, size: chart.size },
    scenario: { type: "def", kind: "freq", chart, stack: chart.stack, fmt: group, hero, vil, spot: chart.spot },
  };
}

/**
 * Hero's action as a key of this chart. Where the chart only has one kind of
 * raise, a raise and an all-in are the same move (a 25bb 3-bet is all-in):
 * the same rule the villain range uses (villain/index.ts).
 */
export function chartActionKey(scenario: Scenario, action: PreflopSpot["action"]): RangeActionKey {
  if (scenario.type !== "def") return action;
  const keys = scenario.chart.actions.map((a) => a.key as RangeActionKey);
  if (action === "raise" && !keys.includes("raise") && keys.includes("allin")) return "allin";
  if (action === "allin" && !keys.includes("allin") && keys.includes("raise")) return "raise";
  return action;
}
