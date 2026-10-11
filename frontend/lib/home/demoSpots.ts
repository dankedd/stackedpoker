/**
 * The homepage's interactive mini-trainer — every spot in one typed list.
 * Edit DEMO_SPOTS to change the demo.
 *
 * Frequencies are NOT written here: each spot names a Preflop Trainer chart
 * (data/ranges/defense.json — cash 6-max, 100bb, facing one open) and its
 * numbers are read from that chart, so the demo shows exactly what the
 * trainer grades against. Server-only: the chart files stay out of the
 * homepage's JavaScript; only the resolved numbers reach the browser.
 * Import it from server components only (app/page.tsx).
 *
 * Chart source: Modern Poker Theory (M. Acevedo), cash defense ranges.
 */

import { DEFENSE_CHARTS } from "@/lib/ranges/data";
import type { DemoAnswer, DemoSpot } from "./demoLogic";

export interface DemoSpotConfig {
  hero: string;
  opener: string;
  cards: [string, string];
  /** Hand class as in the chart ("KQs"). */
  hand: string;
}

export const DEMO_SPOTS: DemoSpotConfig[] = [
  { hero: "BN", opener: "CO", cards: ["Ks", "Qs"], hand: "KQs" },
  { hero: "BB", opener: "BN", cards: ["Qc", "Jd"], hand: "QJo" },
  { hero: "SB", opener: "BN", cards: ["Ks", "Jd"], hand: "KJo" },
];

export const DEMO_STACK_BB = 100;

export function resolveSpot(c: DemoSpotConfig): DemoSpot {
  const chart = DEFENSE_CHARTS.find(
    (x) => x.group === "cash" && x.spot === "open" && x.stack === DEMO_STACK_BB && x.hero === c.hero && x.vil === c.opener,
  );
  if (!chart) throw new Error(`No cash defense chart for ${c.hero} vs ${c.opener}`);
  const row = chart.grid[c.hand];
  if (!row) throw new Error(`${c.hand} never reaches ${chart.title}`);
  const freqs: Record<DemoAnswer, number> = { fold: 0, call: 0, raise: 0 };
  chart.actions.forEach((a, i) => {
    if (a.key === "fold" || a.key === "call" || a.key === "raise") freqs[a.key] += row[i];
  });
  const best = (Object.entries(freqs) as [DemoAnswer, number][]).reduce((b, x) => (x[1] > b[1] ? x : b))[0];
  // Trainer convention for cash opens (lib/ranges/logic.ts openSize): SB 3x, others 2.5x.
  return { ...c, openBb: c.opener === "SB" ? 3 : 2.5, stackBb: DEMO_STACK_BB, freqs, best };
}

export function demoSpots(): DemoSpot[] {
  return DEMO_SPOTS.map(resolveSpot);
}
