import type { RangeEquity, WeightedRange } from "./rangeEquity";

export type EquityRequest =
  | { id: number; type: "equity"; hero: [string, string]; range: WeightedRange; boards: string[][] }
  | { id: number; type: "ranking" };

export type EquityResponse =
  | { id: number; type: "equity"; results: (RangeEquity | null)[] }
  | { id: number; type: "ranking"; order: string[] }
  | { id: number; type: "error"; message: string };
