"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { hasProAccess } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/client";
import { markReviewed } from "@/lib/handHistory/api";
import { HANDS_PATH } from "@/lib/handHistory/feature";
import { flopLineLabel, type FlopLine } from "@/lib/handHistory/flopCheck";
import { fmtBb, fmtNum, fmtPlayedDate } from "@/lib/handHistory/format";
import { actionLabel, type PreflopDetail } from "@/lib/handHistory/preflop";
import { t } from "@/lib/handHistory/strings";
import { SUMMARY_CONFIG } from "@/lib/handHistory/summary/config";
import { SUMMARY_FILTERS, scoreLabel, type SummaryFilter, type SummaryHand, type TournamentSummary } from "@/lib/handHistory/summary/compute";
import {
  ensureSummary,
  getSummaryTournament,
  previousScore,
  scoreHistory,
  type PreviousScore,
  type ScoreHistoryRow,
  type SummaryStage,
  type SummaryTournament,
} from "@/lib/handHistory/summary/api";
import { UpgradeButton } from "@/components/billing/UpgradeUi";
import { cn } from "@/lib/utils";
import { FlopBadge } from "./FlopBadge";
import { MiniCards } from "./MiniCards";
import { Popover } from "./Popover";
import { PreflopBadge } from "./PreflopBadge";
import { PageHeader, SectionNav } from "./SectionNav";

const s = t.summary;

const LABEL_STYLE: Record<ReturnType<typeof scoreLabel>, string> = {
  solid: "text-emerald-300",
  decent: "text-sky-200",
  leaky: "text-amber-200",
  puntProne: "text-rose-300",
};

/**
 * /hands/summary/[id]: the Stacked score, the mistake count and the hand
 * filters of one tournament. Shown right after an upload; the summary is
 * computed once and stored (lib/handHistory/summary/api.ts).
 */
export function TournamentSummaryView({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;
  const { entitlements } = useEntitlements();
  const pro = hasProAccess(entitlements);

  const [tournament, setTournament] = useState<SummaryTournament | null | undefined>(undefined);
  const [summary, setSummary] = useState<TournamentSummary | null>(null);
  const [final, setFinal] = useState(false);
  const [stage, setStage] = useState<{ stage: SummaryStage; done?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState<PreviousScore | null | undefined>(undefined);
  const [history, setHistory] = useState<ScoreHistoryRow[] | null>(null);
  const [filter, setFilter] = useState<SummaryFilter>("misplayed");
  const [attempt, setAttempt] = useState(0);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const tour = await getSummaryTournament(supabase, id);
        if (cancelled) return;
        setTournament(tour);
        if (!tour) return;
        markReviewed(supabase, { tournament: tour.id });
        void previousScore(supabase, tour.id)
          .then((p) => !cancelled && setPrev(p))
          .catch(() => !cancelled && setPrev(null));
        const result = await ensureSummary(supabase, tour, token, {
          onStage: (st, done) => !cancelled && setStage({ stage: st, done }),
          onPreliminary: (p) => !cancelled && setSummary(p),
        });
        if (cancelled) return;
        setSummary(result);
        setFinal(true);
        setStage(null);
      } catch (e) {
        if (!cancelled) {
          setStage(null);
          setError(e instanceof Error ? e.message : s.failed);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, id, token, authLoading, attempt]);

  // Pro: the score history (RLS shows Free accounts only their latest tournament).
  useEffect(() => {
    if (!pro || !final) return;
    let cancelled = false;
    scoreHistory(supabase)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [supabase, pro, final]);

  // On phones the cards stack and the list starts below the fold (behind the
  // fixed bottom banners), so a filter change would look like it did nothing:
  // bring the list up unless its top is already in the upper part of the screen.
  const showFilter = useCallback((f: SummaryFilter) => {
    setFilter(f);
    const el = listRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const showMisplayed = useCallback(() => showFilter("misplayed"), [showFilter]);

  const header = (
    <>
      <div className="mb-6">
        <SectionNav />
      </div>
      <PageHeader
        title={tournament?.name || s.title}
        subtitle={tournament ? s.meta(fmtNum(tournament.hand_count), tournament.last_hand_at ? fmtPlayedDate(tournament.last_hand_at) : "") : undefined}
      >
        {tournament && (
          <Link href={`${HANDS_PATH}?t=${encodeURIComponent(tournament.tournament_id)}&minPot=0`} className="text-sm font-semibold text-violet-300 hover:text-violet-200">
            {s.viewAllHands}
          </Link>
        )}
      </PageHeader>
    </>
  );

  if (tournament === null) {
    return (
      <div className="page-enter">
        {header}
        <p className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">{s.notFound}</p>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-4">
      {header}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="ml-auto rounded-lg border border-rose-400/40 px-3 py-1 text-xs font-semibold hover:bg-rose-500/10">
            {s.retry}
          </button>
        </div>
      )}

      {(stage || (!summary && !error)) && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
          {stage ? (stage.stage === "flop" ? s.stage.flop(stage.done ?? 0) : s.stage[stage.stage]) : s.loading}
        </div>
      )}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <ScoreCard summary={summary} prev={prev} preliminary={!final} />
            <MistakeCard summary={summary} onShow={showMisplayed} />
          </div>

          <section ref={listRef} aria-label={s.filtersLabel} className="scroll-mt-24 rounded-2xl border border-border/60 bg-card/40 p-4">
            <div role="tablist" aria-label={s.filtersLabel} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {SUMMARY_FILTERS.map((f) => {
                const active = f === filter;
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-summary-filter={f}
                    onClick={() => showFilter(f)}
                    className={cn(
                      "min-h-11 shrink-0 touch-manipulation rounded-xl border px-3 py-1.5 text-left transition",
                      active
                        ? "border-violet-400 bg-violet-500/30 text-white ring-1 ring-violet-400/60"
                        : "border-border/60 hover:border-violet-500/50 hover:bg-violet-500/10",
                    )}
                  >
                    <span className={cn("block text-[10px] font-semibold uppercase tracking-wide", active ? "text-violet-200" : "text-muted-foreground")}>{s.filter[f]}</span>
                    <span className="block font-mono text-sm font-bold leading-tight">{fmtNum(summary.lists[f].length)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {filter === "big"
                ? s.filterHint.big(SUMMARY_CONFIG.filters.big.minPotBb, Math.round(SUMMARY_CONFIG.filters.big.topShare * 100))
                : s.filterHint[filter]}
            </p>
            <HandList summary={summary} filter={filter} pro={pro} plansKnown={entitlements != null} />
          </section>

          {final && <History pro={pro} plansKnown={entitlements != null} history={history} currentId={id} />}
        </>
      )}
    </div>
  );
}

// ── Score ───────────────────────────────────────────────────────────────────

function ScoreCard({ summary, prev, preliminary }: { summary: TournamentSummary; prev: PreviousScore | null | undefined; preliminary: boolean }) {
  const score = summary.score;
  const label = score != null ? scoreLabel(score) : null;
  return (
    <section aria-labelledby="summary-score" className="rounded-2xl border border-[#7C5CFF]/30 bg-[#7C5CFF]/[0.07] p-5">
      <div className="flex items-center gap-1.5">
        <h2 id="summary-score" className="text-sm font-semibold">{s.scoreName}</h2>
        <Popover
          label={s.scoreInfoLabel}
          trigger={<Info className="h-3.5 w-3.5" />}
          triggerClassName="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          panelClassName="w-72 text-xs leading-relaxed text-slate-300"
        >
          {s.scoreInfo}
        </Popover>
      </div>
      {score != null && label ? (
        <div className="mt-2 flex items-end gap-3" data-summary-score={score}>
          <span className="font-mono text-6xl font-bold leading-none tracking-tight">{score}</span>
          <span className={cn("pb-1 text-lg font-semibold", LABEL_STYLE[label])}>{s.scoreLabel[label]}</span>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{s.noScore(SUMMARY_CONFIG.score.minGradedHands)}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{s.graded(summary.graded)}</p>
      {prev !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">{prev ? s.previous(prev.score, prev.name ?? "") : s.noPrevious}</p>
      )}
      {preliminary && <p className="mt-2 text-xs text-amber-200/80">{s.preliminary}</p>}
    </section>
  );
}

// ── Mistakes ────────────────────────────────────────────────────────────────

function MistakeCard({ summary, onShow }: { summary: TournamentSummary; onShow: () => void }) {
  const m = summary.mistakes;
  return (
    <button
      type="button"
      onClick={onShow}
      disabled={!m.total}
      title={s.showMisplayed}
      data-summary-mistakes={m.total}
      className="group rounded-2xl border border-border/60 bg-card/40 p-5 text-left transition hover:border-rose-500/40 hover:bg-rose-500/[0.05] disabled:cursor-default disabled:hover:border-border/60 disabled:hover:bg-card/40"
    >
      <p className="text-2xl font-bold leading-tight">{s.misplayed(m.total, summary.graded)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="text-amber-200">{s.smallCount(m.small)}</span> · <span className="text-rose-300">{s.bigCount(m.big)}</span>
      </p>
      {m.total > 0 && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 group-hover:text-violet-200">
          {s.showMisplayed} <ChevronRight className="h-3.5 w-3.5" />
        </p>
      )}
    </button>
  );
}

// ── Lists ───────────────────────────────────────────────────────────────────

function HandList({ summary, filter, pro, plansKnown }: { summary: TournamentSummary; filter: SummaryFilter; pro: boolean; plansKnown: boolean }) {
  const ids = summary.lists[filter];
  if (!ids.length) return <p className="mt-4 text-sm text-muted-foreground">{s.empty}</p>;
  // Free: a teaser of the list, then the upgrade prompt. Until the plan is known, only the teaser.
  const limit = pro ? ids.length : SUMMARY_CONFIG.freeTeaserHands;
  const shown = ids.slice(0, limit);
  return (
    <>
      <ul className="mt-3 divide-y divide-border/40">
        {shown.map((hid) => (
          <HandRow key={hid} hand={summary.hands[hid]} />
        ))}
      </ul>
      {!pro && plansKnown && ids.length > limit && (
        <div className="mt-3 max-w-md">
          <UpgradeButton source="tournament_summary">{s.seeAllWithPro(ids.length, s.filterWord[filter])}</UpgradeButton>
        </div>
      )}
    </>
  );
}

function HandRow({ hand }: { hand: SummaryHand | undefined }) {
  if (!hand) return null;
  const pre = hand.pre;
  const flop = hand.flop;
  return (
    <li>
      <Link
        href={`${HANDS_PATH}/${hand.id}`}
        aria-label={s.openHand}
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 transition hover:bg-violet-500/[0.06]"
      >
        <MiniCards cards={hand.cards} />
        <span className="w-10 text-xs font-semibold text-violet-300">{hand.pos ?? "—"}</span>
        <span className="w-24 font-mono text-xs text-muted-foreground">{s.potBb(fmtBb(hand.potBb))}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
          {pre && (
            <Line
              street={t.street.preflop}
              badge={<PreflopBadge verdict={pre.verdict} showAll />}
              you={actionLabel({ range: pre.range } as PreflopDetail, pre.act)}
              rec={pre.exp ? actionLabel({ range: pre.range } as PreflopDetail, pre.exp) : null}
            />
          )}
          {flop && (
            <Line
              street={t.street.flop}
              badge={<FlopBadge verdict={flop.verdict} showAll />}
              you={flopLineLabel({ ...flop.line, eventIndex: null } as FlopLine)}
              rec={flop.rec ? s.flopRec[flop.rec] : null}
            />
          )}
          {!pre && !flop && <span className="text-muted-foreground">{s.notGraded}</span>}
        </span>
        {hand.mistake && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              hand.mistake === "big" ? "border-rose-500/40 bg-rose-500/15 text-rose-300" : "border-amber-400/40 bg-amber-400/15 text-amber-200",
            )}
          >
            {s.mistake[hand.mistake]}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Line({ street, badge, you, rec }: { street: string; badge: React.ReactNode; you: string; rec: string | null }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="w-12 font-semibold text-muted-foreground">{street}</span>
      {badge}
      <span>
        {s.you}: <span className="font-semibold text-foreground">{you}</span>
      </span>
      {rec && (
        <span className="text-muted-foreground">
          · {s.recommended}: <span className="font-semibold text-foreground">{rec}</span>
        </span>
      )}
    </span>
  );
}

// ── History ─────────────────────────────────────────────────────────────────

function History({ pro, plansKnown, history, currentId }: { pro: boolean; plansKnown: boolean; history: ScoreHistoryRow[] | null; currentId: string }) {
  if (!plansKnown) return null;
  if (!pro) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" /> {s.historyLocked}
      </p>
    );
  }
  if (!history || history.length < 2) return null;
  return (
    <section aria-labelledby="summary-history" className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <h2 id="summary-history" className="mb-2 text-sm font-semibold">{s.historyTitle}</h2>
      <ul className="divide-y divide-border/40 text-sm">
        {history.map((h) => (
          <li key={h.id}>
            <Link
              href={`${HANDS_PATH}/summary/${h.id}`}
              aria-current={h.id === currentId ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-violet-500/[0.06]", h.id === currentId && "bg-violet-500/10")}
            >
              <span className="w-10 font-mono font-bold">{h.score}</span>
              <span className={cn("w-24 text-xs font-semibold", LABEL_STYLE[scoreLabel(h.score)])}>{s.scoreLabel[scoreLabel(h.score)]}</span>
              <span className="min-w-0 flex-1 truncate">{h.name || s.untitled}</span>
              <span className="text-xs text-muted-foreground">{h.last_hand_at ? fmtPlayedDate(h.last_hand_at) : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
