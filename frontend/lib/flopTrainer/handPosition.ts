/**
 * Hero's hand among its range on a flop — the same computation as the
 * backend's hand_position() (backend/app/api/routes/flop_trainer.py), for
 * offline use (tests, report scripts) on the precomputed per-hand equities
 * (data/mpt/precomputed/*.jsonl "hands": side → hand class → [frequency, equity]).
 * The app itself asks the backend; flop_equity_hands has no public read.
 */

import type { BucketKey } from "./logic";

const SUITS = "cdhs";
const EDGES: [BucketKey, number][] = [
  ["strong", 75],
  ["good", 50],
  ["weak", 33],
  ["trash", 0],
];

export function liveCombos(hand: string, board: string[]): number {
  const used = new Set(board);
  const [a, b] = [hand[0], hand[1]];
  if (a === b) {
    const cards = [...SUITS].map((s) => a + s).filter((c) => !used.has(c));
    return (cards.length * (cards.length - 1)) / 2;
  }
  const suited = hand.endsWith("s");
  let n = 0;
  for (const s1 of SUITS) for (const s2 of SUITS) if ((s1 === s2) === suited && !used.has(a + s1) && !used.has(b + s2)) n++;
  return n;
}

export function handPositionFrom(hands: Record<string, [number, number]>, hand: string, board: string[]) {
  const weights: Record<string, number> = {};
  let total = 0;
  for (const [h, [f]] of Object.entries(hands)) {
    if (f <= 0) continue;
    weights[h] = f * liveCombos(h, board);
    total += weights[h];
  }
  const entry = hands[hand];
  if (!entry || total <= 0) return { in_range: false as const };
  const [freq, eq] = entry;
  const bucket = EDGES.find(([, lo]) => eq >= lo)![0];
  if (freq <= 0 || !(weights[hand] > 0)) return { in_range: false as const, equity: eq, bucket };
  const atLeast = Object.entries(weights).reduce((s, [h, w]) => (hands[h][1] >= eq ? s + w : s), 0);
  return { in_range: true as const, equity: eq, bucket, frequency: freq, top_pct: Math.round((1000 * atLeast) / total) / 10 };
}
