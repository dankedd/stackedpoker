"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PokerRangeGrid } from "@/components/learn/visuals/PokerRangeGrid";
import { DealerMarker } from "@/components/poker/DealerMarker";
import { CHIP_PALETTE, PokerChip, type ChipTone } from "@/components/poker/ChipStack";
import { FourColorCard } from "@/components/poker/FourColorCard";
import { Modal } from "@/components/ui/modal";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SEO_EVENTS, trackEvent } from "@/lib/seo/analytics";
import { actionStyle } from "@/lib/learn/actionStyles";
import {
  actionName,
  applyVerdict,
  availableActions,
  betFor,
  displayPos,
  frequencies,
  grade,
  newDeal,
  pushValue,
  scenarioTitle,
  scorePct,
  seatStatus,
  seatsFor,
  spotLabel,
  villainAllIn,
  type Deal,
  type Grade,
  type TrainerMode,
  type TrainerStats,
  type TrainerType,
} from "@/lib/ranges/logic";
import type { RangeActionKey } from "@/lib/ranges/types";
import { chartHrefForDeal, parseTrainerQuery, trainerQuery } from "@/lib/ranges/urlState";
import { cn } from "@/lib/utils";
import { ACTION_ORDER, HandBreakdown, Pills, SourceLegend, Swatch, TOOL_SLUG, sourceLabel, toStrategies } from "./shared";
import { useHighscore } from "./useHighscore";

const HOTKEY: Record<RangeActionKey, string> = { fold: "F", limp: "L", call: "C", raise: "R", allin: "A" };

const VERDICT: Record<Grade["verdict"], { label: string; className: string }> = {
  correct: { label: "Correct", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  mixed: { label: "Mixed", className: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  wrong: { label: "Wrong", className: "border-red-500/40 bg-red-500/15 text-red-300" },
};

interface Answer {
  key: RangeActionKey;
  grade: Grade;
  streakBefore: number;
  newRecord: boolean;
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
  const { high, submit, reset, signedIn } = useHighscore();

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
      const g = grade(deal, deal.hand, k);
      const nextStats = applyVerdict(stats, g.verdict);
      const newRecord = submit(nextStats.streak);
      setStats(nextStats);
      setAnswer({ key: k, grade: g, streakBefore: stats.streak, newRecord });
      if (nextStats.hands % 25 === 0) {
        trackEvent(SEO_EVENTS.toolCalculate, { tool_slug: TOOL_SLUG, hands: nextStats.hands, score: scorePct(nextStats) });
      }
    },
    [deal, answer, stats, submit],
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
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
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
            format={(t) => ({ open: "Open", def: "Defense", mix: "Mixed" })[t]}
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
              format={(m) => ({ all: "All", mtt: "MTT", pf: "Push/fold ≤10bb", cash: "Cash 100bb" })[m]}
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
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
          {[
            ["Hands", stats.hands],
            ["Correct", stats.correct],
            ["Mixed", stats.mixed],
            ["Score", `${scorePct(stats)}%`],
            ["Streak", stats.streak],
            ["Record", high],
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
                if (window.confirm("Reset your record to 0?")) reset();
              }}
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              reset
            </button>
          )}
        </dl>
      </div>

      {deal ? <Table deal={deal} /> : <div className="mx-auto aspect-[16/9.6] max-w-[860px] animate-pulse rounded-[999px] bg-card/40" />}

      {deal && <ActionButtons deal={deal} onChoose={choose} disabled={Boolean(answer)} />}

      {deal && answer && <ResultModal deal={deal} answer={answer} stats={stats} high={high} onNext={() => next()} />}
    </div>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

function Table({ deal }: { deal: Deal }) {
  const mobile = useIsMobile();
  const seats = seatsFor(deal);
  const n = seats.length;
  const heroIdx = seats.indexOf(deal.hero);
  const rx = mobile ? 40 : 44;
  const ry = mobile ? 42 : 41;
  const fmtLabel = deal.kind === "pf" ? "MTT · push/fold" : deal.fmt === "cash" ? "Cash · 6-max" : "MTT · 9-handed · antes";
  const situation = deal.type === "def" ? spotLabel(deal) : "Folded to you";

  return (
    <div className={cn("relative mx-auto w-full max-w-[860px]", mobile ? "aspect-[4/5]" : "aspect-[16/9.6]")}>
      {/* Rail and felt — same tokens as PreflopTable. */}
      <div
        className="absolute rounded-[999px]"
        style={{
          inset: mobile ? "10% 12%" : "11% 8%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      />
      <div
        className="absolute rounded-[999px] border border-emerald-950/40"
        style={{
          inset: mobile ? "12% 15%" : "13% 10%",
          background: "radial-gradient(ellipse at 50% 40%, rgba(21,63,46,0.92) 0%, rgba(13,44,32,0.95) 55%, rgba(7,26,20,0.97) 100%)",
          boxShadow: "inset 0 0 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div className="absolute left-1/2 top-[44%] w-3/5 -translate-x-1/2 -translate-y-1/2 text-center sm:w-4/5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-100/60 sm:text-[11px]">
            {fmtLabel}
            {deal.type === "def" ? " · defense" : ""}
          </p>
          <p className="font-mono text-2xl font-bold tracking-tight text-emerald-50 sm:text-3xl">{deal.stack}bb</p>
          <p className="text-xs text-emerald-100/80 sm:text-sm">{situation}</p>
        </div>
      </div>

      {Array.from({ length: n }, (_, k) => {
        const pos = seats[(heroIdx + k) % n];
        const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;
        const x = 50 + rx * Math.cos(ang);
        const y = 50 + ry * Math.sin(ang);
        const st = seatStatus(deal, pos);
        const bet = betFor(deal, pos);
        // Chips sit between seat and centre. Hero's go nearer the centre to clear the
        // hole cards; on a phone the felt is narrow, so the others stay close to their
        // seat instead of running into the text in the middle.
        const pullX = k === 0 ? 0.3 : mobile ? 0.76 : 0.58;
        const pullY = k === 0 ? 0.3 : mobile ? 0.74 : 0.55;
        const bx = 50 + rx * pullX * Math.cos(ang);
        const by = 50 + ry * pullY * Math.sin(ang);
        const da = ang + (k === 0 ? 0.42 : mobile ? 0.22 : 0.3);
        const dealerPull = mobile && k !== 0 ? 0.82 : 0.62;
        // All-in red, a real bet or raise blue, a posted blind grey.
        const tone: ChipTone =
          bet === `${deal.stack}bb`
            ? "allin"
            : (deal.type === "def" && pos === deal.vil) || (pos === deal.hero && /bet|raise/.test(bet))
              ? "bet"
              : "blind";
        const active = st.state === "hero" || st.state === "villain" || st.state === "waiting";
        return (
          <div key={pos}>
            {/* Every seat — hero included — is centred on the rail, so the pods line up. */}
            <div
              className={cn(
                "absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:w-[92px]",
                st.state === "hero" ? "z-[3]" : "z-[2]",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative">
                {st.state === "hero" && (
                  // Hole cards rise out of the seat; the name plate overlaps their lower edge.
                  <div className="absolute bottom-[calc(100%-10px)] left-1/2 flex -translate-x-1/2">
                    <FourColorCard card={deal.cards[0]} size={mobile ? "sm" : "md"} style={{ transform: "rotate(-4deg)" }} />
                    <FourColorCard
                      card={deal.cards[1]}
                      size={mobile ? "sm" : "md"}
                      style={{ marginLeft: mobile ? -16 : -20, transform: "rotate(4deg) translateY(-3px)" }}
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "relative min-w-[64px] rounded-xl border px-2.5 py-1 text-center shadow-md shadow-black/40 sm:min-w-[84px]",
                    st.state === "hero" && "border-violet-500/70 bg-[rgba(16,8,42,0.96)]",
                    st.state === "villain" && "border-amber-400/50 bg-[rgba(40,30,8,0.92)]",
                    st.state === "folded" && "border-border/40 bg-card/40 opacity-50 shadow-none",
                    st.state === "waiting" && "border-border/60 bg-card/90",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-bold sm:text-[13px]",
                      st.state === "hero" ? "text-violet-300" : st.state === "villain" ? "text-amber-300" : "text-foreground",
                    )}
                  >
                    {displayPos(pos)}
                  </p>
                  <p
                    className={cn(
                      "font-mono text-[10px] font-semibold sm:text-[12px]",
                      active ? "text-sky-300" : "text-muted-foreground",
                    )}
                  >
                    {deal.stack} BB
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  "min-h-3 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide",
                  st.state === "hero" ? "text-violet-300" : st.state === "villain" ? "text-amber-300" : "text-muted-foreground",
                )}
              >
                {st.text}
              </p>
            </div>
            {bet && <BetChips label={bet} tone={tone} left={bx} top={by} size={mobile ? 13 : 16} />}
            {pos === "BN" && (
              <DealerMarker
                style={{
                  left: `${50 + rx * dealerPull * Math.cos(da)}%`,
                  top: `${50 + ry * dealerPull * Math.sin(da)}%`,
                  transform: "translate(-50%,-50%)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A seat's committed chips: the same two-chip pile as ChipStack (PokerChip +
 * CHIP_PALETTE, shared with PreflopTable), but with a free-text label because
 * a 3-bet or 4-bet here has no size in the source data.
 */
function BetChips({ label, tone, left, top, size }: { label: string; tone: ChipTone; left: number; top: number; size: number }) {
  const spread = Math.max(3, Math.round(size * 0.22));
  return (
    <div
      className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className="relative" style={{ width: size + spread, height: size + spread }}>
        <PokerChip tone={tone} sizePx={size} style={{ left: 0, top: spread, opacity: 0.7 }} />
        <PokerChip tone={tone} sizePx={size} style={{ left: spread, top: 0 }} />
      </div>
      <span
        className={cn(
          "whitespace-nowrap rounded-full bg-black/40 px-1.5 py-px font-mono text-[10px] font-bold leading-tight sm:text-[11px]",
          CHIP_PALETTE[tone].text,
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

const BUTTON_CLASS: Record<RangeActionKey, string> = {
  fold: "border border-border bg-card/60 text-foreground hover:bg-card",
  limp: `${actionStyle("limp").bg} text-white hover:brightness-110`,
  call: `${actionStyle("call").bg} text-white hover:brightness-110`,
  raise: `${actionStyle("raise").bg} text-white hover:brightness-110`,
  allin: `${actionStyle("allin").bg} text-white hover:brightness-110`,
};

function ActionButtons({ deal, onChoose, disabled }: { deal: Deal; onChoose: (k: RangeActionKey) => void; disabled: boolean }) {
  const keys = availableActions(deal);
  const raiseLabel =
    deal.type === "open" && deal.kind === "freq"
      ? deal.chart.actions.find((a) => a.key === "raise")?.label.replace("Raise ", "")
      : undefined;
  return (
    <>
      <div
        className={cn(
          "mx-auto mt-7 grid gap-2.5",
          keys.length === 4 ? "max-w-[640px] grid-cols-2 sm:grid-cols-4" : keys.length === 3 ? "max-w-[540px] grid-cols-3" : "max-w-[360px] grid-cols-2",
        )}
        role="group"
        aria-label="Your action"
      >
        {keys.map((k) => {
          let sub = HOTKEY[k];
          if (k === "allin") sub = `${deal.stack}bb · A`;
          if (k === "raise" && raiseLabel) sub = `${raiseLabel} · R`;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(k)}
              className={cn(
                "rounded-xl px-3 py-3 text-[15px] font-bold transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                BUTTON_CLASS[k],
              )}
            >
              {actionName(k, deal)}
              <small className="mt-0.5 block text-[11px] font-medium opacity-80">{sub}</small>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        {villainAllIn(deal) ? "Villain is all-in: fold or call · " : "Shortcuts: "}
        {keys.map((k) => HOTKEY[k]).join(" · ")}, Enter for the next hand
      </p>
    </>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────

function ResultModal({
  deal,
  answer,
  stats,
  high,
  onNext,
}: {
  deal: Deal;
  answer: Answer;
  stats: TrainerStats;
  high: number;
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
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

  return (
    <Modal open onClose={onNext} title={scenarioTitle(deal)} maxWidthClassName="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={cn("rounded-full border px-3 py-1 text-sm font-bold", VERDICT[g.verdict].className)}>
          {VERDICT[g.verdict].label}
        </span>
        {answer.newRecord && (
          <span className="animate-fade-in rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-black">New record!</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {streakText} · Record <b className="font-mono text-foreground">{high}</b>
        </span>
        <p className="basis-full text-sm leading-relaxed text-muted-foreground">
          <b className="font-mono text-foreground">{deal.hand}</b> ({cardsText}) · {context}. {explanation}
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_250px]">
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
          <p className="text-xs text-muted-foreground">
            {deal.type === "def"
              ? `${spotLabel(deal)} · Hand Range ${deal.chart.n} · p. ${deal.chart.page}`
              : `${sourceLabel(deal.chart.hr)} · p. ${deal.chart.page}`}
          </p>
          {deal.kind === "pf" ? (
            <PushFoldResult deal={deal} chosen={k} />
          ) : (
            <>
              <SourceLegend
                actions={deal.chart.actions}
                showAbsent={Object.values(deal.chart.grid).some((v) => v === null)}
              />
              <div className="border-t border-border/50 pt-3">
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

      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 text-sm font-semibold text-white shadow-md shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Next hand (Enter)
      </button>
    </Modal>
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
