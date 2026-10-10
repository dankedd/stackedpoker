/**
 * The 169 hand classes ordered by exact preflop equity against a random hand
 * — the order behind "top X%" range picks. Computed from the preflop table,
 * so it is counting, not an opinion about which hands are better.
 */

import { ALL_HANDS, combos } from "@/lib/ranges/logic";
import { expandHandClass } from "@/lib/learn/combos";
import { FULL_DECK } from "@/lib/tools/cards";
import { preflopMatchup, type PreflopTable } from "./preflopTable";

export function rankHandsVsRandom(table: PreflopTable): { hand: string; equity: number }[] {
  const all: [string, string][] = [];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) all.push([FULL_DECK[i], FULL_DECK[j]]);
  return ALL_HANDS.map((hand) => {
    const h = expandHandClass(hand)[0] as [string, string];
    let eq = 0;
    let n = 0;
    for (const v of all) {
      if (v[0] === h[0] || v[0] === h[1] || v[1] === h[0] || v[1] === h[1]) continue;
      const m = preflopMatchup(table, h, v);
      eq += m.win + m.tie / 2;
      n++;
    }
    return { hand, equity: eq / n };
  }).sort((a, b) => b.equity - a.equity);
}

/** The best hands covering `pct` percent of all 1,326 combos. */
export function topPercent(order: readonly string[], pct: number): string[] {
  const target = (Math.max(0, Math.min(100, pct)) / 100) * 1326;
  const out: string[] = [];
  let n = 0;
  for (const h of order) {
    if (n >= target) break;
    out.push(h);
    n += combos(h);
  }
  return out;
}
