"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, NotebookPen, Upload } from "lucide-react";
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
  readQueryState,
  writeQueryState,
  type HandFilters,
  type HandQueryState,
} from "@/lib/handHistory/filters";
import { HANDS_IMPORT_PATH, HANDS_PATH } from "@/lib/handHistory/feature";
import { fmtBb, fmtNum, fmtPlayedAt, fmtSignedBb } from "@/lib/handHistory/format";
import type { HandListRow } from "@/lib/handHistory/rows";
import { t } from "@/lib/handHistory/strings";
import { cn } from "@/lib/utils";
import { FavoriteStar } from "./FavoriteStar";
import { FiltersBar } from "./HandFilterBar";
import { MiniCards } from "./MiniCards";
import { PreflopBadge } from "./PreflopBadge";
import { PreflopSummary } from "./PreflopSummary";
import { PageHeader, SectionNav } from "./SectionNav";

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

      <FiltersBar
        state={state}
        tournaments={tournaments}
        favCount={favCount}
        onChange={update}
        resultCount={rows ? count : null}
        totalCount={total}
      />

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {total === 0 && !error ? (
        <EmptyState />
      ) : (
        // Previous results stay (dimmed) while the next query runs, so nothing jumps.
        <div className={cn("relative mt-4 min-h-[360px] transition-opacity duration-200", loading && rows && "opacity-50")} aria-busy={loading}>
          {!rows ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground animate-fade-in">
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

// The filter bar lives in HandFilterBar.tsx; re-exported here for existing importers.
export { FiltersBar };

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

export function HandList({
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

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-label={t.overview.loading}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
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
