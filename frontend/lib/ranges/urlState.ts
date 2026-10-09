import { PREFLOP_RANGES_PATH } from "./feature";
import type { Deal, TrainerMode, TrainerType } from "./logic";
import type { DefenseSpot } from "./types";

/**
 * Query-string state for /preflop-trainer and /preflop-trainer/ranges, so a
 * shared link opens the same trainer setup or the same chart. Defaults are
 * left out of the URL to keep links short; anything unknown falls back to the
 * default instead of breaking the page.
 */

type Query = URLSearchParams | Record<string, string | string[] | undefined>;

function get(q: Query, key: string): string | undefined {
  if (q instanceof URLSearchParams) return q.get(key) ?? undefined;
  const v = q[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function int(v: string | undefined, fallback: number): number {
  const n = v === undefined ? NaN : Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function toQuery(entries: [string, string | number | undefined][]): string {
  const p = new URLSearchParams();
  for (const [k, v] of entries) if (v !== undefined) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── Trainer ─────────────────────────────────────────────────────────────────

export interface TrainerQuery {
  type: TrainerType;
  game: TrainerMode;
  fewerFolds: boolean;
}

export const TRAINER_DEFAULTS: TrainerQuery = { type: "mix", game: "all", fewerFolds: true };

export function parseTrainerQuery(q: Query): TrainerQuery {
  const type = oneOf(get(q, "type"), ["open", "def", "mix"] as const, TRAINER_DEFAULTS.type);
  let game = oneOf(get(q, "game"), ["all", "mtt", "pf", "cash"] as const, TRAINER_DEFAULTS.game);
  // Push/fold only exists for opening hands.
  if (game === "pf" && type !== "open") game = "all";
  return { type, game, fewerFolds: get(q, "folds") !== "all" };
}

export function trainerQuery(s: TrainerQuery): string {
  return toQuery([
    ["type", s.type !== TRAINER_DEFAULTS.type ? s.type : undefined],
    ["game", s.game !== TRAINER_DEFAULTS.game ? s.game : undefined],
    ["folds", s.fewerFolds ? undefined : "all"],
  ]);
}

// ── Ranges ──────────────────────────────────────────────────────────────────

export type RangesView = "mtt" | "def" | "pf" | "cash";

export interface RangesQuery {
  view: RangesView;
  mtt: { pos: string; stack: number };
  cash: { pos: string };
  def: { game: "mtt" | "cash"; hero: string; vil: string; stack: number; spot: DefenseSpot };
  pf: { pos: string; stack: number };
}

export const RANGES_DEFAULTS: RangesQuery = {
  view: "mtt",
  mtt: { pos: "BN", stack: 15 },
  cash: { pos: "BN" },
  def: { game: "mtt", hero: "BB", vil: "BN", stack: 25, spot: "open" },
  pf: { pos: "BN", stack: 10 },
};

const SPOTS = ["open", "push", "limp", "4bet", "lr"] as const;

/** Only the selected view reads its parameters; the others keep their defaults. */
export function parseRangesQuery(q: Query): RangesQuery {
  const d = RANGES_DEFAULTS;
  const view = oneOf(get(q, "view"), ["mtt", "def", "pf", "cash"] as const, d.view);
  const r: RangesQuery = { ...d, view };
  if (view === "mtt") r.mtt = { pos: get(q, "pos") ?? d.mtt.pos, stack: int(get(q, "stack"), d.mtt.stack) };
  if (view === "cash") r.cash = { pos: get(q, "pos") ?? d.cash.pos };
  if (view === "pf") r.pf = { pos: get(q, "pos") ?? d.pf.pos, stack: Math.min(10, int(get(q, "stack"), d.pf.stack)) };
  if (view === "def") {
    const game = oneOf(get(q, "game"), ["mtt", "cash"] as const, d.def.game);
    r.def = {
      game,
      hero: get(q, "hero") ?? d.def.hero,
      vil: get(q, "vil") ?? d.def.vil,
      stack: int(get(q, "stack"), game === "cash" ? 100 : d.def.stack),
      spot: oneOf(get(q, "spot"), SPOTS, d.def.spot),
    };
  }
  return r;
}

/** The query for one view. Every parameter is written, so a link is explicit. */
export function rangesQuery(s: RangesQuery): string {
  switch (s.view) {
    case "mtt":
      return toQuery([["view", "mtt"], ["pos", s.mtt.pos], ["stack", s.mtt.stack]]);
    case "cash":
      return toQuery([["view", "cash"], ["pos", s.cash.pos]]);
    case "pf":
      return toQuery([["view", "pf"], ["pos", s.pf.pos], ["stack", s.pf.stack]]);
    case "def": {
      const x = s.def;
      return toQuery([
        ["view", "def"],
        ["game", x.game],
        ["hero", x.hero],
        ["vil", x.vil],
        ["stack", x.game === "mtt" ? x.stack : undefined],
        ["spot", x.spot],
      ]);
    }
  }
}

/** "View full chart" from a trainer result: the exact chart the hand was graded against. */
export function chartHrefForDeal(deal: Deal): string {
  const s: RangesQuery = { ...RANGES_DEFAULTS };
  if (deal.type === "def") {
    s.view = "def";
    s.def = { game: deal.fmt, hero: deal.hero, vil: deal.vil, stack: deal.stack, spot: deal.spot };
  } else if (deal.kind === "pf") {
    s.view = "pf";
    s.pf = { pos: deal.hero, stack: deal.stack };
  } else if (deal.fmt === "cash") {
    s.view = "cash";
    s.cash = { pos: deal.hero };
  } else {
    s.view = "mtt";
    s.mtt = { pos: deal.hero, stack: deal.stack };
  }
  return `${PREFLOP_RANGES_PATH}${rangesQuery(s)}`;
}
