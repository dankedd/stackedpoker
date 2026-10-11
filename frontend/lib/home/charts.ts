/**
 * Range charts for the homepage visuals, reduced on the server to what the
 * browser needs: per hand, the action mix (from the Preflop Trainer's data,
 * lib/ranges/data). Import from server components only (app/page.tsx), so
 * the 400 KB range files stay out of the homepage's JavaScript.
 */

import { DEFENSE_CHARTS, OPEN_CHARTS, PUSH_FOLD_CHARTS } from "@/lib/ranges/data";
import { ALL_HANDS } from "@/lib/ranges/logic";
import type { ChartAction } from "@/lib/ranges/types";

export type CellMix = [action: string, freq: number][];

export interface HomeChart {
  title: string;
  /** e.g. "Raise 2.5x" labels per action key, for the legend. */
  legend: { key: string; label: string }[];
  /** ALL_HANDS order; null = never reaches the spot. */
  cells: (CellMix | null)[];
}

function reduce(title: string, grid: Record<string, number[] | null>, actions: ChartAction[]): HomeChart {
  return {
    title,
    legend: actions.map((a) => ({ key: a.key, label: a.label })),
    cells: ALL_HANDS.map((h) => {
      const row = grid[h];
      if (!row) return null;
      return actions.map((a, i): [string, number] => [a.key, Math.round(row[i] * 1000) / 1000]).filter(([, f]) => f > 0);
    }),
  };
}

/** Cash 6-max 100bb: the CO's open range. */
export function coOpenChart(): HomeChart {
  const c = OPEN_CHARTS.find((x) => x.group === "cash" && x.pos === "CO" && x.stack === 100);
  if (!c) throw new Error("cash CO open chart missing");
  return reduce("CO open · 100 BB", c.grid, c.actions);
}

/** Cash 6-max 100bb: the BB defending against a CO open. */
export function bbVsCoChart(): HomeChart {
  const c = DEFENSE_CHARTS.find((x) => x.group === "cash" && x.spot === "open" && x.hero === "BB" && x.vil === "CO" && x.stack === 100);
  if (!c) throw new Error("cash BB vs CO chart missing");
  return reduce("BB vs CO open · 100 BB", c.grid, c.actions);
}

/** Cash 6-max 100bb: the BTN's open range (the bento tile's wave). */
export function btnOpenChart(): HomeChart {
  const c = OPEN_CHARTS.find((x) => x.group === "cash" && x.pos === "BN" && x.stack === 100);
  if (!c) throw new Error("cash BTN open chart missing");
  return reduce("BTN open · 100 BB", c.grid, c.actions);
}

/** How many charts the Preflop Trainer has (for the trust strip). */
export function trainerChartCount(): number {
  return OPEN_CHARTS.length + PUSH_FOLD_CHARTS.length + DEFENSE_CHARTS.length;
}
