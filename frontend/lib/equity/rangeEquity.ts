/**
 * Hero's equity against a weighted range — independent of any UI.
 *
 *   preflop    exact, from the precomputed matchup table (preflopTable.ts)
 *   flop+      exact, enumerating every remaining board with the site's own
 *              evaluator (lib/tools/equity.ts)
 *
 * Card removal: villain combos that contain one of Hero's cards or a board
 * card are dropped before anything is counted. Weights are the range's
 * frequencies (e.g. 0.4 = villain takes this line with the hand 40% of the
 * time); each combo counts with its hand's weight.
 *
 * This is arithmetic on a given range, not strategy: the range is the
 * assumption, the counting on top of it is exact.
 */

import { expandHandClass } from "@/lib/learn/combos";
import { calculateEquity } from "@/lib/tools/equity";
import type { PreflopTable } from "./preflopTable";
import { preflopMatchup } from "./preflopTable";

/** Hand class → weight 0–1, e.g. { AA: 1, AKs: 1, A5s: 0.4 }. */
export type WeightedRange = Record<string, number>;

export interface RangeEquity {
  /** Hero's share of the pot, 0–1 (ties count half). */
  equity: number;
  win: number;
  tie: number;
  /** Legal combos after card removal, and their total weight. */
  combos: number;
  weight: number;
}

export interface WeightedCombo {
  cards: [string, string];
  weight: number;
}

export function rangeCombos(range: WeightedRange, dead: readonly string[]): WeightedCombo[] {
  const deadSet = new Set(dead);
  const out: WeightedCombo[] = [];
  for (const [hand, weight] of Object.entries(range)) {
    if (!(weight > 0)) continue;
    for (const cards of expandHandClass(hand)) {
      if (deadSet.has(cards[0]) || deadSet.has(cards[1])) continue;
      out.push({ cards: cards as [string, string], weight });
    }
  }
  return out;
}

/**
 * Returns null when no legal combo is left (the whole range is blocked).
 * `table` is required preflop and ignored afterwards.
 */
export function equityVsRange(
  hero: readonly [string, string],
  range: WeightedRange,
  board: readonly string[],
  table: PreflopTable | null,
): RangeEquity | null {
  if (board.length !== 0 && (board.length < 3 || board.length > 5)) throw new Error(`board must have 0 or 3–5 cards, got ${board.length}`);
  const combos = rangeCombos(range, [...hero, ...board]);
  if (!combos.length) return null;

  let win = 0;
  let tie = 0;
  let weight = 0;
  for (const c of combos) {
    let w: number;
    let t: number;
    if (board.length === 0) {
      if (!table) throw new Error("preflop equity needs the preflop table");
      const m = preflopMatchup(table, hero, c.cards);
      w = m.win;
      t = m.tie;
    } else {
      const r = calculateEquity([...hero], [...c.cards], [...board]);
      w = r.heroWinPct / 100;
      t = r.tiePct / 100;
    }
    win += w * c.weight;
    tie += t * c.weight;
    weight += c.weight;
  }
  return { equity: (win + tie / 2) / weight, win: win / weight, tie: tie / weight, combos: combos.length, weight };
}
