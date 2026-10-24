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
  /** Stable chart id, e.g. "open_mtt_lj_25" (scripts/build-range-data.mjs). */
  id: string;
  group: "mtt" | "cash";
  pos: string;
  stack: number;
  actions: ChartAction<OpenActionKey>[];
  grid: Record<HandClass, number[]>;
}

/**
 * Push/fold chart. Each cell is `[background, number]` exactly as printed:
 * see `pushValue` in ./logic for how that becomes a max shove stack.
 */
export interface PushFoldChart {
  /** Stable chart id, e.g. "push_sb". */
  id: string;
  pos: string;
  grid: Record<HandClass, [string, string]>;
}

export type DefenseSpot = "open" | "push" | "limp" | "4bet" | "lr";

/**
 * Defense chart. `grid[hand]` is `null` when the hand never reaches this
 * spot (e.g. it is not in the 3-bet range that got 4-bet) — that is NOT fold.
 */
export interface DefenseChart {
  /** Stable chart id, e.g. "def_mtt_bb_vs_bn_open_25". */
  id: string;
  group: "mtt" | "cash";
  hero: string;
  vil: string;
  stack: number;
  spot: DefenseSpot;
  size: string | null;
  actions: ChartAction<DefenseActionKey>[];
  grid: Record<HandClass, number[] | null>;
}
