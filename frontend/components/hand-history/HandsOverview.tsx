"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, NotebookPen, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  countAllHands,
  countFavorites,
  listHands,
  listTournaments,
  preflopSummary,
  refreshPreflopChecks,
  setFavorite,
  type PreflopSummaryRow,
  type TournamentRow,
} from "@/lib/handHistory/api";
import {
  PAGE_SIZE,
  SORT_LABELS,
  readQueryState,
  writeQueryState,
  type HandFilters,
  type HandQueryState,
  type SortKey,
} from "@/lib/handHistory/filters";
import { HANDS_IMPORT_PATH, HANDS_PATH } from "@/lib/handHistory/feature";
import { fmtBb, fmtNum, fmtPlayedAt, fmtPlayedDate, fmtSignedBb } from "@/lib/handHistory/format";
import { PREFLOP_VERDICTS, VERDICT_LABEL, type PreflopVerdict } from "@/lib/handHistory/preflop";
import type { HandListRow } from "@/lib/handHistory/rows";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";
import { FavoriteStar } from "./FavoriteStar";
import { MiniCards } from "./MiniCards";
import { PreflopBadge, VERDICT_STYLE } from "./PreflopBadge";
import { PreflopSummary } from "./PreflopSummary";
import { PageHeader, SectionNav } from "./SectionNav";

const POT_SLIDER_MAX = 200;

export function HandsOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = useMemo(() => readQueryState(new URLSearchParams(params.toString())), [params]);
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<HandListRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favCount, setFavCount] = useState<number | null>(null);
  const [pendingFav, setPendingFav] = useState<ReadonlySet<string>>(new Set());
  const [summary, setSummary] = useState<PreflopSummaryRow[]>([]);
  const [rechecking, setRechecking] = useState<number | null>(null);
  // Bumped after a preflop re-check so the list reloads with the new labels.
  const [reloadKey, setReloadKey] = useState(0);

  const update = useCallback(
    (patch: Partial<Omit<HandQueryState, "filters">> & { filters?: Partial<HandFilters> }) => {
      const next: HandQueryState = {
        ...state,
        ...patch,
        filters: { ...state.filters, ...patch.filters },
        // Any change other than paging starts again at page 1.
        page: patch.page ?? 1,
      };
      router.replace(`${pathname}${writeQueryState(next)}`, { scroll: false });
    },
    [state, router, pathname],
  );

  useEffect(() => {
    listTournaments(supabase).then(setTournaments).catch(() => {});
    countAllHands(supabase).then(setTotal).catch((e: Error) => setError(e.message));
    countFavorites(supabase).then(setFavCount).catch(() => {});
  }, [supabase]);

  // Optimistic: the star (and the count) change at once and go back if saving fails.
  // An unstarred hand stays in a favourites-only list until the next reload, so it can be re-starred.
  const toggleFavorite = useCallback(
    async (id: string) => {
      const row = rows?.find((r) => r.id === id);
      if (!row || pendingFav.has(id)) return;
      const was = row.favorited_at;
      const want = was == null;
      const patch = (favorited_at: string | null) =>
        setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, favorited_at } : r)) ?? rs);
      patch(want ? new Date().toISOString() : null);
      setFavCount((c) => (c == null ? c : c + (want ? 1 : -1)));
      setPendingFav((s) => new Set(s).add(id));
      try {
        patch(await setFavorite(supabase, id, want));
      } catch (e) {
        patch(was);
        setFavCount((c) => (c == null ? c : c + (want ? -1 : 1)));
        toast.error(want ? t.favorite.addFailed : t.favorite.removeFailed, {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setPendingFav((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [rows, pendingFav, supabase],
  );

  // Bring every hand's preflop check up to date with the trainer's current ranges.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const changed = await refreshPreflopChecks(supabase, (n) => !cancelled && setRechecking(n));
        if (cancelled) return;
        setRechecking(null);
        if (changed) setReloadKey((k) => k + 1);
        setSummary(await preflopSummary(supabase));
      } catch (e) {
        if (!cancelled) {
          setRechecking(null);
          setError(e instanceof Error ? e.message : t.overview.recheckFailed);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listHands(supabase, state)
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setCount(r.count);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [supabase, state, reloadKey]);

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const linkSuffix = writeQueryState(state, false);

  return (
    <div className="page-enter">
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader
        title={t.section.title}
        subtitle={total == null ? t.overview.subtitleLoading : t.overview.subtitle(fmtNum(total), fmtNum(count))}
      >
        <Link
          href={HANDS_IMPORT_PATH}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Upload className="h-4 w-4" /> {t.overview.importButton}
        </Link>
      </PageHeader>

      {rechecking != null && (
        <p className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.overview.rechecking(rechecking)}
        </p>
      )}
      <PreflopSummary rows={summary} onPick={(preflop) => update({ filters: { preflop } })} />

      <FiltersBar state={state} tournaments={tournaments} favCount={favCount} onChange={update} />

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {total === 0 && !error ? (
        <EmptyState />
      ) : (
        <div className="relative mt-4">
          {loading && rows && (
            <div className="absolute right-2 top-2 z-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!rows ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.overview.loading}
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
              {state.filters.favorites
                ? favCount === 0
                  ? t.overview.noFavoritesYet
                  : t.overview.noFavoritesMatch
                : state.filters.preflop.length
                ? t.overview.noPreflopMatch
                : t.overview.noMatch}
            </p>
          ) : (
            <HandList rows={rows} linkSuffix={linkSuffix} pending={pendingFav} onToggleFavorite={toggleFavorite} />
          )}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t.overview.pagination} className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={state.page <= 1}
            onClick={() => update({ page: state.page - 1 })}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> {t.overview.prevPage}
          </button>
          <span className="text-muted-foreground">
            {t.overview.page(state.page, pages)}
          </span>
          <button
            type="button"
            disabled={state.page >= pages}
            onClick={() => update({ page: state.page + 1 })}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 disabled:opacity-40"
          >
            {t.overview.nextPage} <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

function FiltersBar({
  state,
  tournaments,
  favCount,
  onChange,
}: {
  state: HandQueryState;
  tournaments: TournamentRow[];
  favCount: number | null;
  onChange: (patch: Partial<Omit<HandQueryState, "filters">> & { filters?: Partial<HandFilters> }) => void;
}) {
  // Local value so the slider moves smoothly; the URL (and the query) follows after a pause.
  const [minPot, setMinPot] = useState(state.filters.minPotBb);
  useEffect(() => setMinPot(state.filters.minPotBb), [state.filters.minPotBb]);
  useEffect(() => {
    if (minPot === state.filters.minPotBb) return;
    const timer = setTimeout(() => onChange({ filters: { minPotBb: minPot } }), 350);
    return () => clearTimeout(timer);
  }, [minPot, state.filters.minPotBb, onChange]);

  const pf = state.filters.preflop;
  const pfActive = pf.length > 0;
  const favActive = state.filters.favorites;
  // Both filters step in front of "only involved" and the minimum pot.
  const overridden = favActive || pfActive;
  const togglePf = (v: PreflopVerdict) =>
    onChange({ filters: { preflop: pf.includes(v) ? pf.filter((x) => x !== v) : PREFLOP_VERDICTS.filter((x) => x === v || pf.includes(x)) } });

  return (
    <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div className="md:col-span-2 xl:col-span-3">
        <button
          type="button"
          aria-pressed={favActive}
          onClick={() =>
            onChange({
              filters: { favorites: !favActive },
              // The star-date sort only exists inside the favourites list.
              ...(favActive && state.sort === "favorited" ? { sort: "pot" as const } : {}),
            })
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition",
            favActive ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          <Star className={cn("h-4 w-4", favActive && "fill-amber-400 text-amber-400")} />
          {t.filters.favoritesOnly}
          {favCount != null && <span className="font-mono text-xs opacity-80">({favCount})</span>}
        </button>
        {favActive && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t.filters.favoritesHint}
          </p>
        )}
      </div>

      <div className="md:col-span-2 xl:col-span-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.filters.preflopMistakes}</p>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.filters.preflopGroupLabel}>
          {PREFLOP_VERDICTS.map((v) => {
            const on = pf.includes(v);
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => togglePf(v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                  on ? VERDICT_STYLE[v] : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {VERDICT_LABEL[v]}
              </button>
            );
          })}
          {pfActive && (
            <button type="button" onClick={() => onChange({ filters: { preflop: [] } })} className="px-2 text-xs text-muted-foreground underline hover:text-foreground">
              {t.filters.clear}
            </button>
          )}
        </div>
        {pfActive && !favActive && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t.filters.preflopHint}
          </p>
        )}
      </div>

      <div className={cn(overridden && "pointer-events-none opacity-40")} aria-disabled={overridden || undefined}>
        <label htmlFor="minPot" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.filters.minPot}
        </label>
        <div className="flex items-center gap-3">
          <input
            id="minPot"
            type="range"
            min={0}
            max={POT_SLIDER_MAX}
            step={1}
            value={Math.min(minPot, POT_SLIDER_MAX)}
            onChange={(e) => setMinPot(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-violet-500"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              aria-label={t.filters.minPotAria}
              value={minPot}
              onChange={(e) => {
                const n = Number(e.target.value);
                setMinPot(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              className="w-20 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-right font-mono text-sm"
            />
            <span className="text-sm text-muted-foreground">BB</span>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="tournament" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.filters.tournament}
        </label>
        <select
          id="tournament"
          value={state.filters.tournamentId ?? ""}
          onChange={(e) => onChange({ filters: { tournamentId: e.target.value || null } })}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
        >
          <option value="">{t.filters.allTournaments}</option>
          {tournaments.map((tr) => (
            <option key={`${tr.site}:${tr.tournament_id}`} value={tr.tournament_id}>
              {(tr.name ?? `#${tr.tournament_id}`) + (tr.last_hand_at ? ` · ${fmtPlayedDate(tr.last_hand_at)}` : "")} ({fmtNum(tr.hand_count)})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:col-span-2 xl:col-span-1">
        <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", overridden && "opacity-40")}>
          <input
            type="checkbox"
            disabled={overridden}
            checked={state.filters.heroInvolved}
            onChange={(e) => onChange({ filters: { heroInvolved: e.target.checked } })}
            className="h-4 w-4 accent-violet-500"
          />
          {t.filters.onlyPlayed}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.filters.withNotes}
            onChange={(e) => onChange({ filters: { withNotes: e.target.checked } })}
            className="h-4 w-4 accent-violet-500"
          />
          {t.filters.onlyNotes}
        </label>
        <div className="flex items-center gap-1">
          <label htmlFor="sort" className="sr-only">
            {t.filters.sortBy}
          </label>
          <select
            id="sort"
            value={state.sort}
            onChange={(e) => {
              const sort = e.target.value as SortKey;
              // Sorting by star date means looking at favourites.
              onChange(sort === "favorited" ? { sort, filters: { favorites: true } } : { sort });
            }}
            className="rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange({ dir: state.dir === "desc" ? "asc" : "desc" })}
            aria-label={state.dir === "desc" ? t.filters.descendingAria : t.filters.ascendingAria}
            title={state.dir === "desc" ? t.filters.descending : t.filters.ascending}
            className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:text-foreground"
          >
            {state.dir === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

function ResultBadge({ bb }: { bb: number }) {
  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold",
        bb > 0.04 ? "text-emerald-400" : bb < -0.04 ? "text-rose-400" : "text-muted-foreground",
      )}
    >
      {fmtSignedBb(bb)}
    </span>
  );
}

function HandList({
  rows,
  linkSuffix,
  pending,
  onToggleFavorite,
}: {
  rows: HandListRow[];
  linkSuffix: string;
  pending: ReadonlySet<string>;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 md:block">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 py-3 pl-2" aria-label={t.list.favorite} />
              <th className="px-4 py-3 font-semibold">{t.list.date}</th>
              <th className="px-4 py-3 font-semibold">{t.list.tournament}</th>
              <th className="px-4 py-3 font-semibold">{t.list.position}</th>
              <th className="px-4 py-3 font-semibold">{t.list.cards}</th>
              <th className="px-4 py-3 font-semibold">{t.list.board}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.list.pot}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.list.invested}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.list.result}</th>
              <th className="px-2 py-3" aria-label={t.list.note} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => (
              <tr key={r.id} className="group relative transition-colors hover:bg-violet-500/[0.06]">
                <td className="py-1 pl-2">
                  <FavoriteStar
                    on={r.favorited_at != null}
                    pending={pending.has(r.id)}
                    onToggle={() => onToggleFavorite(r.id)}
                    className="relative z-10"
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Link href={`${HANDS_PATH}/${r.id}${linkSuffix}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {fmtPlayedAt(r.played_at)}
                  </Link>
                </td>
                <td className="max-w-[220px] px-4 py-2.5">
                  <p className="truncate">{r.hh_tournaments?.name ?? `#${r.tournament_id}`}</p>
                  <p className="text-xs text-muted-foreground">{t.list.level(r.level)}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-violet-300">{r.hero_position ?? "—"}</span>
                  <PreflopBadge verdict={r.preflop_check} className="ml-1.5" />
                </td>
                <td className="px-4 py-2.5">
                  <MiniCards cards={r.hero_cards} />
                </td>
                <td className="px-4 py-2.5">
                  <MiniCards cards={r.board} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold">{fmtBb(r.pot_bb)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-muted-foreground">{fmtBb(r.hero_invested_bb)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <ResultBadge bb={r.hero_net_bb} />
                </td>
                <td className="px-2 py-2.5">{r.has_note && <NotebookPen aria-label={t.list.hasNote} className="h-4 w-4 text-amber-300" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="relative">
            <Link
              href={`${HANDS_PATH}/${r.id}${linkSuffix}`}
              className="block rounded-xl border border-border/60 bg-card/40 p-3 transition active:bg-violet-500/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.hh_tournaments?.name ?? `#${r.tournament_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtPlayedAt(r.played_at)} · {t.list.level(r.level)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{fmtBb(r.pot_bb)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.list.investedShort(fmtBb(r.hero_invested_bb))}</p>
                  <ResultBadge bb={r.hero_net_bb} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pr-9">
                <span className="w-9 text-xs font-semibold text-violet-300">{r.hero_position ?? "—"}</span>
                <MiniCards cards={r.hero_cards} />
                <MiniCards cards={r.board} className="ml-1" />
                <PreflopBadge verdict={r.preflop_check} />
                {r.has_note && <NotebookPen aria-label={t.list.hasNote} className="ml-auto h-4 w-4 text-amber-300" />}
              </div>
            </Link>
            <FavoriteStar
              on={r.favorited_at != null}
              pending={pending.has(r.id)}
              onToggle={() => onToggleFavorite(r.id)}
              className="absolute bottom-2 right-2"
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/[0.04] px-6 py-12 text-center">
      <p className="text-lg font-semibold">{t.overview.emptyTitle}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {t.overview.emptyBody}
      </p>
      <Link
        href={HANDS_IMPORT_PATH}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
      >
        <Upload className="h-4 w-4" /> {t.overview.importButton}
      </Link>
    </div>
  );
}
