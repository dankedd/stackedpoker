"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronDown, SlidersHorizontal } from "lucide-react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { Modal } from "@/components/ui/modal";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { track } from "@/lib/metaPixel";
import {
  actionName,
  applyVerdict,
  availableActions,
  displayPos,
  frequencies,
  grade,
  newDeal,
  pushValue,
  scenarioTitle,
  scorePct,
  spotLabel,
  type Deal,
  type Grade,
  type TrainerMode,
  type TrainerStats,
  type TrainerType,
} from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import { chartHrefForDeal, parseTrainerQuery, trainerQuery } from "@/lib/ranges/urlState";
import { submitTrainerHand, type HandXpResult } from "@/lib/ranges/api";
import { useLearnProgress } from "@/contexts/LearnProgressContext";
import { LevelUpModal } from "@/components/learn/LevelUpModal";
import { XPGain } from "@/components/learn/XPGain";
import { cn } from "@/lib/utils";
import { ACTION_ORDER, HandBreakdown, Pills, SourceLegend, Swatch, TOOL_SLUG, toStrategies } from "./shared";
import { ActionButtons, HOTKEY, PhoneTable, Table, VERDICT } from "./TrainerTable";
import { useIsPhone } from "@/hooks/useIsMobile";
import { useScrollToSpot } from "@/hooks/useScrollToSpot";
import { useTrainerProgress } from "./useTrainerProgress";
import { GuestSignup, useGuestSignup } from "./GuestSignup";
import { TrainerLimitGate, useTrainerLimit } from "./TrainerLimit";

const TYPE_LABEL: Record<TrainerType, string> = { open: "Open", def: "Defense", mix: "Mixed" };
const MODE_LABEL: Record<TrainerMode, string> = { all: "All", mtt: "MTT", pf: "Push/fold ≤10bb", cash: "Cash 100bb" };

/** XP for one hand — always from the server, never computed in the browser. */
type AnswerXp =
  | { status: "guest" }
  | { status: "pending" }
  | { status: "done"; result: HandXpResult }
  | { status: "error" };

interface Answer {
  /** Increments per hand, so a late server reply never lands on the next hand. */
  id: number;
  key: RangeActionKey;
  grade: Grade;
  streakBefore: number;
  newRecord: boolean;
  xp: AnswerXp;
}

export function Trainer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Filters live in the query string so a shared link opens the same setup.
  const { type, game: mode, fewerFolds } = parseTrainerQuery(params);
  const setFilters = useCallback(
    (t: TrainerType, m: TrainerMode, ff: boolean) =>
      router.replace(`${pathname}${trainerQuery({ type: t, game: m, fewerFolds: ff })}`, { scroll: false }),
    [router, pathname],
  );
  const [deal, setDeal] = useState<Deal | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [stats, setStats] = useState<TrainerStats>({ hands: 0, correct: 0, mixed: 0, streak: 0 });
  const { signedIn, token, high, xpState, recordLocalStreak, applyHandResult, resetLocal } = useTrainerProgress();
  const { progress, applyServerXpTotal, dismissLevelUp } = useLearnProgress();
  const answerId = useRef(0);
  // Signed out: count hands locally and offer to save them after hand 5 and 20.
  const guest = useGuestSignup();
  const recordGuestHand = guest.recordHand;
  // Free plan: 50 answered hands a day (the server refuses hand 51 when signed in).
  const trainerLimit = useTrainerLimit(signedIn);
  const { allowHand, recordGuestHand: countGuestDailyHand, applyServerUsage, handleServerError } = trainerLimit;
  const [showFilters, setShowFilters] = useState(false);
  // ≤480px: the calmer phone table, a one-line stats row and the result inline under the table.
  const phone = useIsPhone();
  // Phone: after "Next hand" the inline result is gone and the page is shorter — bring the table back.
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollToSpot(rootRef, deal, { enabled: phone, focusSelector: '[data-tour="trainer-actions"]' });

  // Signed in, the streak lives on the server and carries over between sessions.
  const serverStreak = xpState?.streak;
  useEffect(() => {
    if (serverStreak !== undefined) setStats((s) => (s.hands === 0 ? { ...s, streak: serverStreak } : s));
  }, [serverStreak]);

  // Dealt client-side only: Math.random during render would differ between
  // the server HTML and hydration.
  const next = useCallback(
    (t = type, m = mode, ff = fewerFolds) => {
      setAnswer(null);
      setDeal(newDeal(t, m, ff, Math.random));
    },
    [type, mode, fewerFolds],
  );
  useEffect(() => {
    next();
    // First hand only — later hands are dealt by explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback(
    (k: RangeActionKey) => {
      if (!deal || answer) return;
      if (!allowHand()) return;
      // Instant local verdict for the feedback; XP and the authoritative streak follow from the server.
      const g = grade(deal, deal.hand, k);
      const nextStats = applyVerdict(stats, g.verdict);
      const id = ++answerId.current;
      setStats(nextStats);
      if (!signedIn) {
        recordGuestHand(deal, g.verdict);
        countGuestDailyHand();
        const newRecord = recordLocalStreak(nextStats.streak);
        setAnswer({ id, key: k, grade: g, streakBefore: stats.streak, newRecord, xp: { status: "guest" } });
      } else {
        setAnswer({ id, key: k, grade: g, streakBefore: stats.streak, newRecord: false, xp: { status: "pending" } });
        submitTrainerHand(token, deal, k).then(
          (result) => {
            const newRecord = applyHandResult(result);
            setStats((s) => ({ ...s, streak: result.streak }));
            applyServerXpTotal(result.total_xp);
            applyServerUsage(result.usage);
            setAnswer((a) => (a && a.id === id ? { ...a, newRecord, xp: { status: "done", result } } : a));
          },
          (err) => {
            // Over the daily limit: the hand never counted, so drop it and show the limit screen.
            if (handleServerError(err)) {
              setStats(stats);
              setAnswer((a) => (a && a.id === id ? null : a));
            } else {
              setAnswer((a) => (a && a.id === id ? { ...a, xp: { status: "error" } } : a));
            }
          },
        );
      }
      // First answered hand of the visit: the drill has started.
      if (nextStats.hands === 1) track("ViewContent", { content_name: "Preflop Trainer drill" });
      if (nextStats.hands % 25 === 0) {
        trackEvent(SEO_EVENTS.toolCalculate, { tool_slug: TOOL_SLUG, hands: nextStats.hands, score: scorePct(nextStats) });
      }
    },
    [
      deal,
      answer,
      stats,
      signedIn,
      token,
      recordLocalStreak,
      applyHandResult,
      applyServerXpTotal,
      recordGuestHand,
      allowHand,
      countGuestDailyHand,
      applyServerUsage,
      handleServerError,
    ],
  );

  // Keyboard: only the visible buttons, Enter/Space for the next hand.
  const keyState = useRef({ deal, answer, choose, next });
  keyState.current = { deal, answer, choose, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { deal: d, answer: a, choose: c, next: n } = keyState.current;
      const k = e.key.toLowerCase();
      if (a) {
        if (k === "enter" || k === " " || k === "escape") {
          e.preventDefault();
          n();
        }
        return;
      }
      if (!d) return;
      const hit = availableActions(d).find((x) => HOTKEY[x].toLowerCase() === k);
      if (hit) {
        e.preventDefault();
        c(hit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const modeOptions: TrainerMode[] = type === "open" ? ["all", "mtt", "pf", "cash"] : ["all", "mtt", "cash"];

  return (
    <div ref={rootRef} tabIndex={-1} className="scroll-mt-[max(12px,env(safe-area-inset-top))] outline-none [overflow-anchor:none]">
      {/* Phone: the filters fold into one summary row so the table is on screen right away. */}
      <button
        type="button"
        aria-expanded={showFilters}
        aria-controls="trainer-filters"
        onClick={() => setShowFilters((v) => !v)}
        className="mb-3 flex w-full items-center gap-2 rounded-xl border border-border bg-card/40 px-3.5 py-2.5 text-left text-sm md:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-300" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {TYPE_LABEL[type]}
          {!phone && (
            <>
              {" "}· {MODE_LABEL[mode]}
              {fewerFolds && <span className="text-muted-foreground"> · fewer folds</span>}
            </>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", showFilters && "rotate-180")}
        />
      </button>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div id="trainer-filters" className={cn("space-y-3", showFilters ? "block" : "hidden md:block")}>
          <Pills
            label="Type"
            value={type}
            options={["open", "def", "mix"]}
            onChange={(t) => {
              const nt = t as TrainerType;
              const nm = nt !== "open" && mode === "pf" ? "all" : mode;
              setFilters(nt, nm, fewerFolds);
              next(nt, nm);
            }}
            format={(t) => TYPE_LABEL[t]}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Pills
              label="Game"
              value={mode}
              options={modeOptions}
              onChange={(m) => {
                setFilters(type, m as TrainerMode, fewerFolds);
                next(type, m as TrainerMode);
              }}
              format={(m) => MODE_LABEL[m]}
            />
            <button
              type="button"
              aria-pressed={fewerFolds}
              title="Hands that are always folded come up less often"
              onClick={() => setFilters(type, mode, !fewerFolds)}
              className={cn(
                "h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                fewerFolds
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              Fewer trivial folds
            </button>
          </div>
        </div>
        {/* Phone (≤480px): one compact line. */}
        {phone && (
          <p data-tour="trainer-stats" className="w-full truncate text-xs tabular-nums text-muted-foreground" aria-live="polite">
            <b className="font-mono text-foreground">{scorePct(stats)}%</b>
            <span className="text-muted-foreground/60"> ({stats.correct + stats.mixed}/{stats.hands})</span> · 🔥{" "}
            <b className="font-mono text-foreground">{stats.streak}</b> · Best <b className="font-mono text-foreground">{high}</b>
            {xpState && (
              <>
                {" "}· <b className="font-mono text-foreground">{xpState.daily_xp}</b>/{xpState.daily_cap} XP
              </>
            )}
          </p>
        )}
        {/* Tablet: four tiles instead of a line that wraps. */}
        <dl data-tour={phone ? undefined : "trainer-stats"} className={cn("grid w-full grid-cols-4 gap-1.5 md:hidden", phone && "hidden")} aria-live="polite">
          {[
            ["Score", `${scorePct(stats)}%`, `${stats.correct + stats.mixed}/${stats.hands}`],
            ["Streak", stats.streak, null],
            ["Record", high, null],
            xpState ? ["XP today", xpState.daily_xp, `/${xpState.daily_cap}`] : ["Hands", stats.hands, null],
          ].map(([k, v, sub]) => (
            <div key={String(k)} className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-center">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="font-mono text-base font-semibold tabular-nums text-foreground">
                {v}
                {sub && <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{sub}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <dl data-tour="trainer-stats" className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground md:flex" aria-live="polite">
          {[
            ["Hands", stats.hands],
            ["Correct", stats.correct],
            ["Mixed", stats.mixed],
            ["Score", `${scorePct(stats)}%`],
            ["Streak", stats.streak],
            ["Record", high],
            ...(xpState ? [["XP today", `${xpState.daily_xp}/${xpState.daily_cap}`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-1.5">
              <dt>{k}</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
          {!signedIn && high > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reset your record to 0?")) resetLocal();
              }}
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              reset
            </button>
          )}
        </dl>
      </div>

      <div
        data-tour="trainer-spot"
        // Phone: with the result open under the table, a tap on the table deals the next hand.
        onClick={phone && answer ? () => next() : undefined}
        className={cn(phone && answer && "cursor-pointer")}
      >
        {deal ? (
          phone ? <PhoneTable deal={deal} /> : <Table deal={deal} />
        ) : (
          <div className="mx-auto aspect-[16/9.6] max-w-[860px] animate-pulse rounded-[999px] bg-card/40" />
        )}
      </div>

      <div data-tour="trainer-actions">{deal && <ActionButtons deal={deal} onChoose={choose} disabled={Boolean(answer)} phone={phone} />}</div>

      <GuestSignup guest={guest} resultOpen={Boolean(answer)} />

      <TrainerLimitGate limit={trainerLimit} resultOpen={Boolean(answer)} compact={phone} />

      {deal && answer && <ResultModal deal={deal} answer={answer} stats={stats} high={high} onNext={() => next()} inline={phone} />}

      {/* Same level-up celebration as Learn, once the result is closed. */}
      {!answer && progress.pendingLevelUp && (
        <LevelUpModal event={progress.pendingLevelUp} onContinue={dismissLevelUp} onDismiss={dismissLevelUp} token={token || undefined} />
      )}
    </div>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────

function ResultModal({
  deal,
  answer,
  stats,
  high,
  onNext,
  inline,
}: {
  deal: Deal;
  answer: Answer;
  stats: TrainerStats;
  high: number;
  onNext: () => void;
  /**
   * Phone: the result sits in the page under the table instead of in a modal —
   * no fixed overlay, no viewport-height cap and no sticky button, so the
   * browser's dynamic toolbars can never cover the range or the button.
   */
  inline?: boolean;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
    if (inline) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [inline]);
  const { grade: g, key: k } = answer;
  const name = (x: RangeActionKey) => actionName(x, deal);
  const pct = (x: number) => Math.round(x * 100);
  const explanation =
    g.verdict === "correct"
      ? `${name(k)} is ${g.chosen >= 0.999 ? "the only right play" : `the main play (${pct(g.chosen)}%)`}.`
      : g.verdict === "mixed"
        ? `The chart plays ${name(k).toLowerCase()} here ${pct(g.chosen)}% of the time; the main play is ${name(g.bestKey).toLowerCase()} (${pct(g.best)}%).`
        : `The chart plays ${name(g.bestKey).toLowerCase()} (${pct(g.best)}%)${g.chosen > 0 ? `; ${name(k).toLowerCase()} only ${pct(g.chosen)}%` : ""}.`;
  const context =
    deal.type === "def"
      ? `${displayPos(deal.hero)}, ${spotLabel(deal).replace(/^You/, "you")}${deal.fmt === "mtt" ? ` (${deal.stack}bb)` : " (cash)"}`
      : scenarioTitle(deal);
  const streakText =
    g.verdict === "wrong"
      ? answer.streakBefore > 0
        ? `Streak ended at ${answer.streakBefore}`
        : "Streak 0"
      : `Streak ${stats.streak}`;
  const cardsText = deal.cards
    .map((c) => (c[0] === "T" ? "10" : c[0]) + ({ s: "♠", h: "♥", d: "♦", c: "♣" } as Record<string, string>)[c[1]])
    .join(" ");

  const content = (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={cn("rounded-full border px-3 py-1 text-sm font-bold", VERDICT[g.verdict].className)}>
          {VERDICT[g.verdict].label}
        </span>
        {answer.newRecord && (
          <span className="animate-fade-in rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-black">New record!</span>
        )}
        <span className="ml-auto text-right text-xs text-muted-foreground">
          {streakText} · Record <b className="font-mono text-foreground">{high}</b>
        </span>
        <p className="basis-full text-sm leading-relaxed text-muted-foreground">
          <b className="font-mono text-foreground">{deal.hand}</b> ({cardsText}) · {context}. {explanation}
        </p>
        <XpLine xp={answer.xp} />
      </div>

      {/* Phone: what your hand does comes before the 169-cell grid, not after it. */}
      <div className="mb-4 rounded-xl border border-border/60 bg-card/30 p-3 md:hidden">
        {deal.kind === "pf" ? (
          <PushFoldResult deal={deal} chosen={k} />
        ) : (
          <HandBreakdown
            hand={deal.hand}
            row={deal.chart.grid[deal.hand]}
            actions={deal.chart.actions}
            labelFor={(a) => name(a.key)}
            chosen={k}
          />
        )}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_250px] md:gap-6">
        {/* Own stacking context: the grid's cell labels (z-10) and tooltips must never paint over the modal's sticky title or "Next hand" bar. */}
        <div className="isolate min-w-0">
        {deal.kind === "pf" ? (
          <PokerRangeGrid
            range={[]}
            mode="pushfold"
            pushValues={Object.fromEntries(Object.entries(deal.chart.grid).map(([h, c]) => [h, pushValue(c)]))}
            pushThreshold={deal.stack}
            highlightHand={deal.hand}
          />
        ) : (
          <PokerRangeGrid
            range={[]}
            mode="strategy"
            strategyActionOrder={ACTION_ORDER}
            {...(() => {
              const { strategies, absent } = toStrategies(deal.chart.grid, deal.chart.actions);
              return { strategies, absentHands: absent };
            })()}
            highlightHand={deal.hand}
            hideLegend
          />
        )}
        </div>
        <aside className="space-y-4">
          <Link
            href={chartHrefForDeal(deal)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View full chart
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab, so this session keeps its score)</span>
          </Link>
          {/* Defense spots: what happened before Hero acts. */}
          {deal.type === "def" && <p className="text-xs text-muted-foreground">{spotLabel(deal)}</p>}
          {deal.kind === "pf" ? (
            <div className="hidden md:block">
              <PushFoldResult deal={deal} chosen={k} />
            </div>
          ) : (
            <>
              <SourceLegend
                actions={deal.chart.actions}
                showAbsent={Object.values(deal.chart.grid).some((v) => v === null)}
              />
              <div className="hidden border-t border-border/50 pt-3 md:block">
                <HandBreakdown
                  hand={deal.hand}
                  row={deal.chart.grid[deal.hand]}
                  actions={deal.chart.actions}
                  labelFor={(a) => name(a.key)}
                  chosen={k}
                />
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Modal: stays on screen while the chart scrolls underneath. Inline (phone): a plain button right under the range. */}
      <div
        className={cn(
          inline
            ? "mt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "sticky bottom-0 -mx-4 mt-5 border-t border-white/[0.07] bg-[#0B1120] px-4 py-3 sm:-mx-6 sm:px-6 sm:py-5",
        )}
      >
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Next hand<span className="hidden md:inline">&nbsp;(Enter)</span>
        </button>
      </div>
    </>
  );

  if (inline) {
    return (
      <section
        ref={sectionRef}
        data-tour="trainer-result"
        aria-label={scenarioTitle(deal)}
        className="mt-5 scroll-mt-3 rounded-2xl border border-white/10 bg-[#0B1120] px-4 pt-4 shadow-2xl shadow-black/40"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">{scenarioTitle(deal)}</h2>
        {content}
      </section>
    );
  }

  return (
    <Modal
      open
      onClose={onNext}
      title={scenarioTitle(deal)}
      dataTour="trainer-result"
      maxWidthClassName="max-w-4xl"
      bodyClassName="px-4 pt-4 sm:px-6 sm:pt-5"
    >
      {content}
    </Modal>
  );
}

/** What this hand earned, and how the streak bonus moves — straight from the server's reply. */
function XpLine({ xp }: { xp: AnswerXp }) {
  if (xp.status === "guest") {
    return (
      <p className="basis-full text-xs text-muted-foreground">
        <Link href="/signup" className="font-semibold text-violet-300 underline-offset-4 hover:underline">
          Sign up free
        </Link>{" "}
        to earn XP for every hand and climb the leaderboard.
      </p>
    );
  }
  if (xp.status === "pending") {
    return <p className="basis-full h-9 animate-pulse text-xs text-muted-foreground">Saving XP…</p>;
  }
  if (xp.status === "error") {
    return <p className="basis-full text-xs text-amber-300/90">This hand could not be saved, so it earned no XP.</p>;
  }
  const r = xp.result;
  const capped = r.daily_xp >= r.daily_cap;
  const tier =
    r.streak === 0
      ? "Build a streak: every 10 hands in a row add 1 XP per correct hand."
      : r.next_tier_at
        ? `${r.next_tier_at - r.streak} more in a row for ${r.xp_per_correct + 1} XP per correct hand.`
        : `Top streak bonus: ${r.xp_per_correct} XP per correct hand.`;
  return (
    <div className="flex basis-full flex-wrap items-center gap-3">
      {r.xp_awarded > 0 && <XPGain xp={r.xp_awarded} className="px-3 py-1" />}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {r.too_fast
          ? "Too quick after the last hand — no XP for this one."
          : capped && r.xp_awarded === 0
            ? "Today's trainer XP is maxed out — your streak and record still count."
            : tier}{" "}
        <span className="whitespace-nowrap">
          Today <b className="font-mono text-foreground">{r.daily_xp}</b>/{r.daily_cap} XP
        </span>
        {r.leveled_up && <span className="ml-1 font-semibold text-amber-300">· Level {r.level}!</span>}
      </p>
    </div>
  );
}

function PushFoldResult({ deal, chosen }: { deal: Extract<Deal, { kind: "pf" }>; chosen: RangeActionKey }) {
  const v = pushValue(deal.chart.grid[deal.hand]);
  const f = frequencies(deal, deal.hand);
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm text-foreground">
        <li className="flex items-center gap-2.5">
          <Swatch action="allin" /> All-in at {deal.stack}bb
        </li>
        <li className="flex items-center gap-2.5">
          <Swatch action="fold" /> Fold
        </li>
      </ul>
      <div className="space-y-1 border-t border-border/50 pt-3 text-[13px]">
        <p className="flex text-muted-foreground">
          {deal.hand}: max shove stack <span className="ml-auto font-mono text-foreground">{v > 0 ? `${v}bb` : "never"}</span>
        </p>
        {(["allin", "fold"] as const).map((a) => (
          <p key={a} className={cn("flex", a === chosen ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {a === "allin" ? "All-in" : "Fold"}
            {a === chosen && <span className="ml-1.5 text-violet-300">← your choice</span>}
            <span className="ml-auto font-mono">{Math.round((f[a] ?? 0) * 100)}%</span>
          </p>
        ))}
      </div>
    </div>
  );
}
