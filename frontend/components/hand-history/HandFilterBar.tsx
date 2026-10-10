"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownUp, Check, ChevronDown, NotebookPen, SlidersHorizontal, Star, Trophy, X } from "lucide-react";
import { DEFAULT_MIN_POT_BB, isTargeted, SORT_LABELS, type HandQueryState, type SortKey } from "@/lib/handHistory/filters";
import { PRESETS, activeChips, activeCount, clearAll, restoreDefaults, withoutFavorites, type StatePatch } from "@/lib/handHistory/filterUi";
import { fmtNum, fmtPlayedDate } from "@/lib/handHistory/format";
import { PREFLOP_VERDICTS, VERDICT_LABEL, type PreflopVerdict } from "@/lib/handHistory/preflop";
import { t } from "@/lib/handHistory/strings";
import type { TournamentRow } from "@/lib/handHistory/api";
import { cn } from "@/lib/utils";
import { CardSearch } from "./CardSearch";
import { VERDICT_STYLE } from "./PreflopBadge";
import { Popover } from "./Popover";

const POT_SLIDER_MAX = 200;
const fmtBbValue = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Change = (patch: StatePatch) => void;

const btn = (on: boolean, muted = false) =>
  cn(
    "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition-colors duration-150",
    on ? "border-violet-500/50 bg-violet-500/15 text-violet-100" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
    muted && "opacity-45",
  );

/**
 * The hand list's one filter bar: card search, the default filters (pot,
 * played), the targeted filters (preflop, favorites, notes), tournament and
 * sort; removable chips, quick presets and the live count below. On phones
 * everything but the search moves into a bottom sheet.
 *
 * Props `state`, `tournaments`, `favCount`, `onChange` are kept stable for
 * external users (the Hand Review video ad); the rest is optional.
 */
export function FiltersBar({
  state,
  tournaments,
  favCount,
  onChange,
  resultCount,
  totalCount,
}: {
  state: HandQueryState;
  tournaments: TournamentRow[];
  favCount: number | null;
  onChange: Change;
  /** Hands matching the filters (null while counting). */
  resultCount?: number | null;
  totalCount?: number | null;
}) {
  const [sheet, setSheet] = useState(false);
  const overridden = isTargeted(state.filters);
  const tName = (id: string) => tournaments.find((x) => x.tournament_id === id)?.name ?? undefined;
  const chips = activeChips(state, (id) => tName(id) ?? undefined);
  const n = activeCount(state);

  return (
    <div className="space-y-3">
      {/* ── The bar ── */}
      <div className="flex flex-wrap items-start gap-2">
        <CardSearch terms={state.filters.cards} onChange={(cards) => onChange({ filters: { cards } })} className="min-w-[200px] flex-1" />
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <PotControl state={state} onChange={onChange} muted={overridden} />
          <PlayedToggle state={state} onChange={onChange} muted={overridden} />
          <PreflopControl state={state} onChange={onChange} />
          <FavToggle state={state} onChange={onChange} favCount={favCount} />
          <NotesToggle state={state} onChange={onChange} />
          <TournamentControl state={state} onChange={onChange} tournaments={tournaments} />
          <SortControl state={state} onChange={onChange} />
        </div>
        <button type="button" data-filter="mobile-sheet" onClick={() => setSheet(true)} className={cn(btn(n > 0), "md:hidden")}>
          <SlidersHorizontal className="h-4 w-4" /> {t.filterBar.mobileFilters(n)}
        </button>
      </div>

      {/* ── Presets ── */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.filterBar.presets}>
        {PRESETS.map((p) => {
          const on = p.isActive(state);
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={on}
              data-preset={p.key}
              onClick={() => onChange(p.apply(state))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150",
                on ? "border-violet-500/50 bg-violet-500/20 text-violet-100" : "border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Active chips, override note, count ── */}
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 py-0.5 pl-2.5 pr-1 text-xs text-violet-100 animate-fade-in">
            {c.label}
            <button type="button" aria-label={t.filterBar.remove(c.label)} onClick={() => onChange(c.remove)} className="rounded-full p-0.5 hover:bg-white/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {chips.length > 0 && (
          <button type="button" onClick={() => onChange(clearAll(state))} className="px-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t.filterBar.clearAll}
          </button>
        )}
        {overridden && (
          <span className="text-xs text-muted-foreground">
            {t.filterBar.overridden} ·{" "}
            <button type="button" onClick={() => onChange(restoreDefaults(state))} className="text-violet-300 underline-offset-2 hover:underline">
              {t.filterBar.restoreDefaults}
            </button>
          </span>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground" aria-live="polite">
          {resultCount == null || totalCount == null ? t.filterBar.countLoading : t.filterBar.count(fmtNum(resultCount), fmtNum(totalCount))}
        </span>
      </div>

      {sheet && (
        <MobileSheet onClose={() => setSheet(false)} doneLabel={`${t.filterBar.done}${resultCount != null ? ` (${fmtNum(resultCount)})` : ""}`}>
          <Section title={t.filterBar.potTitle} muted={overridden}>
            <PotSlider state={state} onChange={onChange} />
          </Section>
          <Section title={t.filterBar.playedTitle} muted={overridden}>
            <PlayedToggle state={state} onChange={onChange} muted={false} wide />
          </Section>
          <Section title={t.filterBar.preflopTitle}>
            <PreflopOptions state={state} onChange={onChange} />
          </Section>
          <Section title={`${t.filterBar.favorites} · ${t.filterBar.notes}`}>
            <div className="flex flex-wrap gap-2">
              <FavToggle state={state} onChange={onChange} favCount={favCount} />
              <NotesToggle state={state} onChange={onChange} />
            </div>
          </Section>
          <Section title={t.filterBar.tournament}>
            <TournamentSelect state={state} onChange={onChange} tournaments={tournaments} />
          </Section>
          <Section title={t.filterBar.sortTitle}>
            <SortOptions state={state} onChange={onChange} />
          </Section>
        </MobileSheet>
      )}
    </div>
  );
}

// ── Controls ─────────────────────────────────────────────────────────────────

function PotSlider({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  // Local value so the slider moves smoothly; the URL (and the query) follows after a pause.
  const [v, setV] = useState(state.filters.minPotBb);
  useEffect(() => setV(state.filters.minPotBb), [state.filters.minPotBb]);
  useEffect(() => {
    if (v === state.filters.minPotBb) return;
    const timer = setTimeout(() => onChange({ filters: { minPotBb: v } }), 300);
    return () => clearTimeout(timer);
  }, [v, state.filters.minPotBb, onChange]);
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={POT_SLIDER_MAX}
        value={Math.min(v, POT_SLIDER_MAX)}
        onChange={(e) => setV(Number(e.target.value))}
        aria-label={t.filterBar.potAria}
        className="h-2 w-full min-w-[160px] cursor-pointer accent-violet-500"
      />
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={v}
        aria-label={t.filterBar.potAria}
        onChange={(e) => {
          const x = Number(e.target.value);
          setV(Number.isFinite(x) && x >= 0 ? x : 0);
        }}
        className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-right font-mono text-sm"
      />
      <span className="text-sm text-muted-foreground">BB</span>
    </div>
  );
}

function PotControl({ state, onChange, muted }: { state: HandQueryState; onChange: Change; muted: boolean }) {
  const p = state.filters.minPotBb;
  return (
    <Popover
      dataFilter="pot"
      label={t.filterBar.potTitle}
      active={p !== DEFAULT_MIN_POT_BB}
      triggerClassName={btn(p !== DEFAULT_MIN_POT_BB, muted)}
      trigger={
        <>
          {p > 0 ? t.filterBar.pot(fmtBbValue(p)) : t.filterBar.potAny}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </>
      }
    >
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.filterBar.potTitle}</p>
      <PotSlider state={state} onChange={onChange} />
    </Popover>
  );
}

function PlayedToggle({ state, onChange, muted, wide }: { state: HandQueryState; onChange: Change; muted: boolean; wide?: boolean }) {
  const on = state.filters.heroInvolved;
  return (
    <button
      type="button"
      aria-pressed={on}
      data-filter="played"
      title={t.filterBar.playedHelp}
      onClick={() => onChange({ filters: { heroInvolved: !on } })}
      className={cn(btn(on, muted), wide && "w-full justify-between")}
    >
      {on && <Check className="h-3.5 w-3.5" />} {wide ? (on ? t.filterBar.playedTitle : t.filterBar.playedOff) : t.filterBar.played}
    </button>
  );
}

function PreflopOptions({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  const pf = state.filters.preflop;
  const toggle = (v: PreflopVerdict) =>
    onChange({ filters: { preflop: pf.includes(v) ? pf.filter((x) => x !== v) : PREFLOP_VERDICTS.filter((x) => x === v || pf.includes(x)) } });
  return (
    <div className="flex flex-wrap gap-1.5">
      {PREFLOP_VERDICTS.filter((v) => v !== "correct").map((v) => {
        const on = pf.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            data-verdict={v}
            onClick={() => toggle(v)}
            className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-150", on ? VERDICT_STYLE[v] : "border-border/60 text-muted-foreground hover:text-foreground")}
          >
            {VERDICT_LABEL[v]}
          </button>
        );
      })}
    </div>
  );
}

function PreflopControl({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  const k = state.filters.preflop.length;
  return (
    <Popover
      dataFilter="preflop"
      label={t.filterBar.preflopTitle}
      active={k > 0}
      triggerClassName={btn(k > 0)}
      panelClassName="w-72"
      trigger={
        <>
          {t.filterBar.preflop}
          {k > 0 && <span className="rounded-full bg-violet-500/30 px-1.5 text-[11px]">{k}</span>}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </>
      }
    >
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.filterBar.preflopTitle}</p>
      <PreflopOptions state={state} onChange={onChange} />
    </Popover>
  );
}

function FavToggle({ state, onChange, favCount }: { state: HandQueryState; onChange: Change; favCount: number | null }) {
  const on = state.filters.favorites;
  return (
    <button
      type="button"
      aria-pressed={on}
      data-filter="favorites"
      aria-label={t.filterBar.favorites}
      title={t.filterBar.favorites}
      onClick={() => onChange(on ? withoutFavorites(state) : { filters: { favorites: true } })}
      className={cn(btn(on), on && "border-amber-400/50 bg-amber-400/15 text-amber-200")}
    >
      <Star className={cn("h-4 w-4", on && "fill-amber-400 text-amber-400")} />
      {favCount != null && <span className="font-mono text-xs opacity-80">{fmtNum(favCount)}</span>}
    </button>
  );
}

function NotesToggle({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  const on = state.filters.withNotes;
  return (
    <button type="button" aria-pressed={on} data-filter="notes" onClick={() => onChange({ filters: { withNotes: !on } })} className={btn(on)}>
      <NotebookPen className="h-4 w-4" /> {t.filterBar.notes}
    </button>
  );
}

function TournamentSelect({ state, onChange, tournaments }: { state: HandQueryState; onChange: Change; tournaments: TournamentRow[] }) {
  return (
    <select
      aria-label={t.filterBar.tournament}
      value={state.filters.tournamentId ?? ""}
      onChange={(e) => onChange({ filters: { tournamentId: e.target.value || null } })}
      className="w-full rounded-lg border border-border/60 bg-background px-2 py-2 text-sm"
    >
      <option value="">{t.filterBar.allTournaments}</option>
      {tournaments.map((tr) => (
        <option key={`${tr.site}:${tr.tournament_id}`} value={tr.tournament_id}>
          {(tr.name ?? `#${tr.tournament_id}`) + (tr.last_hand_at ? ` · ${fmtPlayedDate(tr.last_hand_at)}` : "")} ({fmtNum(tr.hand_count)})
        </option>
      ))}
    </select>
  );
}

function TournamentControl({ state, onChange, tournaments }: { state: HandQueryState; onChange: Change; tournaments: TournamentRow[] }) {
  const on = !!state.filters.tournamentId;
  return (
    <Popover
      dataFilter="tournament"
      label={t.filterBar.tournament}
      active={on}
      triggerClassName={btn(on)}
      panelClassName="w-80"
      trigger={
        <>
          <Trophy className="h-4 w-4" /> {t.filterBar.tournament}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </>
      }
    >
      <TournamentSelect state={state} onChange={onChange} tournaments={tournaments} />
    </Popover>
  );
}

const SORTS: SortKey[] = ["pot", "invested", "result", "date", "favorited"];

function SortOptions({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  const isDate = state.sort === "date" || state.sort === "favorited";
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-0.5" role="radiogroup" aria-label={t.filterBar.sortTitle}>
        {SORTS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={state.sort === k}
            // Sorting by star date means looking at favourites (filters.ts turns them on).
            onClick={() => onChange(k === "favorited" ? { sort: k, filters: { favorites: true } } : { sort: k })}
            className={cn(
              "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
              state.sort === k ? "bg-violet-500/15 text-violet-100" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            {SORT_LABELS[k]}
            {state.sort === k && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>
      <div className="flex gap-1 rounded-lg border border-white/10 p-0.5 text-xs font-semibold">
        {(["desc", "asc"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={state.dir === d}
            onClick={() => onChange({ dir: d })}
            className={cn("flex-1 rounded-md px-2 py-1 transition-colors", state.dir === d ? "bg-violet-500/25 text-violet-100" : "text-slate-400 hover:text-white")}
          >
            {d === "desc" ? (isDate ? t.filterBar.newestFirst : t.filterBar.descending) : isDate ? t.filterBar.oldestFirst : t.filterBar.ascending}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortControl({ state, onChange }: { state: HandQueryState; onChange: Change }) {
  return (
    <Popover
      dataFilter="sort"
      label={t.filterBar.sortTitle}
      align="end"
      triggerClassName={btn(false)}
      panelClassName="w-60"
      trigger={
        <>
          <ArrowDownUp className="h-4 w-4" /> {SORT_LABELS[state.sort]}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </>
      }
    >
      <SortOptions state={state} onChange={onChange} />
    </Popover>
  );
}

// ── Mobile sheet ─────────────────────────────────────────────────────────────

function Section({ title, muted, children }: { title: string; muted?: boolean; children: ReactNode }) {
  return (
    <section className={cn("space-y-2 border-b border-border/40 pb-4 last:border-0", muted && "opacity-45")}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MobileSheet({ onClose, doneLabel, children }: { onClose: () => void; doneLabel: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t.filterBar.mobileFilters(0)}>
      <button type="button" aria-label={t.filterBar.close} onClick={onClose} className="absolute inset-0 bg-black/60 animate-fade-in" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-white/10 bg-[#0B1120] shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold">{t.filterBar.mobileFilters(0)}</span>
          <button type="button" aria-label={t.filterBar.close} onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">{children}</div>
        <div className="border-t border-white/10 p-3">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
