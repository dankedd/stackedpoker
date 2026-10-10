/**
 * Exact preflop equity for any two known hands, by lookup.
 *
 * data/equity/preflop-matchups.json holds, for every suit-isomorphic matchup
 * (matchupKey.ts), how many of the 1,712,304 boards the left-hand side wins
 * and ties — each counted by full enumeration with the site's own evaluator
 * (scripts/generate-preflop-equity.ts). Loaded once, in the equity worker.
 */

import { matchupKey } from "./matchupKey";

export interface PreflopTableData {
  boards: number;
  /** Comma-separated sorted matchup keys. */
  keys: string;
  win: number[];
  tie: number[];
}

export interface PreflopTable {
  boards: number;
  index: Map<string, number>;
  win: number[];
  tie: number[];
}

export function buildPreflopTable(data: PreflopTableData): PreflopTable {
  const index = new Map<string, number>();
  data.keys.split(",").forEach((k, i) => index.set(k, i));
  return { boards: data.boards, index, win: data.win, tie: data.tie };
}

/** Hero's win and tie share (0–1) against one villain hand, preflop. */
export function preflopMatchup(
  table: PreflopTable,
  hero: readonly string[],
  villain: readonly string[],
): { win: number; tie: number } {
  const { key, flipped } = matchupKey(hero, villain);
  const i = table.index.get(key);
  if (i === undefined) throw new Error(`no preflop matchup for ${key}`);
  const w = table.win[i];
  const t = table.tie[i];
  // A flipped key stores villain's wins; Hero wins whatever villain neither wins nor ties.
  const heroWins = flipped ? table.boards - w - t : w;
  return { win: heroWins / table.boards, tie: t / table.boards };
}
