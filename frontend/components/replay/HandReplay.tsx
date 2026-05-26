"use client";

import { useMemo, useEffect, useRef } from "react";
import {
  Play, Pause, ChevronLeft, ChevronRight, SkipBack, SkipForward,
  AlertTriangle, CheckCircle2, Trophy, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReplay } from "@/hooks/useReplay";
import { buildSeatMap } from "@/lib/replay/seatEngine";
import { PokerTable } from "./PokerTable";
import type {
  ReplayAnalysis, ReplayAction, ActionCoaching, OverallVerdict,
  HandSummaryData, ValidationInfo,
} from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HandReplayProps {
  analysis: ReplayAnalysis;
  filename: string;
  validation?: ValidationInfo;
  /** Backend engine version — for deployment verification. */
  engineVersion?: string | null;
  /** Corrections applied by the backend (e.g. fold_to_check). */
  correctionsApplied?: string[];
  /** Live solver result — real equilibrium frequencies/EVs. */
  solver?: import("@/lib/types").SolverLiveResult | null;
  /** Full pipeline trace from backend. */
  trace?: import("@/lib/types").PipelineTrace | null;
}

const STREETS = ["preflop", "flop", "turn", "river"] as const;
type Street = (typeof STREETS)[number];

// ── Design tokens ─────────────────────────────────────────────────────────────

const STREET_META: Record<Street, { label: string; text: string; border: string; bg: string; glow: string }> = {
  preflop: { label: "PRE",   text: "#38BDF8", border: "rgba(56,189,248,0.4)",  bg: "rgba(56,189,248,0.12)",  glow: "0 0 14px rgba(56,189,248,0.28)" },
  flop:    { label: "FLOP",  text: "#34D399", border: "rgba(52,211,153,0.4)",  bg: "rgba(52,211,153,0.12)",  glow: "0 0 14px rgba(52,211,153,0.28)" },
  turn:    { label: "TURN",  text: "#FBBF24", border: "rgba(251,191,36,0.4)",  bg: "rgba(251,191,36,0.12)",  glow: "0 0 14px rgba(251,191,36,0.28)" },
  river:   { label: "RIVER", text: "#F87171", border: "rgba(248,113,113,0.4)", bg: "rgba(248,113,113,0.12)", glow: "0 0 14px rgba(248,113,113,0.28)" },
};

const QUALITY_STYLE: Record<string, {
  text: string; border: string; bg: string; bar: string; label: string; indicator: string;
}> = {
  Elite:    { text: "#22C55E", border: "rgba(34,197,94,0.45)",    bg: "rgba(34,197,94,0.10)",   bar: "#22C55E", label: "Elite Play",  indicator: "●" },
  Good:     { text: "#38BDF8", border: "rgba(56,189,248,0.4)",    bg: "rgba(56,189,248,0.08)",  bar: "#38BDF8", label: "Good Play",   indicator: "●" },
  Standard: { text: "#94A3B8", border: "rgba(148,163,184,0.25)",  bg: "rgba(148,163,184,0.06)", bar: "#94A3B8", label: "Standard",    indicator: "○" },
  Mistake:  { text: "#FBBF24", border: "rgba(251,191,36,0.4)",    bg: "rgba(251,191,36,0.08)",  bar: "#FBBF24", label: "Mistake",     indicator: "▲" },
  Punt:     { text: "#F87171", border: "rgba(248,113,113,0.4)",   bg: "rgba(248,113,113,0.10)", bar: "#F87171", label: "Major Error", indicator: "✕" },
};

const ACTION_COLOR_MAP: Record<string, string> = {
  fold:     "#64748B",
  check:    "#94A3B8",
  call:     "#38BDF8",
  bet:      "#34D399",
  raise:    "#34D399",
  "all-in": "#FBBF24",
};

const REASON_LABEL: Record<string, string> = {
  RANGE_ADVANTAGE:        "Range Advantage",
  RANGE_DISADVANTAGE:     "Range Disadvantage",
  DRY_BOARD:              "Dry Board",
  WET_BOARD:              "Wet Board",
  MONOTONE_BOARD:         "Monotone Board",
  FLUSH_DRAW_PRESENT:     "Flush Draw",
  STRAIGHT_DRAWS_PRESENT: "Straight Draws",
  PAIRED_BOARD:           "Paired Board",
  IN_POSITION:            "In Position",
  OUT_OF_POSITION:        "Out of Position",
  AGGRESSOR:              "Aggressor",
  CALLER:                 "Caller",
  OVER_SIZING:            "Oversizing",
  DONK_BET:               "Donk Bet",
  MIN_RAISE:              "Min-Raise",
  BLOCKER_SPOT:           "Blocker Spot",
};

// ── Verdict pill helpers ──────────────────────────────────────────────────────

const VERDICT_LABELS: Record<string, Record<string, string>> = {
  Elite:    { fold: "EXCELLENT FOLD",    check: "EXCELLENT CHECK", call: "CORRECT CALL",       bet: "EXCELLENT BET",    raise: "EXCELLENT RAISE"          },
  Good:     { fold: "GOOD FOLD",         check: "SOLID CHECK",     call: "REASONABLE CALL",    bet: "WELL-TIMED BET",   raise: "SOLID RAISE"              },
  Standard: { fold: "DEFENSIBLE FOLD",   check: "ACCEPTABLE CHECK",call: "MARGINAL CALL",      bet: "STANDARD BET",     raise: "STANDARD RAISE"           },
  Mistake:  { fold: "POTENTIAL OVERFOLD",check: "MISSED SPOT",     call: "LOOSE CALL",         bet: "QUESTIONABLE BET", raise: "AGGRESSIVE — QUESTIONABLE"},
  Punt:     { fold: "MAJOR OVERFOLD",    check: "CRITICAL MISS",   call: "SIGNIFICANT OVERPAY",bet: "SIGNIFICANT ERROR",raise: "RECKLESS RAISE"           },
};
function getVerdictLabel(quality: string, action: string): string {
  return VERDICT_LABELS[quality]?.[action.toLowerCase()] ?? quality.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM HEADER
// ─────────────────────────────────────────────────────────────────────────────

function PremiumHeader({
  hand_summary,
  currentStreet,
  availableStreets,
  firstIdxByStreet,
  step,
  totalActions,
  mistakeCount,
  onGoTo,
}: {
  hand_summary: HandSummaryData;
  currentStreet: Street;
  availableStreets: Street[];
  firstIdxByStreet: Record<Street, number>;
  step: number;
  totalActions: number;
  mistakeCount: number;
  onGoTo: (n: number) => void;
}) {
  // step=N means N actions applied. Display "Action N / total".
  const actionNum = step;

  return (
    <div
      className="relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(6,9,14,0.80)" }}
    >
      {/* LEFT — hand context */}
      <div className="flex items-center gap-2.5 min-w-0 order-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white/85">{hand_summary.hero_position}</span>
          {hand_summary.villain_position && (
            <>
              <span className="text-white/22 text-xs font-light">vs</span>
              <span className="text-sm font-semibold text-white/52">{hand_summary.villain_position}</span>
            </>
          )}
        </div>

        <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />

        {/* Effective stack — prominent display */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
          style={{
            background: "rgba(56,189,248,0.10)",
            border: "1px solid rgba(56,189,248,0.28)",
            boxShadow: "0 0 10px rgba(56,189,248,0.08)",
          }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-sky-400/70" />
          <span className="text-[13px] font-black text-sky-100/90 tabular-nums leading-none">
            {hand_summary.effective_stack_bb.toFixed(0)}bb
          </span>
          {hand_summary.big_blind && hand_summary.big_blind > 1 && (
            <span className="text-[10px] text-slate-500/55 leading-none">
              ·{Math.round(hand_summary.effective_stack_bb * hand_summary.big_blind).toLocaleString()}
            </span>
          )}
          <span className="text-[9px] text-slate-600/40 leading-none">eff</span>
        </div>

        <div className="h-3.5 w-px bg-white/[0.08] shrink-0 hidden sm:block" />
        <span className="text-xs text-white/28 hidden sm:inline">{hand_summary.stakes}</span>

        {mistakeCount > 0 && (
          <>
            <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />
            <span className="text-[11px] font-semibold text-rose-400/65">
              {mistakeCount} mistake{mistakeCount !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* CENTER — street tabs */}
      <div className="flex items-center gap-1 order-3 sm:order-2 w-full sm:w-auto justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2">
        {availableStreets.map((s) => {
          const isActive = currentStreet === s;
          // Action at 0-based index `idx` is applied when step >= idx + 1.
          const streetIdx = firstIdxByStreet[s] ?? -1;
          const streetStep = streetIdx >= 0 ? streetIdx + 1 : -1; // count needed to reach this street
          const isVisited = step >= streetStep && streetStep > 0;
          const meta = STREET_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => { if (streetStep > 0) onGoTo(streetStep); }}
              disabled={streetStep < 0}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-[0.18em] transition-all duration-200 disabled:cursor-not-allowed"
              style={
                isActive
                  ? { color: meta.text, background: meta.bg, border: `1px solid ${meta.border}`, boxShadow: meta.glow }
                  : {
                      color: isVisited ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.10)",
                      background: "transparent",
                      border: "1px solid transparent",
                    }
              }
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* RIGHT — action counter */}
      <div className="flex items-center gap-2 shrink-0 order-2 sm:order-3">
        {totalActions > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: "rgba(100,116,139,0.55)" }}>
            {step > 0 ? (
              <>
                Action{" "}
                <span className="font-bold" style={{ color: "rgba(203,213,225,0.6)" }}>{actionNum}</span>
                <span style={{ color: "rgba(100,116,139,0.35)" }}> / {totalActions}</span>
              </>
            ) : (
              <span style={{ color: "rgba(100,116,139,0.35)" }}>{totalActions} actions</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

function HorizontalTimeline({
  actions,
  step,
  onGoTo,
}: {
  actions: ReplayAction[];
  step: number;
  onGoTo: (n: number) => void;
}) {
  const currentNodeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [step]);

  // Group actions by street (preserving order)
  const streetGroups = useMemo(() => {
    const groups: { street: Street; items: { action: ReplayAction; globalIdx: number }[] }[] = [];
    let last = "";
    actions.forEach((action, i) => {
      if (action.street !== last) {
        groups.push({ street: action.street as Street, items: [] });
        last = action.street;
      }
      groups[groups.length - 1].items.push({ action, globalIdx: i });
    });
    return groups;
  }, [actions]);

  return (
    <div className="overflow-x-auto px-5 pt-4 pb-2" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-3 min-w-max">
        {streetGroups.map((group, gi) => {
          const meta = STREET_META[group.street];
          return (
            <div key={gi} className="flex items-center gap-2">
              {/* Street label */}
              <span
                className="text-[9px] font-black tracking-[0.22em] shrink-0 select-none"
                style={{ color: meta.text, opacity: 0.65 }}
              >
                {meta.label}
              </span>

              {/* Action nodes */}
              <div className="flex items-center">
                {group.items.map(({ action, globalIdx }, ai) => {
                  // step=N means N actions applied; the current action is at index step-1.
                  const isCurrent = globalIdx === step - 1;
                  const isPast    = globalIdx < step - 1;
                  const isFuture  = globalIdx >= step;   // not yet applied
                  const isHero    = action.is_hero;
                  const rating    = action.feedback?.rating;

                  let nodeColor: string;
                  if (isFuture) {
                    nodeColor = "rgba(255,255,255,0.08)";
                  } else if (isHero) {
                    nodeColor =
                      rating === "good"    ? "#22C55E" :
                      rating === "mistake" ? "#F87171" :
                      rating === "okay"    ? "#FBBF24" :
                                            "#94A3B8";
                  } else {
                    nodeColor = isPast ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.35)";
                  }

                  const nodeSize = isCurrent ? 18 : (isHero && !isFuture) ? 11 : 7;

                  return (
                    <div key={globalIdx} className="flex items-center">
                      <button
                        ref={isCurrent ? currentNodeRef : undefined}
                        type="button"
                        onClick={() => onGoTo(globalIdx + 1)}
                        title={`${action.is_hero ? "YOU" : action.player}: ${action.action}${action.amount ? " " + action.amount : ""}`}
                        className="rounded-full transition-all duration-200 focus:outline-none hover:opacity-90 relative"
                        style={{
                          width: nodeSize,
                          height: nodeSize,
                          minWidth: nodeSize,
                          background: nodeColor,
                          opacity: isFuture ? 0.18 : 1,
                          boxShadow: isCurrent
                            ? `0 0 0 2.5px rgba(255,255,255,0.12), 0 0 12px ${nodeColor}80`
                            : (isHero && !isFuture) ? `0 0 6px ${nodeColor}55` : undefined,
                          animation: isCurrent ? "glow-pulse 1.8s ease-in-out infinite" : undefined,
                        }}
                      />
                      {ai < group.items.length - 1 && (
                        <div
                          style={{
                            width: 8,
                            height: 1.5,
                            background: globalIdx < step - 1
                              ? "rgba(255,255,255,0.18)"
                              : "rgba(255,255,255,0.06)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Street divider */}
              {gi < streetGroups.length - 1 && (
                <div className="w-px h-5 bg-white/[0.07] mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLAY CONTROLS
// ─────────────────────────────────────────────────────────────────────────────

function ReplayControls({
  isPlaying, isFirst, isLast,
  onPlay, onPause, onNext, onPrev, onReset, onSkipEnd,
}: {
  isPlaying: boolean; isFirst: boolean; isLast: boolean;
  onPlay: () => void; onPause: () => void; onNext: () => void;
  onPrev: () => void; onReset: () => void; onSkipEnd: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-5 pb-5 pt-1">
      {/* Skip back */}
      <button
        type="button" onClick={onReset} disabled={isFirst}
        className="p-2 rounded-full text-white/18 hover:text-white/45 transition-all duration-150 disabled:opacity-10 disabled:cursor-not-allowed"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>

      {/* Previous */}
      <button
        type="button" onClick={onPrev} disabled={isFirst}
        className="h-9 w-9 rounded-full flex items-center justify-center text-white/38 hover:text-white/65 hover:bg-white/[0.05] transition-all duration-150 disabled:opacity-10 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* PRIMARY — Next Action / Pause / Replay */}
      {isLast && !isPlaying ? (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(203,213,225,0.65)",
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Replay Hand</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={isPlaying ? onPause : onNext}
          disabled={isLast && !isPlaying}
          className="flex items-center gap-2.5 px-7 py-2.5 rounded-full font-bold text-sm transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
          style={{
            background: isPlaying
              ? "rgba(251,191,36,0.12)"
              : "linear-gradient(135deg, rgba(124,92,255,0.90) 0%, rgba(56,189,248,0.75) 100%)",
            border: isPlaying
              ? "1px solid rgba(251,191,36,0.30)"
              : "1px solid rgba(124,92,255,0.45)",
            boxShadow: isPlaying
              ? "0 0 18px rgba(251,191,36,0.12)"
              : "0 0 24px rgba(124,92,255,0.28), 0 4px 20px rgba(0,0,0,0.45)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {isPlaying ? (
            <><Pause className="h-3.5 w-3.5" /><span>Pause</span></>
          ) : (
            <><Play className="h-3.5 w-3.5 ml-0.5" /><span>Next Action</span></>
          )}
        </button>
      )}

      {/* AUTO PLAY toggle */}
      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLast && !isPlaying}
        className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] transition-all duration-150 disabled:opacity-10 disabled:cursor-not-allowed"
        style={{
          background: isPlaying ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
          border: isPlaying ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(255,255,255,0.07)",
          color: isPlaying ? "rgba(251,191,36,0.8)" : "rgba(100,116,139,0.5)",
        }}
      >
        <div
          className="h-1.5 w-1.5 rounded-full transition-colors duration-150"
          style={{ background: isPlaying ? "#FBBF24" : "rgba(148,163,184,0.3)" }}
        />
        AUTO
      </button>

      {/* Next */}
      <button
        type="button" onClick={onNext} disabled={isLast}
        className="h-9 w-9 rounded-full flex items-center justify-center text-white/38 hover:text-white/65 hover:bg-white/[0.05] transition-all duration-150 disabled:opacity-10 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Skip end */}
      <button
        type="button" onClick={onSkipEnd} disabled={isLast}
        className="p-2 rounded-full text-white/18 hover:text-white/45 transition-all duration-150 disabled:opacity-10 disabled:cursor-not-allowed"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS PANEL  (permanent right-side panel)
// ─────────────────────────────────────────────────────────────────────────────

function AnalysisPanel({
  coaching,
  currentAction,
  facingAction,
  handSummary,
  currentStreet,
  step,
  solver,
}: {
  coaching: ActionCoaching | null;
  currentAction: ReplayAction | null;
  facingAction: ReplayAction | null;
  handSummary: HandSummaryData;
  currentStreet: Street;
  step: number;
  solver?: import("@/lib/types").SolverLiveResult | null;
}) {
  const streetMeta = STREET_META[currentStreet];
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.22)" }}
      >
        <span
          className="text-[10px] font-black tracking-[0.22em] uppercase"
          style={{ color: "rgba(100,116,139,0.42)" }}
        >
          Analysis
        </span>
        <span
          className="text-[9px] font-black tracking-[0.18em] uppercase px-2.5 py-1 rounded-md"
          style={{ color: streetMeta.text, background: streetMeta.bg, border: `1px solid ${streetMeta.border}` }}
        >
          {streetMeta.label}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {coaching && currentAction ? (
          <CoachingContent coaching={coaching} currentAction={currentAction} facingAction={facingAction} solver={solver} />
        ) : (
          <EmptyAnalysisState handSummary={handSummary} step={step} />
        )}
      </div>
    </div>
  );
}

function FacingBetContext({
  villainAction,
  potBefore,
}: {
  villainAction: ReplayAction;
  potBefore: number;
}) {
  const isAllIn = villainAction.is_all_in || villainAction.action === "raise" && villainAction.amount && parseFloat(villainAction.amount) > potBefore * 2;
  const betAmount = villainAction.amount ?? "?";
  const actionLabel = isAllIn ? "shoves" : villainAction.action === "raise" ? "raises to" : `${villainAction.action}s`;

  return (
    <div
      className="mx-5 mt-4 mb-1 px-4 py-3 rounded-xl"
      style={{
        background: "rgba(248,113,113,0.06)",
        border: "1px solid rgba(248,113,113,0.18)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: "#F87171", boxShadow: "0 0 8px rgba(248,113,113,0.4)" }}
        />
        <span
          className="text-[9px] font-black tracking-[0.2em] uppercase"
          style={{ color: "rgba(248,113,113,0.55)" }}
        >
          Facing Aggression
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[13px] font-bold"
          style={{ color: "rgba(248,113,113,0.80)" }}
        >
          {villainAction.player} {actionLabel}
        </span>
        <span
          className="text-lg font-black tabular-nums"
          style={{ color: "rgba(248,113,113,0.95)" }}
        >
          {betAmount}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[11px] tabular-nums" style={{ color: "rgba(148,163,184,0.45)" }}>
          Pot: <span style={{ color: "rgba(203,213,225,0.65)" }}>{potBefore.toFixed(1)}bb</span>
        </span>
        {villainAction.pot_after > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: "rgba(148,163,184,0.45)" }}>
            Pot after: <span style={{ color: "rgba(203,213,225,0.65)" }}>{villainAction.pot_after.toFixed(1)}bb</span>
          </span>
        )}
        {villainAction.amount && potBefore > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: "rgba(148,163,184,0.45)" }}>
            Odds: <span style={{ color: "rgba(56,189,248,0.75)" }}>
              {(potBefore / parseFloat(villainAction.amount) * 100).toFixed(0)}%
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function CoachingContent({
  coaching,
  currentAction,
  facingAction,
  solver,
}: {
  coaching: ActionCoaching;
  currentAction: ReplayAction;
  facingAction: ReplayAction | null;
  solver?: import("@/lib/types").SolverLiveResult | null;
}) {
  const qs = QUALITY_STYLE[coaching.quality] ?? QUALITY_STYLE.Standard;
  const verdictLabel = getVerdictLabel(coaching.quality, currentAction.action);

  // Detect deviation: did hero's action differ from the primary recommendation?
  const primary = coaching.strategic_options?.find(o => o.priority === 1);
  const primaryVerb = primary?.action?.toLowerCase().split(" ")[0] ?? "";
  const actualVerb = currentAction.action.toLowerCase();
  const isDeviation = !!primary && primaryVerb !== actualVerb;

  return (
    <div className="divide-y divide-white/[0.04]">
      {/* Facing-bet context — shows villain's bet/shove BEFORE hero's response */}
      {facingAction && (
        <FacingBetContext
          villainAction={facingAction}
          potBefore={facingAction.pot_after - (facingAction.amount ? parseFloat(facingAction.amount) : 0)}
        />
      )}

      {/* ── Solver preference + deviation indicator ── */}
      {isDeviation && primary ? (
        <div className="px-5 py-4 space-y-4">
          {/* Solver preference — visually dominant */}
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ color: "rgba(100,116,139,0.42)" }}
            >
              Solver Prefers
            </p>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.22)",
                boxShadow: "0 0 16px rgba(34,197,94,0.06)",
              }}
            >
              <span
                className="text-xl font-black capitalize"
                style={{ color: "rgba(34,197,94,0.90)" }}
              >
                {primary.action}
              </span>
              <span
                className="text-[8px] font-black tracking-wide px-2 py-0.5 rounded-full uppercase"
                style={{
                  background: "rgba(34,197,94,0.10)",
                  color: "rgba(34,197,94,0.70)",
                  border: "1px solid rgba(34,197,94,0.25)",
                }}
              >
                Primary
              </span>
            </div>
          </div>

          {/* Hero's actual action — de-emphasized */}
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ color: "rgba(100,116,139,0.35)" }}
            >
              You Chose
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-base font-bold capitalize"
                  style={{ color: "rgba(148,163,184,0.55)" }}
                >
                  {currentAction.action}
                </span>
                {currentAction.amount && (
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: "rgba(148,163,184,0.35)" }}
                  >
                    {currentAction.amount}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-black tracking-[0.14em] px-3 py-1.5 rounded-full uppercase"
                style={{
                  color: qs.text,
                  background: qs.bg,
                  border: `1px solid ${qs.border}`,
                }}
              >
                {verdictLabel}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── No deviation — standard display ── */
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span
              className="text-[10px] font-black tracking-[0.14em] px-3 py-1.5 rounded-full uppercase"
              style={{
                color: qs.text,
                background: qs.bg,
                border: `1px solid ${qs.border}`,
                boxShadow: `0 0 14px ${qs.bar}28`,
              }}
            >
              {verdictLabel}
            </span>
            {coaching.mistake_level !== "None" && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider self-center"
                style={{ color: `${qs.text}60` }}
              >
                {coaching.mistake_level}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-black capitalize"
              style={{ color: ACTION_COLOR_MAP[currentAction.action] ?? "#94A3B8" }}
            >
              {currentAction.action}
            </span>
            {currentAction.amount && (
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: `${ACTION_COLOR_MAP[currentAction.action] ?? "#94A3B8"}70` }}
              >
                {currentAction.amount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Strategic analysis */}
      <div className="px-5 py-4">
        <p
          className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2.5"
          style={{ color: "rgba(100,116,139,0.42)" }}
        >
          Strategic Analysis
        </p>
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: "rgba(203,213,225,0.70)" }}
        >
          {coaching.explanation}
        </p>
      </div>

      {/* Strategic options — hidden when solver frequencies are available
           (solver equilibrium supersedes heuristic PRIMARY/SECONDARY labels) */}
      {coaching.strategic_options?.length > 0
       && !(solver?.status === "ready" && currentAction.street === "river") && (
        <div className="px-5 py-4">
          <p
            className="text-[9px] uppercase tracking-[0.22em] font-bold mb-3"
            style={{ color: "rgba(100,116,139,0.42)" }}
          >
            Recommended Lines
          </p>
          <div className="space-y-2">
            {coaching.strategic_options.map((opt, i) => {
              const isPrimary = opt.priority === 1;
              const isActualAction = opt.action.toLowerCase().split(" ")[0] === actualVerb;
              const label = isPrimary ? "Primary" : opt.priority === 2 ? "Secondary" : "Alt";
              return (
                <div
                  key={i}
                  className="rounded-lg px-3.5 py-3"
                  style={{
                    background: isPrimary
                      ? "rgba(34,197,94,0.04)"
                      : isActualAction && isDeviation
                        ? "rgba(148,163,184,0.04)"
                        : "rgba(255,255,255,0.015)",
                    border: isPrimary
                      ? "1px solid rgba(34,197,94,0.20)"
                      : isActualAction && isDeviation
                        ? `1px solid ${qs.border}`
                        : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[11px] font-bold capitalize"
                      style={{ color: isPrimary ? "rgba(34,197,94,0.85)" : isActualAction ? qs.text : "rgba(148,163,184,0.50)" }}
                    >
                      {opt.action}
                    </span>
                    <span
                      className="text-[8px] font-black tracking-wide px-1.5 py-0.5 rounded-full uppercase"
                      style={{
                        background: isPrimary ? "rgba(34,197,94,0.08)" : isActualAction && isDeviation ? qs.bg : "rgba(255,255,255,0.03)",
                        color: isPrimary ? "rgba(34,197,94,0.70)" : isActualAction && isDeviation ? qs.text : "rgba(100,116,139,0.42)",
                        border: `1px solid ${isPrimary ? "rgba(34,197,94,0.22)" : isActualAction && isDeviation ? qs.border : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {label}
                    </span>
                    {isActualAction && isDeviation && (
                      <span
                        className="text-[8px] font-bold tracking-wide px-1.5 py-0.5 rounded-full uppercase"
                        style={{ color: "rgba(148,163,184,0.40)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        Your choice
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{ color: "rgba(148,163,184,0.46)" }}
                  >
                    {opt.reasoning}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Context tags */}
      {coaching.reason_codes.length > 0 && (
        <div className="px-5 py-4">
          <p
            className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2.5"
            style={{ color: "rgba(100,116,139,0.42)" }}
          >
            Context
          </p>
          <div className="flex flex-wrap gap-1.5">
            {coaching.reason_codes.map((code) => (
              <span
                key={code}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(148,163,184,0.52)",
                }}
              >
                {REASON_LABEL[code] ?? code}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Adjustment */}
      <div className="px-5 py-4">
        <p
          className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2.5"
          style={{ color: "rgba(100,116,139,0.42)" }}
        >
          Adjustment
        </p>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "rgba(148,163,184,0.56)" }}
        >
          {coaching.adjustment}
        </p>
      </div>

      {/* Solver equilibrium — real frequencies when available */}
      {solver && solver.status === "ready" && currentAction.street === "river" && (
        <SolverFrequencies solver={solver} heroAction={currentAction.action} />
      )}
    </div>
  );
}

/** Compact action log for the current street — provides full context. */
function StreetActionLog({
  actions,
  currentStreet,
  heroActionIdx,
}: {
  actions: ReplayAction[];
  currentStreet: string;
  heroActionIdx: number;
}) {
  // Get all actions on this street up to and including the hero action
  const streetActions = actions.filter(
    (a, i) => a.street === currentStreet && i <= heroActionIdx,
  );
  if (streetActions.length <= 1) return null; // no context to show

  return (
    <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <p
        className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
        style={{ color: "rgba(100,116,139,0.30)" }}
      >
        Action Sequence
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {streetActions.map((a, i) => {
          const isHero = a.is_hero;
          const color = ACTION_COLOR_MAP[a.action] ?? "#94A3B8";
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "8px" }}>{'>'}</span>
              )}
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color: isHero ? color : "rgba(148,163,184,0.55)",
                  background: isHero ? `${color}12` : "transparent",
                  border: isHero ? `1px solid ${color}30` : "1px solid transparent",
                }}
              >
                {a.player.length > 8 ? a.player.slice(0, 8) : a.player}{" "}
                {a.action}
                {a.amount ? ` ${a.amount}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyAnalysisState({
  handSummary,
  step,
}: {
  handSummary: HandSummaryData;
  step: number;
}) {
  return (
    <div className="flex flex-col px-5 py-8 gap-6">
      {/* Prompt */}
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Play className="h-4 w-4" style={{ color: "rgba(255,255,255,0.18)", marginLeft: 2 }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "rgba(148,163,184,0.42)" }}>
          {step === 0 ? "Press Next Action to begin" : "Navigate to a hero action"}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(100,116,139,0.35)" }}>
          Analysis appears after each hero decision
        </p>
      </div>

      {/* Hand context */}
      <div className="space-y-2">
        {[
          { label: "Position",  value: handSummary.hero_position },
          { label: "Stack",     value: `${handSummary.effective_stack_bb.toFixed(0)}bb` },
          { label: "Players",   value: String(handSummary.player_count) },
          ...(handSummary.stakes ? [{ label: "Stakes", value: handSummary.stakes }] : []),
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-2.5 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "rgba(100,116,139,0.42)" }}
            >
              {label}
            </span>
            <span
              className="text-[12px] font-bold tabular-nums"
              style={{ color: label === "Stack" ? "rgba(56,189,248,0.72)" : "rgba(203,213,225,0.62)" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLVER FREQUENCIES
// ─────────────────────────────────────────────────────────────────────────────

// Mode → styling
const SOLVER_MODE_STYLE: Record<string, { accent: string; bg: string; border: string; label: string; sublabel: string }> = {
  live:      { accent: "#22C55E", bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.22)",   label: "LIVE TEXASSOLVER",     sublabel: "Real equilibrium" },
  cached:    { accent: "#38BDF8", bg: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.22)",  label: "CACHED SOLUTION",      sublabel: "Previously solved" },
  synthetic: { accent: "#FBBF24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.22)",  label: "HEURISTIC ESTIMATE",   sublabel: "TexasSolver unavailable" },
  failed:    { accent: "#F87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.22)", label: "SOLVER FAILED",        sublabel: "No equilibrium data" },
};

function SolverFrequencies({
  solver,
  heroAction,
}: {
  solver: import("@/lib/types").SolverLiveResult;
  heroAction: string;
}) {
  const freqs = Object.entries(solver.frequencies).sort((a, b) => b[1] - a[1]);
  const preferredAction = solver.preferred_action;
  const heroVerb = heroAction.toLowerCase();
  const evLoss = solver.hero_action_ev_loss;

  const mode = solver.mode ?? (solver.source?.includes("synthetic") ? "synthetic" : "live");
  const ms = SOLVER_MODE_STYLE[mode] ?? SOLVER_MODE_STYLE.failed;
  const isTrustworthy = mode === "live" || mode === "cached";

  return (
    <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      {/* ── Solver status badge ── */}
      <div
        className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg"
        style={{ background: ms.bg, border: `1px solid ${ms.border}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              background: ms.accent,
              boxShadow: mode === "live" ? `0 0 8px ${ms.accent}60` : undefined,
              animation: mode === "live" ? "glow-pulse 1.8s ease-in-out infinite" : undefined,
            }}
          />
          <div>
            <span
              className="text-[9px] font-black tracking-[0.18em] uppercase block"
              style={{ color: ms.accent }}
            >
              {ms.label}
            </span>
            <span className="text-[8px]" style={{ color: `${ms.accent}80` }}>
              {ms.sublabel}
            </span>
          </div>
        </div>
        {/* Provenance metadata */}
        <div className="flex flex-col items-end gap-0.5">
          {isTrustworthy && solver.iterations > 0 && (
            <span className="text-[8px] tabular-nums" style={{ color: `${ms.accent}70` }}>
              {solver.iterations} iter · {solver.exploitability.toFixed(1)}% expl
            </span>
          )}
          {solver.solve_time_ms > 1 && (
            <span className="text-[8px] tabular-nums" style={{ color: `${ms.accent}50` }}>
              {solver.solve_time_ms < 1000
                ? `${solver.solve_time_ms.toFixed(0)}ms`
                : `${(solver.solve_time_ms / 1000).toFixed(1)}s`}
              {solver.cache_hit ? " · cache hit" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Node description */}
      {solver.node_description && (
        <p className="text-[9px] mb-3 px-1" style={{ color: "rgba(148,163,184,0.40)" }}>
          {solver.node_description}
        </p>
      )}

      {/* Fallback warning */}
      {solver.fallback_reason && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}
        >
          <span className="text-[10px]" style={{ color: "rgba(251,191,36,0.7)" }}>
            {solver.fallback_reason}
          </span>
        </div>
      )}

      {/* ── Frequency bars ── */}
      <div className="space-y-2 mb-3">
        {freqs.map(([action, freq]) => {
          const pct = Math.round(freq * 100);
          const isPreferred = action === preferredAction;
          const isHeroAction = action === heroVerb;
          const barColor = isPreferred
            ? `${ms.accent}C0`
            : isHeroAction
              ? "rgba(56,189,248,0.60)"
              : "rgba(148,163,184,0.30)";
          const textColor = isPreferred
            ? ms.accent
            : isHeroAction
              ? "rgba(56,189,248,0.80)"
              : "rgba(148,163,184,0.55)";

          return (
            <div key={action}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold capitalize" style={{ color: textColor }}>
                    {action}
                  </span>
                  {isPreferred && (
                    <span
                      className="text-[7px] font-black tracking-wider px-1.5 py-0.5 rounded uppercase"
                      style={{ background: `${ms.accent}15`, color: `${ms.accent}AA`, border: `1px solid ${ms.accent}30` }}
                    >
                      {isTrustworthy ? "GTO" : "EST"}
                    </span>
                  )}
                  {isHeroAction && !isPreferred && (
                    <span
                      className="text-[7px] font-black tracking-wider px-1.5 py-0.5 rounded uppercase"
                      style={{ background: "rgba(56,189,248,0.08)", color: "rgba(56,189,248,0.55)", border: "1px solid rgba(56,189,248,0.15)" }}
                    >
                      You
                    </span>
                  )}
                </div>
                <span className="text-[12px] font-black tabular-nums" style={{ color: textColor }}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Source label — ALWAYS visible */}
      <div className="flex items-center gap-2 mt-2 px-1">
        <span className="text-[8px] uppercase tracking-[0.15em] font-bold" style={{ color: "rgba(100,116,139,0.35)" }}>
          Source:
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: `${ms.accent}90` }}>
          {ms.label}
        </span>
      </div>

      {/* EV loss indicator */}
      {evLoss < -0.01 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mt-3"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}
        >
          <span className="text-[10px] font-bold" style={{ color: "rgba(248,113,113,0.65)" }}>EV Loss</span>
          <span className="text-[12px] font-black tabular-nums" style={{ color: "rgba(248,113,113,0.85)" }}>
            {evLoss.toFixed(2)}bb
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM VERDICT
// ─────────────────────────────────────────────────────────────────────────────

function PremiumVerdict({ verdict }: { verdict: OverallVerdict }) {
  const qualityKey =
    verdict.score >= 80 ? "Elite"
    : verdict.score >= 65 ? "Good"
    : verdict.score >= 45 ? "Standard"
    : verdict.score >= 28 ? "Mistake"
    : "Punt";
  const qs = QUALITY_STYLE[qualityKey];

  return (
    <div className="px-5 sm:px-6 py-5 animate-slide-up-in">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-3.5 w-3.5" style={{ color: "#FBBF24" }} />
        <span
          className="text-[10px] font-black tracking-[0.2em] uppercase"
          style={{ color: "rgba(148,163,184,0.42)" }}
        >
          Hand Verdict
        </span>
      </div>

      {/* Verdict pill + title */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span
          className="text-[11px] font-black tracking-[0.14em] px-3.5 py-1.5 rounded-full uppercase"
          style={{
            color: qs.text,
            background: qs.bg,
            border: `1px solid ${qs.border}`,
            boxShadow: `0 0 16px ${qs.bar}22`,
          }}
        >
          {qs.label}
        </span>
        <span className="text-sm font-bold" style={{ color: qs.text }}>
          {verdict.title}
        </span>
      </div>

      <p
        className="text-[13px] leading-relaxed mb-5"
        style={{ color: "rgba(148,163,184,0.65)" }}
      >
        {verdict.summary}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {verdict.key_mistakes.length > 0 && (
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.2em] font-black mb-2.5"
              style={{ color: "rgba(248,113,113,0.55)" }}
            >
              Leaks
            </p>
            <div className="space-y-2">
              {verdict.key_mistakes.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-rose-400/60" />
                  <p className="text-xs leading-snug" style={{ color: "rgba(148,163,184,0.60)" }}>{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {verdict.key_strengths.length > 0 && (
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.2em] font-black mb-2.5"
              style={{ color: "rgba(34,197,94,0.55)" }}
            >
              Strengths
            </p>
            <div className="space-y-2">
              {verdict.key_strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400/60" />
                  <p className="text-xs leading-snug" style={{ color: "rgba(148,163,184,0.60)" }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function HandReplay({ analysis, filename, validation, engineVersion, correctionsApplied, solver, trace }: HandReplayProps) {
  const replay = useReplay(analysis);
  const { hand_summary, overall_verdict } = analysis;
  // Defensive: actions may be undefined if the backend returned a partial response
  const actions = analysis?.actions ?? [];
  const seats = useMemo(() => buildSeatMap(analysis), [analysis]);

  // Dev-only diagnostics
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug("[HandReplay] render —", {
      actionsCount: actions.length,
      heroCards: hand_summary?.hero_cards,
      heroPosition: hand_summary?.hero_position,
      streets: [...new Set(actions.map((a) => a.street))],
      hasFlop: (hand_summary?.board?.flop?.length ?? 0) > 0,
    });
    if (actions.length === 0) {
      console.warn(
        "[HandReplay] No action data received — timeline and controls will show fallback. " +
        "Verify the backend /analyze or /confirm-hand response includes a non-empty actions[].",
      );
    }
  }, [analysis]);

  const mistakeCount = actions.filter((a) => a.is_hero && a.feedback?.rating === "mistake").length;

  const activeCoaching = useMemo<{ coaching: ActionCoaching; actionIdx: number } | null>(() => {
    // Walk backward through applied actions (0-based indices 0..step-1)
    for (let i = replay.step - 1; i >= 0; i--) {
      if (actions[i]?.is_hero && actions[i]?.coaching) {
        return { coaching: actions[i].coaching!, actionIdx: i };
      }
    }
    return null;
  }, [replay.step, actions]);

  // Compute the villain action that the current hero action is responding to.
  // This is the most recent non-hero bet/raise BEFORE the hero's action on the same street.
  const facingAction = useMemo<ReplayAction | null>(() => {
    if (!activeCoaching) return null;
    const heroIdx = activeCoaching.actionIdx;
    const heroAction = actions[heroIdx];
    if (!heroAction) return null;
    // Only show facing-bet context for responsive actions (call, fold, raise)
    if (!["call", "fold", "raise"].includes(heroAction.action)) return null;
    // Walk backward from the hero action to find the villain's bet/raise on same street
    for (let i = heroIdx - 1; i >= 0; i--) {
      const a = actions[i];
      if (a.street !== heroAction.street) break; // crossed street boundary
      if (!a.is_hero && ["bet", "raise"].includes(a.action)) {
        return a;
      }
    }
    return null;
  }, [activeCoaching, actions]);

  const currentStreet = replay.currentStreet as Street;

  const availableStreets = useMemo(
    () => STREETS.filter((s) => actions.some((a) => a.street === s)),
    [actions]
  );

  const firstIdxByStreet = useMemo(
    () =>
      Object.fromEntries(
        STREETS.map((s) => [s, actions.findIndex((a) => a.street === s)])
      ) as Record<Street, number>,
    [actions]
  );

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in border border-border/50"
      style={{
        background: "rgba(10,14,20,0.96)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* HEADER — full width */}
      <PremiumHeader
        hand_summary={hand_summary}
        currentStreet={currentStreet}
        availableStreets={availableStreets}
        firstIdxByStreet={firstIdxByStreet}
        step={replay.step}
        totalActions={actions.length}
        mistakeCount={mistakeCount}
        onGoTo={replay.goTo}
      />

      {/* ── PIPELINE DEBUG PANEL ─────────────────────────────────────────────
           Compact forensic overlay. Shows version stamps, action counts at
           every pipeline stage, solver state, and replay state. */}
      <details
        style={{
          background: trace?.action_count_mismatch
            ? "rgba(248,113,113,0.10)"
            : "rgba(0,0,0,0.80)",
          borderBottom: trace?.action_count_mismatch
            ? "2px solid rgba(248,113,113,0.4)"
            : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <summary
          style={{
            padding: "5px 16px",
            fontSize: "9px",
            fontFamily: "monospace",
            color: trace?.action_count_mismatch ? "rgba(248,113,113,0.8)" : "rgba(100,116,139,0.5)",
            cursor: "pointer",
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "rgba(56,189,248,0.6)" }}>BE:{engineVersion ?? "?"}</span>
          <span>
            {trace
              ? `can=${trace.canonical?.action_count ?? "?"} par=${trace.parsed?.action_count ?? "?"} rep=${trace.replay?.action_count ?? "?"}`
              : `rep=${actions.length}`}
          </span>
          <span>step:{replay.step}/{actions.length}</span>
          {replay.pendingAggression ? (
            <span style={{ color: "#F87171", fontWeight: "bold" }}>
              FACING:{replay.pendingAggression.player} {replay.pendingAggression.action}
              {replay.pendingAggression.amount ? ` ${replay.pendingAggression.amount}` : ""}
            </span>
          ) : null}
          {trace?.action_count_mismatch && (
            <span style={{ color: "#F87171", fontWeight: "bold" }}>MISMATCH</span>
          )}
          <span style={{ color: "rgba(100,116,139,0.35)" }}>
            solver:{trace?.solver ? (trace.solver as Record<string,unknown>).status as string ?? "?" : solver?.status ?? "none"}
          </span>
        </summary>

        <div style={{ padding: "6px 16px", fontSize: "9px", fontFamily: "monospace", color: "rgba(251,191,36,0.6)" }}>
          {/* Pipeline stage counts */}
          {trace && (
            <div style={{ marginBottom: "6px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span>input={trace.input?.action_count ?? "?"}</span>
              <span>sanitized={trace.sanitized?.action_count ?? "?"}</span>
              <span>canonical={trace.canonical?.action_count ?? "?"}</span>
              <span>parsed={trace.parsed?.action_count ?? "?"}</span>
              <span>replay={trace.replay?.action_count ?? "?"}</span>
            </div>
          )}
          {/* River actions at each stage */}
          {trace?.canonical?.river_actions && (
            <div style={{ color: "rgba(56,189,248,0.5)" }}>
              river(canonical): {trace.canonical.river_actions.join(" → ") || "none"}
            </div>
          )}
          {trace?.replay?.river_actions && (
            <div style={{ color: "rgba(34,197,94,0.5)" }}>
              river(replay): {trace.replay.river_actions.join(" → ") || "none"}
            </div>
          )}
          {trace?.action_count_mismatch && (
            <div style={{ color: "#F87171", fontWeight: "bold", marginTop: "4px" }}>
              {trace.action_count_mismatch}
            </div>
          )}
          {/* Solver detail */}
          {trace?.solver && (
            <div style={{ marginTop: "4px", color: "rgba(34,197,94,0.5)" }}>
              solver: {JSON.stringify(trace.solver).slice(0, 200)}
            </div>
          )}
          {/* Corrections */}
          {trace?.corrections && trace.corrections.length > 0 && (
            <div style={{ marginTop: "4px", color: "rgba(251,191,36,0.5)" }}>
              corrections: {trace.corrections.join(", ")}
            </div>
          )}
          {/* Full action dump */}
          <div style={{ marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
            {actions.map((a, i) => (
              <div key={i} style={{
                color: a.is_hero ? "rgba(124,92,255,0.7)" : "rgba(251,191,36,0.5)",
                fontWeight: ["bet", "raise"].includes(a.action) && !a.is_hero ? "bold" : "normal",
                background: ["bet", "raise"].includes(a.action) && !a.is_hero ? "rgba(248,113,113,0.06)" : "transparent",
              }}>
                [{i}] {a.street} {a.player} {a.action} amt={a.amount ?? "null"} allin={String(a.is_all_in)} pot={a.pot_after}
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* WORKSPACE — split on desktop */}
      <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr] lg:items-stretch">

        {/* LEFT: Table + Timeline + Controls */}
        <div
          className="flex flex-col"
          style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Table */}
          <div
            className="flex items-center justify-center"
            style={{ background: "rgba(4,10,6,0.55)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            <PokerTable
              seats={seats}
              visibleBoard={replay.visibleBoard}
              currentAction={replay.currentAction}
              currentPot={replay.currentPot}
              currentStep={replay.step}
              bigBlind={
                hand_summary.big_blind && hand_summary.big_blind > 1
                  ? hand_summary.big_blind
                  : undefined
              }
              currentHeroStack={replay.currentHeroStack}
              currentVillainStack={replay.currentVillainStack}
              playerStacksAfter={replay.currentPlayerStacks ?? undefined}
              allInPlayers={replay.currentAllInPlayers}
              sidePots={replay.currentSidePots}
              pendingAggression={replay.pendingAggression}
              actions={actions}
            />
          </div>

          {/* Timeline + Controls */}
          <div style={{ background: "rgba(6,9,14,0.75)" }}>
            {actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                <p className="text-sm" style={{ color: "rgba(148,163,184,0.38)" }}>
                  No action sequence available for this hand.
                </p>
                <p className="text-xs" style={{ color: "rgba(100,116,139,0.25)" }}>
                  The replay requires action data generated by the analysis pipeline.
                </p>
              </div>
            ) : (
              <>
                <HorizontalTimeline
                  actions={actions}
                  step={replay.step}
                  onGoTo={replay.goTo}
                />
                <ReplayControls
                  isPlaying={replay.isPlaying}
                  isFirst={replay.isFirst}
                  isLast={replay.isLast}
                  onPlay={replay.play}
                  onPause={replay.pause}
                  onNext={replay.next}
                  onPrev={replay.prev}
                  onReset={replay.reset}
                  onSkipEnd={() => replay.goTo(actions.length)}
                />
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Analysis Panel — always visible */}
        <div
          className="lg:overflow-y-auto"
          style={{
            background: "rgba(7,11,17,0.88)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            maxHeight: "none",
          }}
        >
          <AnalysisPanel
            coaching={activeCoaching?.coaching ?? null}
            currentAction={activeCoaching ? actions[activeCoaching.actionIdx] : null}
            facingAction={facingAction}
            handSummary={hand_summary}
            currentStreet={currentStreet}
            step={replay.step}
            solver={solver}
          />
        </div>
      </div>

      {/* VERDICT — full width, end of hand only */}
      {replay.showVerdict && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <PremiumVerdict verdict={overall_verdict} />
        </div>
      )}
    </div>
  );
}
