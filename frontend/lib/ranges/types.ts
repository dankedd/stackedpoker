/**
 * Types for the preflop range data in data/ranges/*.json.
 *
 * The JSON is the ONLY place the numbers live. Nothing in lib/ranges or the
 * UI hardcodes a frequency, so replacing those three files (e.g. with own
 * solver output) changes what the tool shows without touching code — as long
 * as the replacement keeps these shapes.
 */

/** A 169-class hand notation: "AA", "AKs", "AKo". */
export type HandClass = string;

export type OpenActionKey = "allin" | "raise" | "limp" | "fold";
export type DefenseActionKey = "allin" | "raise" | "call" | "fold";
export type RangeActionKey = OpenActionKey | DefenseActionKey;

export interface ChartAction<K extends RangeActionKey = RangeActionKey> {
  key: K;
  /** Label as printed with the chart, e.g. "Raise 2x", "5-bet All-in". */
  label: string;
  /** Aggregate percentage as stated by the source. Shown as-is, never recomputed. */
  pct: number;
}

/** First-in (open) chart. `grid[hand][i]` is the 0–1 frequency of `actions[i]`. */
export interface OpenChart {
  page: number;
  group: "mtt" | "cash";
  pos: string;
  stack: number;
  /** Source label, e.g. "Hand Range 112". */
  hr: string;
  actions: ChartAction<OpenActionKey>[];
  grid: Record<HandClass, number[]>;
}

/**
 * Push/fold chart. Each cell is `[background, number]` exactly as printed:
 * see `pushValue` in ./logic for how that becomes a max shove stack.
 */
export interface PushFoldChart {
  page: number;
  pos: string;
  hr: string;
  grid: Record<HandClass, [string, string]>;
}

export type DefenseSpot = "open" | "push" | "limp" | "4bet" | "lr";

/**
 * Defense chart. `grid[hand]` is `null` when the hand never reaches this
 * spot (e.g. it is not in the 3-bet range that got 4-bet) — that is NOT fold.
 */
export interface DefenseChart {
  /** Hand Range number. */
  n: number;
  page: number;
  group: "mtt" | "cash";
  hero: string;
  vil: string;
  stack: number;
  spot: DefenseSpot;
  size: string | null;
  title: string;
  actions: ChartAction<DefenseActionKey>[];
  grid: Record<HandClass, number[] | null>;
}
