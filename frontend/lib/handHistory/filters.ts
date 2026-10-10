/**
 * Overview filters, sorting and paging — all applied in the database.
 *
 * Each filter is one entry in FILTERS: how it reads/writes the query string
 * and how it narrows the query. Adding a filter (position, all-in, street,
 * date range, …) means adding one entry here plus its control in the UI;
 * the list, the counts and replayer prev/next all pick it up automatically.
 */

import { cardFilter, parseCardQuery, termText } from "./cardSearch";
import { PREFLOP_VERDICTS, type PreflopVerdict } from "./preflop/types";
import { t } from "./strings";

export const DEFAULT_MIN_POT_BB = 20;
export const PAGE_SIZE = 50;

/**
 * One precedence rule (see `isTargeted`):
 *  - default filters (minimum pot, only hands I played) hide noise;
 *  - targeted filters (cards, preflop check, favorites, notes) look for
 *    something specific. While any targeted filter is active the defaults are
 *    skipped — not cleared — and they apply again once targeted filters are off.
 *  - Targeted filters combine with AND between types, OR within a type.
 *  - The tournament filter always applies.
 */
export interface HandFilters {
  /** Card search terms, canonical spelling ("AQ", "AQs", "55", "AhQd", "Ah") — OR. */
  cards: string[];
  /**
   * Only starred hands. Like the preflop filter it goes before the involved
   * and minimum-pot filters, so every favourite shows up.
   */
  favorites: boolean;
  /**
   * Preflop-check verdicts to show (preflop/). When set it goes before the
   * involved and minimum-pot filters, so folded hands ("te strak") show up.
   */
  preflop: PreflopVerdict[];
  /** Only hands where Hero called, bet, raised or showed down (derive.ts). */
  heroInvolved: boolean;
  minPotBb: number;
  tournamentId: string | null;
  withNotes: boolean;
}

export type SortKey = "pot" | "invested" | "date" | "result" | "favorited";
export type SortDir = "desc" | "asc";

export interface HandQueryState {
  filters: HandFilters;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_STATE: HandQueryState = {
  filters: { cards: [], favorites: false, preflop: [], heroInvolved: true, minPotBb: DEFAULT_MIN_POT_BB, tournamentId: null, withNotes: false },
  sort: "pot",
  dir: "desc",
  page: 1,
};

/**
 * The subset of the PostgREST query builder the filters use. Typed loosely so
 * this file stays free of the supabase-js generics (and testable with a fake).
 */
export interface FilterableQuery {
  gte(column: string, value: unknown): this;
  eq(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
  /** Needed for card search only; optional so simple fakes keep type-checking. */
  or?(filter: string): this;
}

interface FilterDef<K extends keyof HandFilters> {
  key: K;
  param: string;
  read(raw: string | null): HandFilters[K];
  write(value: HandFilters[K]): string | null;
  apply<Q extends FilterableQuery>(q: Q, value: HandFilters[K]): Q;
  /** This filter steps aside while another one is active. */
  skipWhen?: (filters: HandFilters) => boolean;
}

/** Any targeted filter active? Then the default filters step aside. */
export function isTargeted(f: HandFilters): boolean {
  return f.cards.length > 0 || f.preflop.length > 0 || f.favorites || f.withNotes;
}
const overridesDefaults = isTargeted;

function def<K extends keyof HandFilters>(d: FilterDef<K>): FilterDef<K> {
  return d;
}

export const FILTERS = [
  def({
    key: "cards",
    param: "cards",
    read: (raw) => parseCardQuery(raw ?? "").terms.map(termText).slice(0, 20),
    write: (v) => (v.length ? v.join(",") : null),
    apply: (q, v) => {
      const f = v.length ? cardFilter(parseCardQuery(v.join(",")).terms) : null;
      return f && q.or ? q.or(f) : q;
    },
  }),
  def({
    key: "favorites",
    param: "fav",
    read: (raw) => raw === "1",
    write: (v) => (v ? "1" : null),
    apply: (q, v) => (v ? q.eq("is_favorite", true) : q),
  }),
  def({
    key: "preflop",
    param: "pf",
    read: (raw) => {
      const wanted = new Set((raw ?? "").split(","));
      return PREFLOP_VERDICTS.filter((v) => wanted.has(v));
    },
    write: (v) => (v.length ? v.join(",") : null),
    apply: (q, v) => (v.length ? q.in("preflop_check", v) : q),
  }),
  def({
    key: "heroInvolved",
    param: "played",
    // On by default; `?played=0` shows every hand, including ante-and-fold ones.
    // (Old links used `?alle=1`; readQueryState still understands that.)
    read: (raw) => raw !== "0",
    write: (v) => (v ? null : "0"),
    apply: (q, v) => (v ? q.eq("hero_involved", true) : q),
    skipWhen: overridesDefaults,
  }),
  def({
    key: "minPotBb",
    param: "minPot",
    read: (raw) => {
      const n = raw == null ? NaN : Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_POT_BB;
    },
    write: (v) => (v === DEFAULT_MIN_POT_BB ? null : String(v)),
    apply: (q, v) => (v > 0 ? q.gte("pot_bb", v) : q),
    skipWhen: overridesDefaults,
  }),
  def({
    key: "tournamentId",
    param: "t",
    read: (raw) => (raw && /^[\w-]{1,40}$/.test(raw) ? raw : null),
    write: (v) => v,
    apply: (q, v) => (v ? q.eq("tournament_id", v) : q),
  }),
  def({
    key: "withNotes",
    param: "notes",
    read: (raw) => raw === "1",
    write: (v) => (v ? "1" : null),
    apply: (q, v) => (v ? q.eq("has_note", true) : q),
  }),
] as const;

export function applyFilters<Q extends FilterableQuery>(q: Q, filters: HandFilters): Q {
  let out = q;
  for (const f of FILTERS) {
    if (f.skipWhen?.(filters)) continue;
    out = (f.apply as (q: Q, v: unknown) => Q)(out, filters[f.key]);
  }
  return out;
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Column order per sort; the trailing tie-breakers match the DB indexes.
 * "favorited" is only used together with the favourites filter (see
 * readQueryState), so favorited_at is never NULL there.
 */
export function sortColumns(sort: SortKey, dir: SortDir): { column: string; ascending: boolean }[] {
  const ascending = dir === "asc";
  const key = { pot: "pot_bb", invested: "hero_invested_bb", result: "hero_net_bb", favorited: "favorited_at", date: null }[sort];
  return [
    ...(key ? [{ column: key, ascending }] : []),
    { column: "played_at", ascending },
    { column: "id", ascending },
  ];
}

export const SORT_LABELS: Record<SortKey, string> = t.sort;

/**
 * PostgREST `or` filter selecting the rows strictly after `row` in the given
 * order (keyset paging) — used for the replayer's previous/next hand.
 */
export function keysetAfter(cols: { column: string; ascending: boolean }[], row: Record<string, unknown>): string {
  const lit = (v: unknown) => `"${String(v).replace(/"/g, '\\"')}"`;
  const parts: string[] = [];
  for (let i = 0; i < cols.length; i++) {
    const eqs = cols.slice(0, i).map((c) => `${c.column}.eq.${lit(row[c.column])}`);
    const c = cols[i];
    const cmp = `${c.column}.${c.ascending ? "gt" : "lt"}.${lit(row[c.column])}`;
    parts.push(eqs.length ? `and(${[...eqs, cmp].join(",")})` : cmp);
  }
  return parts.join(",");
}

export function reverseOrder(cols: { column: string; ascending: boolean }[]) {
  return cols.map((c) => ({ ...c, ascending: !c.ascending }));
}

// ── URL state ───────────────────────────────────────────────────────────────

export function readQueryState(params: URLSearchParams): HandQueryState {
  const filters = { ...DEFAULT_STATE.filters } as Record<keyof HandFilters, unknown>;
  for (const f of FILTERS) filters[f.key] = f.read(params.get(f.param));
  const sort = params.get("sort");
  const dir = params.get("dir");
  const page = Number(params.get("page"));
  const f = filters as unknown as HandFilters;
  if (params.get("alle") === "1") f.heroInvolved = false; // legacy link
  // "Recently starred" only means something for starred hands: it turns Favorites on.
  if (sort === "favorited") f.favorites = true;
  return {
    filters: f,
    sort: sort === "date" || sort === "result" || sort === "invested" || sort === "favorited" ? sort : "pot",
    dir: dir === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Query string for a state; `includePage` is false for links into the replayer. */
export function writeQueryState(s: HandQueryState, includePage = true): string {
  const p = new URLSearchParams();
  for (const f of FILTERS) {
    const v = (f.write as (v: unknown) => string | null)(s.filters[f.key]);
    if (v != null) p.set(f.param, v);
  }
  if (s.sort !== "pot") p.set("sort", s.sort);
  if (s.dir !== "desc") p.set("dir", s.dir);
  if (includePage && s.page > 1) p.set("page", String(s.page));
  const q = p.toString();
  return q ? `?${q}` : "";
}
