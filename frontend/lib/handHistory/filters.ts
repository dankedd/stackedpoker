/**
 * Overview filters, sorting and paging — all applied in the database.
 *
 * Each filter is one entry in FILTERS: how it reads/writes the query string
 * and how it narrows the query. Adding a filter (position, all-in, street,
 * date range, …) means adding one entry here plus its control in the UI;
 * the list, the counts and replayer prev/next all pick it up automatically.
 */

export const DEFAULT_MIN_POT_BB = 20;
export const PAGE_SIZE = 50;

export interface HandFilters {
  /** Only hands where Hero called, bet, raised or showed down (derive.ts). */
  heroInvolved: boolean;
  minPotBb: number;
  tournamentId: string | null;
  withNotes: boolean;
}

export type SortKey = "pot" | "invested" | "date" | "result";
export type SortDir = "desc" | "asc";

export interface HandQueryState {
  filters: HandFilters;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_STATE: HandQueryState = {
  filters: { heroInvolved: true, minPotBb: DEFAULT_MIN_POT_BB, tournamentId: null, withNotes: false },
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
}

interface FilterDef<K extends keyof HandFilters> {
  key: K;
  param: string;
  read(raw: string | null): HandFilters[K];
  write(value: HandFilters[K]): string | null;
  apply<Q extends FilterableQuery>(q: Q, value: HandFilters[K]): Q;
}

function def<K extends keyof HandFilters>(d: FilterDef<K>): FilterDef<K> {
  return d;
}

export const FILTERS = [
  def({
    key: "heroInvolved",
    param: "alle",
    // On by default; `?alle=1` shows every hand, including ante-and-fold ones.
    read: (raw) => raw !== "1",
    write: (v) => (v ? null : "1"),
    apply: (q, v) => (v ? q.eq("hero_involved", true) : q),
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
  for (const f of FILTERS) out = (f.apply as (q: Q, v: unknown) => Q)(out, filters[f.key]);
  return out;
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/** Column order per sort; the trailing tie-breakers match the DB indexes. */
export function sortColumns(sort: SortKey, dir: SortDir): { column: string; ascending: boolean }[] {
  const ascending = dir === "asc";
  const key = { pot: "pot_bb", invested: "hero_invested_bb", result: "hero_net_bb", date: null }[sort];
  return [
    ...(key ? [{ column: key, ascending }] : []),
    { column: "played_at", ascending },
    { column: "id", ascending },
  ];
}

export const SORT_LABELS: Record<SortKey, string> = {
  pot: "Potgrootte",
  invested: "Mijn inzet (BB)",
  date: "Datum",
  result: "Resultaat",
};

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
  return {
    filters: filters as unknown as HandFilters,
    sort: sort === "date" || sort === "result" || sort === "invested" ? sort : "pot",
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
