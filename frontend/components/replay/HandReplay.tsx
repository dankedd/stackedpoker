"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
  const actionNum = Math.max(0, step + 1);

  return (
    <div
      className="relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.35)" }}
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
          const isVisited = step >= (firstIdxByStreet[s] ?? Infinity);
          const meta = STREET_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => { const idx = firstIdxByStreet[s]; if (idx >= 0) onGoTo(idx); }}
              disabled={firstIdxByStreet[s] < 0}
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
            {step >= 0 ? (
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
                  const isCurrent = globalIdx === step;
                  const isPast    = globalIdx < step;
                  const isFuture  = globalIdx > step;
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
                        onClick={() => onGoTo(globalIdx)}
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
                            background: globalIdx < step
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
// SCORE RING
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({
  score, quality, mounted, size = 80,
}: {
  score: number; quality: string; mounted: boolean; size?: number;
}) {
  const qs = QUALITY_STYLE[quality] ?? QUALITY_STYLE.Standard;
  const r = size * 0.36;
  const circ = 2 * Math.PI * r;
  const dashOffset = mounted ? circ * (1 - score / 100) : circ;
  const c = size / 2;

  return (
    <div
      className="relative flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5" />
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke={qs.bar} strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 0 5px ${qs.bar}70)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className="font-black tabular-nums leading-none"
          style={{ color: qs.text, fontSize: size * 0.27 }}
        >
          {score}
        </span>
        <span
          className="font-medium leading-none mt-0.5"
          style={{ color: "rgba(100,116,139,0.5)", fontSize: size * 0.11 }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI COACH PANEL
// ─────────────────────────────────────────────────────────────────────────────

function AICoachPanel({
  coaching,
  actionIdx,
  isCurrentAction,
  currentAction,
}: {
  coaching: ActionCoaching;
  actionIdx: number;
  isCurrentAction: boolean;
  currentAction: ReplayAction;
}) {
  const qs = QUALITY_STYLE[coaching.quality] ?? QUALITY_STYLE.Standard;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => { cancelAnimationFrame(id); setMounted(false); };
  }, [actionIdx]);

  return (
    <div
      className="animate-slide-up-in"
      style={{
        background: "rgba(0,0,0,0.18)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Panel header bar */}
      <div
        className="flex items-center justify-between px-5 sm:px-6 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-1.5 h-5 rounded-full"
            style={{ background: qs.bar, boxShadow: `0 0 8px ${qs.bar}70` }}
          />
          <span
            className="text-[10px] font-black tracking-[0.2em] uppercase"
            style={{ color: "rgba(148,163,184,0.45)" }}
          >
            AI Coach
          </span>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{ background: qs.bg, border: `1px solid ${qs.border}` }}
        >
          <span
            className="text-[10px] font-black"
            style={{ color: qs.text }}
          >
            {qs.indicator}
          </span>
          <span className="text-xs font-bold" style={{ color: qs.text }}>
            {qs.label}
          </span>
          {coaching.mistake_level !== "None" && (
            <span
              className="text-[10px]"
              style={{ color: `${qs.text}80` }}
            >
              · {coaching.mistake_level}
            </span>
          )}
        </div>
      </div>

      {/* Content — 3-column desktop, stacked mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr_1fr]">

        {/* SCORE column */}
        <div
          className="flex flex-col items-center justify-center py-6 px-6 lg:border-r"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <ScoreRing
            score={coaching.score}
            quality={coaching.quality}
            mounted={mounted}
            size={84}
          />
          <p className="mt-2.5 text-xs font-bold text-center" style={{ color: qs.text }}>
            {qs.label}
          </p>
          <p
            className="text-[9px] text-center mt-0.5 uppercase tracking-wide"
            style={{ color: "rgba(100,116,139,0.4)" }}
          >
            Action score
          </p>
        </div>

        {/* ANALYSIS column */}
        <div
          className="px-5 sm:px-6 py-5 lg:border-r"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {/* Action taken */}
          <div className="mb-4">
            <p
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ color: "rgba(100,116,139,0.5)" }}
            >
              Action Taken
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-lg font-black capitalize"
                style={{ color: ACTION_COLOR_MAP[currentAction.action] ?? "#94A3B8" }}
              >
                {currentAction.action}
              </span>
              {currentAction.amount && (
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: `${ACTION_COLOR_MAP[currentAction.action] ?? "#94A3B8"}99` }}
                >
                  {currentAction.amount}
                </span>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div className="mb-4">
            <p
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ color: "rgba(100,116,139,0.5)" }}
            >
              Analysis
            </p>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "rgba(203,213,225,0.75)" }}
            >
              {coaching.explanation}
            </p>
          </div>

          {/* Reason tags */}
          {coaching.reason_codes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {coaching.reason_codes.map((code) => (
                <span
                  key={code}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "rgba(148,163,184,0.65)",
                  }}
                >
                  {REASON_LABEL[code] ?? code}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* RECOMMENDED column */}
        <div className="px-5 sm:px-6 py-5">
          {coaching.preferred_actions.length > 0 && (
            <div className="mb-5">
              <p
                className="text-[9px] uppercase tracking-[0.22em] font-bold mb-3"
                style={{ color: "rgba(100,116,139,0.5)" }}
              >
                Recommended
              </p>
              <div className="space-y-3.5">
                {coaching.preferred_actions.map((pa, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold capitalize"
                          style={{ color: i === 0 ? qs.text : "rgba(148,163,184,0.55)" }}
                        >
                          {pa.action}
                        </span>
                        {i === 0 && (
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-black tracking-wide"
                            style={{ background: qs.bg, color: qs.text, border: `1px solid ${qs.border}` }}
                          >
                            GTO
                          </span>
                        )}
                      </div>
                      <span
                        className="text-sm font-black tabular-nums"
                        style={{ color: i === 0 ? qs.text : "rgba(100,116,139,0.45)" }}
                      >
                        {pa.frequency}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: mounted ? `${pa.frequency}%` : "0%",
                          background: i === 0 ? qs.bar : "rgba(148,163,184,0.18)",
                          transition: `width 0.75s cubic-bezier(0.22, 1, 0.36, 1) ${i * 120}ms`,
                          boxShadow: i === 0 ? `0 0 8px ${qs.bar}55` : "none",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjustment */}
          <div>
            <p
              className="text-[9px] uppercase tracking-[0.22em] font-bold mb-2"
              style={{ color: "rgba(100,116,139,0.5)" }}
            >
              Adjustment
            </p>
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "rgba(203,213,225,0.62)" }}
              >
                {coaching.adjustment}
              </p>
            </div>
          </div>
        </div>
      </div>
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => { cancelAnimationFrame(id); setMounted(false); };
  }, []);

  return (
    <div className="px-5 sm:px-6 py-6 animate-slide-up-in">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="h-4 w-4" style={{ color: "#FBBF24" }} />
        <span
          className="text-[10px] font-black tracking-[0.2em] uppercase"
          style={{ color: "rgba(148,163,184,0.45)" }}
        >
          Hand Verdict
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8">
        <div className="flex flex-col items-center md:items-start gap-2">
          <ScoreRing score={verdict.score} quality={qualityKey} mounted={mounted} size={88} />
          <p className="text-sm font-bold text-center md:text-left" style={{ color: qs.text }}>
            {verdict.title}
          </p>
        </div>

        <div>
          <p
            className="text-[13px] leading-relaxed mb-5"
            style={{ color: "rgba(148,163,184,0.68)" }}
          >
            {verdict.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {verdict.key_mistakes.length > 0 && (
              <div>
                <p
                  className="text-[9px] uppercase tracking-[0.2em] font-black mb-2.5"
                  style={{ color: "rgba(248,113,113,0.6)" }}
                >
                  Leaks
                </p>
                <div className="space-y-2">
                  {verdict.key_mistakes.map((m, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-rose-400/70" />
                      <p className="text-xs leading-snug" style={{ color: "rgba(148,163,184,0.62)" }}>{m}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verdict.key_strengths.length > 0 && (
              <div>
                <p
                  className="text-[9px] uppercase tracking-[0.2em] font-black mb-2.5"
                  style={{ color: "rgba(34,197,94,0.6)" }}
                >
                  Strengths
                </p>
                <div className="space-y-2">
                  {verdict.key_strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400/70" />
                      <p className="text-xs leading-snug" style={{ color: "rgba(148,163,184,0.62)" }}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function HandReplay({ analysis, filename, validation }: HandReplayProps) {
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
    if (replay.step < 0) return null;
    for (let i = replay.step; i >= 0; i--) {
      if (actions[i]?.is_hero && actions[i]?.coaching) {
        return { coaching: actions[i].coaching!, actionIdx: i };
      }
    }
    return null;
  }, [replay.step, actions]);

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
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: "#080C11",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      {/* HEADER */}
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

      {/* TABLE — visual focus */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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
        />
      </div>

      {/* TIMELINE + CONTROLS */}
      <div
        style={{
          background: "rgba(0,0,0,0.22)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {actions.length === 0 ? (
          /* Fallback: no action data — show a clear message instead of all-disabled controls */
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
              onSkipEnd={() => replay.goTo(actions.length - 1)}
            />
          </>
        )}
      </div>

      {/* AI COACH PANEL */}
      {activeCoaching && (
        <AICoachPanel
          coaching={activeCoaching.coaching}
          actionIdx={activeCoaching.actionIdx}
          isCurrentAction={activeCoaching.actionIdx === replay.step}
          currentAction={actions[activeCoaching.actionIdx]}
        />
      )}

      {/* VERDICT */}
      {replay.showVerdict && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <PremiumVerdict verdict={overall_verdict} />
        </div>
      )}
    </div>
  );
}
