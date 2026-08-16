import { expandHandClass } from "@/lib/learn/combos";
import { calculateEquity } from "@/lib/tools/equity";
import type { Card } from "@/lib/tools/cards";
import type { RangePreset } from "./rangePresets";

/**
 * Exact equity against a range.
 *
 * No new equity engine: this walks villain's legal combos and calls the
 * existing exhaustive enumerator (lib/tools/equity.ts) once per combo, then
 * averages the results weighted by how often villain holds each one. Every
 * individual number is the same exhaustive count it always was; the only new
 * arithmetic is the weighted mean, which is why this can ship without a theory
 * citation of its own. The RANGE is the assumption — the maths on top of it is
 * not.
 *
 * COST, and why preflop is excluded
 *
 * The enumerator's cost is (boards for the street) per combo:
 *
 *   flop    990 boards × combos
 *   turn     44 boards × combos
 *   river     1 board  × combos
 *   preflop  1,712,304 boards × combos
 *
 * A typical calling range is a few hundred legal combos. On the flop that is
 * a few hundred thousand board evaluations — a few hundred milliseconds. On
 * the turn and river it is trivial. Preflop it is hundreds of millions, which
 * measured at minutes, so `rangePresets.ts` refuses preflop spots outright
 * rather than shipping something that hangs the tab. That is an honest
 * algorithmic limit, not a missing feature: Monte Carlo would make it fast by
 * making it inexact, and this tool does not trade in approximations it has not
 * declared.
 */

export interface WeightedCombo {
  cards: [Card, Card];
  /** Villain's frequency of holding this combo, from the source chart. */
  weight: number;
}

export interface RangeEquityResult {
  /** Hero's share of the pot against the range, 0–100. */
  heroEquityPct: number;
  /** Combos in the range once hero's cards and the board are removed. */
  combosConsidered: number;
  /** Combos the range contains before removal. */
  combosInRange: number;
  /** Total board evaluations performed — the honest size of the computation. */
  boardsEvaluated: number;
  exact: true;
}

/** Every combo the preset contains, before any card removal. */
export function presetCombos(preset: RangePreset): WeightedCombo[] {
  const combos: WeightedCombo[] = [];
  for (const [hand, weight] of Object.entries(preset.hands)) {
    for (const cards of expandHandClass(hand)) {
      combos.push({ cards: cards as [Card, Card], weight });
    }
  }
  return combos;
}

/**
 * Removes the combos villain cannot hold (§8).
 *
 * Hero's cards and the board are face up as far as this calculation is
 * concerned, so any combo containing one of them is impossible — and dropping
 * them is not a refinement, it is the difference between a correct answer and
 * a wrong one. A hero holding A♠K♠ on a Q♠7♠2♦ board removes a large slice of
 * villain's spades, and a range that still contains them overstates villain's
 * flushes.
 */
export function legalCombos(combos: WeightedCombo[], deadCards: Card[]): WeightedCombo[] {
  const dead = new Set(deadCards);
  return combos.filter((combo) => !dead.has(combo.cards[0]) && !dead.has(combo.cards[1]));
}

export type RangeEquityError =
  | { kind: "preflop-not-supported" }
  | { kind: "no-legal-combos" }
  | { kind: "hero-incomplete" };

/**
 * Runs the calculation.
 *
 * Returns an error rather than throwing for the cases the UI has to explain —
 * a range that is entirely blocked is a real, interesting outcome, not a bug.
 */
export function calculateRangeEquity(
  heroCards: Card[],
  preset: RangePreset,
  board: Card[],
): RangeEquityResult | RangeEquityError {
  if (heroCards.length !== 2) return { kind: "hero-incomplete" };
  if (board.length < 3) return { kind: "preflop-not-supported" };

  const all = presetCombos(preset);
  const legal = legalCombos(all, [...heroCards, ...board]);
  if (!legal.length) return { kind: "no-legal-combos" };

  let weightedEquity = 0;
  let totalWeight = 0;
  let boardsEvaluated = 0;

  for (const combo of legal) {
    const result = calculateEquity(heroCards, [combo.cards[0], combo.cards[1]], board);
    weightedEquity += result.heroEquity * combo.weight;
    totalWeight += combo.weight;
    boardsEvaluated += result.boardsEvaluated;
  }

  return {
    heroEquityPct: (weightedEquity / totalWeight) * 100,
    combosConsidered: legal.length,
    combosInRange: all.length,
    boardsEvaluated,
    exact: true,
  };
}

export function isRangeEquityError(
  result: RangeEquityResult | RangeEquityError,
): result is RangeEquityError {
  return !("heroEquityPct" in result);
}
