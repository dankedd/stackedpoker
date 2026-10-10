/**
 * Pure helpers behind the hand-list filter bar: the active-filter chips, the
 * quick presets, "Clear all" and "Restore defaults". No React, so the
 * behaviour is testable on its own; the precedence rule itself lives in
 * filters.ts (isTargeted).
 */

import { DEFAULT_MIN_POT_BB, DEFAULT_STATE, isTargeted, type HandFilters, type HandQueryState } from "./filters";
import { PREFLOP_ERRORS, VERDICT_LABEL } from "./preflop";
import { t } from "./strings";

export type StatePatch = Partial<Omit<HandQueryState, "filters">> & { filters?: Partial<HandFilters> };

export interface FilterChip {
  key: string;
  label: string;
  /** Patch that removes just this filter. */
  remove: StatePatch;
}

const fmtBbValue = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Turning Favorites off must also leave the star-date sort (it would turn Favorites back on). */
export function withoutFavorites(state: HandQueryState): StatePatch {
  return { filters: { favorites: false }, ...(state.sort === "favorited" ? { sort: "pot" as const } : {}) };
}

/** The targeted filters cleared — the defaults apply again. Tournament and sort stay. */
export function restoreDefaults(state: HandQueryState): StatePatch {
  return { ...withoutFavorites(state), filters: { cards: [], preflop: [], favorites: false, withNotes: false } };
}

/** Everything back to the default state (tournament included); the sort stays unless it is the star date. */
export function clearAll(state: HandQueryState): StatePatch {
  return { filters: { ...DEFAULT_STATE.filters }, ...(state.sort === "favorited" ? { sort: "pot" as const } : {}) };
}

/**
 * Chips for what is narrowing the list, in bar order. The default filters
 * only get chips when they differ from their defaults and actually apply.
 */
export function activeChips(state: HandQueryState, tournamentName?: (id: string) => string | undefined): FilterChip[] {
  const f = state.filters;
  const chips: FilterChip[] = [];
  for (const term of f.cards) {
    chips.push({ key: `card:${term}`, label: term, remove: { filters: { cards: f.cards.filter((c) => c !== term) } } });
  }
  if (!isTargeted(f)) {
    if (f.minPotBb !== DEFAULT_MIN_POT_BB) {
      chips.push({
        key: "pot",
        label: f.minPotBb > 0 ? t.filterBar.pot(fmtBbValue(f.minPotBb)) : t.filterBar.potAny,
        remove: { filters: { minPotBb: DEFAULT_MIN_POT_BB } },
      });
    }
    if (!f.heroInvolved) chips.push({ key: "played", label: t.filterBar.playedOff, remove: { filters: { heroInvolved: true } } });
  }
  for (const v of f.preflop) {
    chips.push({ key: `pf:${v}`, label: VERDICT_LABEL[v], remove: { filters: { preflop: f.preflop.filter((x) => x !== v) } } });
  }
  if (f.favorites) chips.push({ key: "fav", label: `★ ${t.filterBar.favorites}`, remove: withoutFavorites(state) });
  if (f.withNotes) chips.push({ key: "notes", label: t.filterBar.notes, remove: { filters: { withNotes: false } } });
  if (f.tournamentId) {
    chips.push({ key: "t", label: tournamentName?.(f.tournamentId) ?? `#${f.tournamentId}`, remove: { filters: { tournamentId: null } } });
  }
  return chips;
}

/** Number shown on the mobile "Filters (n)" button. */
export function activeCount(state: HandQueryState): number {
  return activeChips(state).length;
}

export interface Preset {
  key: "biggest" | "mistakes" | "favorites" | "notes";
  label: string;
  /** Full state to apply (tournament kept by the caller). */
  apply: (state: HandQueryState) => StatePatch;
  isActive: (state: HandQueryState) => boolean;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

function targetedOnly(f: HandFilters, want: Partial<HandFilters>): boolean {
  const base = { cards: [] as string[], preflop: [] as string[], favorites: false, withNotes: false, ...want };
  return same(f.cards, base.cards) && same(f.preflop, base.preflop) && f.favorites === base.favorites && f.withNotes === base.withNotes;
}

const reset = (state: HandQueryState, extra: Partial<HandFilters>): Partial<HandFilters> => ({
  ...DEFAULT_STATE.filters,
  tournamentId: state.filters.tournamentId,
  ...extra,
});

export const PRESETS: Preset[] = [
  {
    key: "biggest",
    label: t.filterBar.presetBiggest,
    apply: (s) => ({ filters: reset(s, {}), sort: "pot", dir: "desc" }),
    isActive: (s) =>
      targetedOnly(s.filters, {}) &&
      s.filters.heroInvolved &&
      s.filters.minPotBb === DEFAULT_MIN_POT_BB &&
      s.sort === "pot" &&
      s.dir === "desc",
  },
  {
    key: "mistakes",
    label: t.filterBar.presetMistakes,
    apply: (s) => ({ filters: reset(s, { preflop: [...PREFLOP_ERRORS] }), sort: "pot", dir: "desc" }),
    isActive: (s) => targetedOnly(s.filters, { preflop: [...PREFLOP_ERRORS] }),
  },
  {
    key: "favorites",
    label: t.filterBar.presetFavorites,
    apply: (s) => ({ filters: reset(s, { favorites: true }), sort: "favorited", dir: "desc" }),
    isActive: (s) => targetedOnly(s.filters, { favorites: true }),
  },
  {
    key: "notes",
    label: t.filterBar.presetNotes,
    apply: (s) => ({ filters: reset(s, { withNotes: true }), sort: "date", dir: "desc" }),
    isActive: (s) => targetedOnly(s.filters, { withNotes: true }),
  },
];
