/// <reference lib="webworker" />
/**
 * Equity worker: keeps the heavy counting off the page's main thread. Loads
 * the preflop matchup table once, on first use.
 */

import tableData from "@/data/equity/preflop-matchups.json";
import { buildPreflopTable, type PreflopTable, type PreflopTableData } from "./preflopTable";
import { rankHandsVsRandom } from "./ranking";
import { equityVsRange } from "./rangeEquity";
import type { EquityRequest, EquityResponse } from "./protocol";

let table: PreflopTable | null = null;
let ranking: string[] | null = null;
const getTable = () => (table ??= buildPreflopTable(tableData as PreflopTableData));

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const req = e.data;
  try {
    if (req.type === "equity") {
      const t = req.boards.some((b) => b.length === 0) ? getTable() : null;
      const results = req.boards.map((board) => equityVsRange(req.hero, req.range, board, t));
      self.postMessage({ id: req.id, type: "equity", results } satisfies EquityResponse);
    } else {
      ranking ??= rankHandsVsRandom(getTable()).map((r) => r.hand);
      self.postMessage({ id: req.id, type: "ranking", order: ranking } satisfies EquityResponse);
    }
  } catch (err) {
    self.postMessage({ id: req.id, type: "error", message: err instanceof Error ? err.message : String(err) } satisfies EquityResponse);
  }
};
