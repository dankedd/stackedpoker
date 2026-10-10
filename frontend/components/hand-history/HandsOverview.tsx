"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, NotebookPen, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countAllHands, listHands, listTournaments, type TournamentRow } from "@/lib/handHistory/api";
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
import { fmtBb, fmtPlayedAt, fmtSignedBb } from "@/lib/handHistory/format";
import type { HandListRow } from "@/lib/handHistory/rows";
import { cn } from "@/lib/utils";
import { MiniCards } from "./MiniCards";
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
  }, [supabase, state]);

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const linkSuffix = writeQueryState(state, false);

  return (
    <div className="page-enter">
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader
        title="Mijn handen"
        subtitle={
          total == null
            ? "Je geïmporteerde toernooihanden, gesorteerd op potgrootte."
            : `${total.toLocaleString("nl-NL")} handen geïmporteerd · ${count.toLocaleString("nl-NL")} voldoen aan je filters`
        }
      >
        <Link
          href={HANDS_IMPORT_PATH}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Upload className="h-4 w-4" /> Handen importeren
        </Link>
      </PageHeader>

      <FiltersBar state={state} tournaments={tournaments} onChange={update} />

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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Handen laden…
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
              Geen handen gevonden met deze filters. Verlaag de minimale potgrootte, kies een ander toernooi of zet
              &lsquo;Alleen handen waarin ik speel&rsquo; uit.
            </p>
          ) : (
            <HandList rows={rows} linkSuffix={linkSuffix} />
          )}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Paginering" className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={state.page <= 1}
            onClick={() => update({ page: state.page - 1 })}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Vorige
          </button>
          <span className="text-muted-foreground">
            Pagina {state.page} van {pages}
          </span>
          <button
            type="button"
            disabled={state.page >= pages}
            onClick={() => update({ page: state.page + 1 })}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 disabled:opacity-40"
          >
            Volgende <ChevronRight className="h-4 w-4" />
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
  onChange,
}: {
  state: HandQueryState;
  tournaments: TournamentRow[];
  onChange: (patch: Partial<Omit<HandQueryState, "filters">> & { filters?: Partial<HandFilters> }) => void;
}) {
  // Local value so the slider moves smoothly; the URL (and the query) follows after a pause.
  const [minPot, setMinPot] = useState(state.filters.minPotBb);
  useEffect(() => setMinPot(state.filters.minPotBb), [state.filters.minPotBb]);
  useEffect(() => {
    if (minPot === state.filters.minPotBb) return;
    const t = setTimeout(() => onChange({ filters: { minPotBb: minPot } }), 350);
    return () => clearTimeout(t);
  }, [minPot, state.filters.minPotBb, onChange]);

  return (
    <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div>
        <label htmlFor="minPot" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Minimale pot
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
              aria-label="Minimale pot in BB"
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
          Toernooi
        </label>
        <select
          id="tournament"
          value={state.filters.tournamentId ?? ""}
          onChange={(e) => onChange({ filters: { tournamentId: e.target.value || null } })}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
        >
          <option value="">Alle toernooien</option>
          {tournaments.map((t) => (
            <option key={`${t.site}:${t.tournament_id}`} value={t.tournament_id}>
              {(t.name ?? `#${t.tournament_id}`) + (t.last_hand_at ? ` · ${fmtPlayedAt(t.last_hand_at).split(",")[0]}` : "")} ({t.hand_count})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:col-span-2 xl:col-span-1">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.filters.heroInvolved}
            onChange={(e) => onChange({ filters: { heroInvolved: e.target.checked } })}
            className="h-4 w-4 accent-violet-500"
          />
          Alleen handen waarin ik speel
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.filters.withNotes}
            onChange={(e) => onChange({ filters: { withNotes: e.target.checked } })}
            className="h-4 w-4 accent-violet-500"
          />
          Alleen met notities
        </label>
        <div className="flex items-center gap-1">
          <label htmlFor="sort" className="sr-only">
            Sorteren op
          </label>
          <select
            id="sort"
            value={state.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
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
            aria-label={state.dir === "desc" ? "Aflopend — klik voor oplopend" : "Oplopend — klik voor aflopend"}
            title={state.dir === "desc" ? "Aflopend" : "Oplopend"}
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

function HandList({ rows, linkSuffix }: { rows: HandListRow[]; linkSuffix: string }) {
  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 md:block">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Datum</th>
              <th className="px-4 py-3 font-semibold">Toernooi</th>
              <th className="px-4 py-3 font-semibold">Pos.</th>
              <th className="px-4 py-3 font-semibold">Kaarten</th>
              <th className="px-4 py-3 font-semibold">Board</th>
              <th className="px-4 py-3 text-right font-semibold">Pot</th>
              <th className="px-4 py-3 text-right font-semibold">Inzet</th>
              <th className="px-4 py-3 text-right font-semibold">Resultaat</th>
              <th className="px-2 py-3" aria-label="Notitie" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => (
              <tr key={r.id} className="group relative transition-colors hover:bg-violet-500/[0.06]">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Link href={`${HANDS_PATH}/${r.id}${linkSuffix}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {fmtPlayedAt(r.played_at)}
                  </Link>
                </td>
                <td className="max-w-[220px] px-4 py-2.5">
                  <p className="truncate">{r.hh_tournaments?.name ?? `#${r.tournament_id}`}</p>
                  <p className="text-xs text-muted-foreground">Level {r.level ?? "?"}</p>
                </td>
                <td className="px-4 py-2.5 font-semibold text-violet-300">{r.hero_position ?? "—"}</td>
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
                <td className="px-2 py-2.5">{r.has_note && <NotebookPen aria-label="Heeft notitie" className="h-4 w-4 text-amber-300" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`${HANDS_PATH}/${r.id}${linkSuffix}`}
              className="block rounded-xl border border-border/60 bg-card/40 p-3 transition active:bg-violet-500/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.hh_tournaments?.name ?? `#${r.tournament_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtPlayedAt(r.played_at)} · Level {r.level ?? "?"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{fmtBb(r.pot_bb)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">inzet {fmtBb(r.hero_invested_bb)}</p>
                  <ResultBadge bb={r.hero_net_bb} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="w-9 text-xs font-semibold text-violet-300">{r.hero_position ?? "—"}</span>
                <MiniCards cards={r.hero_cards} />
                <MiniCards cards={r.board} className="ml-1" />
                {r.has_note && <NotebookPen aria-label="Heeft notitie" className="ml-auto h-4 w-4 text-amber-300" />}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/[0.04] px-6 py-12 text-center">
      <p className="text-lg font-semibold">Nog geen handen geïmporteerd</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Exporteer je toernooigeschiedenis in PokerCraft en upload het .zip-bestand. Daarna zie je hier je grootste potten.
      </p>
      <Link
        href={HANDS_IMPORT_PATH}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
      >
        <Upload className="h-4 w-4" /> Handen importeren
      </Link>
    </div>
  );
}
