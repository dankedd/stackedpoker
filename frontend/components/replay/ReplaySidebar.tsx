"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReplayAction, ActionCoaching } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const STREETS = ["preflop", "flop", "turn", "river"] as const;
type Street = (typeof STREETS)[number];

const STREET_LABEL: Record<Street, string> = {
  preflop: "Pre",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

const STREET_ACTIVE: Record<Street, string> = {
  preflop: "text-sky-300/90 border-sky-500/40 bg-sky-500/10",
  flop:    "text-emerald-300/90 border-emerald-500/40 bg-emerald-500/10",
  turn:    "text-amber-300/90 border-amber-500/40 bg-amber-500/10",
  river:   "text-rose-300/90 border-rose-500/40 bg-rose-500/10",
};

const QUALITY_STYLE: Record<
  string,
  { text: string; border: string; bg: string; bar: string }
> = {
  Elite:    { text: "#22C55E", border: "rgba(34,197,94,0.4)",   bg: "rgba(34,197,94,0.10)",  bar: "#22C55E" },
  Good:     { text: "#38BDF8", border: "rgba(56,189,248,0.35)", bg: "rgba(56,189,248,0.08)", bar: "#38BDF8" },
  Standard: { text: "rgba(148,163,184,0.85)", border: "rgba(148,163,184,0.22)", bg: "rgba(148,163,184,0.06)", bar: "rgba(148,163,184,0.5)" },
  Mistake:  { text: "#FBBF24", border: "rgba(251,191,36,0.35)", bg: "rgba(251,191,36,0.08)", bar: "#FBBF24" },
  Punt:     { text: "#F87171", border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.10)", bar: "#F87171" },
};

const REASON_LABEL: Record<string, string> = {
  RANGE_ADVANTAGE:        "Range advantage",
  RANGE_DISADVANTAGE:     "Range disadvantage",
  DRY_BOARD:              "Dry board",
  WET_BOARD:              "Wet board",
  MONOTONE_BOARD:         "Monotone",
  FLUSH_DRAW_PRESENT:     "Flush draw",
  STRAIGHT_DRAWS_PRESENT: "Straight draws",
  PAIRED_BOARD:           "Paired board",
  IN_POSITION:            "In position",
  OUT_OF_POSITION:        "Out of position",
  AGGRESSOR:              "Aggressor",
  CALLER:                 "Caller",
  OVER_SIZING:            "Oversizing",
  DONK_BET:               "Donk bet",
  MIN_RAISE:              "Min-raise",
  BLOCKER_SPOT:           "Blocker spot",
};

const ACTION_COLOR: Record<string, string> = {
  fold:     "text-slate-400/50",
  check:    "text-slate-400/45",
  call:     "text-sky-300/80",
  bet:      "text-emerald-400/90",
  raise:    "text-emerald-400/90",
  "all-in": "text-amber-300/90",
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface ReplaySidebarProps {
  actions: ReplayAction[];
  step: number;
  onGoTo: (n: number) => void;
  currentStreet: string;
  effectiveStackBb?: number;
  bigBlind?: number;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ReplaySidebar({
  actions,
  step,
  onGoTo,
  currentStreet,
  effectiveStackBb,
  bigBlind,
}: ReplaySidebarProps) {
  // Which streets have at least one action
  const availableStreets = useMemo(
    () => STREETS.filter((s) => actions.some((a) => a.street === s)),
    [actions]
  );

  // Find first action index for a street (for navigation)
  const firstIdxByStreet = useMemo(
    () =>
      Object.fromEntries(
        STREETS.map((s) => [s, actions.findIndex((a) => a.street === s)])
      ) as Record<Street, number>,
    [actions]
  );

  // Coaching to show: current action if hero, else last hero action before step
  const activeCoaching = useMemo<{
    coaching: ActionCoaching;
    actionIdx: number;
  } | null>(() => {
    if (step < 0) return null;
    for (let i = step; i >= 0; i--) {
      if (actions[i]?.is_hero && actions[i]?.coaching) {
        return { coaching: actions[i].coaching!, actionIdx: i };
      }
    }
    return null;
  }, [step, actions]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Street Navigation ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex-shrink-0 px-4 pt-4 pb-3"
        style={{ background: "#0B0F14", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Effective stack HUD — shown at top of sidebar */}
        {effectiveStackBb !== undefined && (
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-[9px] uppercase font-semibold tracking-[0.2em]"
              style={{ color: "rgba(100,116,139,0.6)" }}
            >
              Street
            </p>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(56,189,248,0.07)",
                border: "1px solid rgba(56,189,248,0.15)",
                boxShadow: "0 0 8px rgba(56,189,248,0.05)",
              }}
            >
              <div className="h-1 w-1 rounded-full bg-sky-400/55 shrink-0" />
              <span className="text-[11px] font-bold tabular-nums" style={{ color: "rgba(186,230,253,0.85)" }}>
                {effectiveStackBb.toFixed(0)}bb
              </span>
              {bigBlind && bigBlind > 1 && (
                <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.5)" }}>
                  · {Math.round(effectiveStackBb * bigBlind).toLocaleString()}ch
                </span>
              )}
              <span className="text-[9px]" style={{ color: "rgba(100,116,139,0.4)" }}>eff</span>
            </div>
          </div>
        )}
        {effectiveStackBb === undefined && (
          <p
            className="text-[9px] uppercase font-semibold tracking-[0.2em] mb-2.5"
            style={{ color: "rgba(100,116,139,0.6)" }}
          >
            Street
          </p>
        )}
        <div className="flex gap-1.5">
          {availableStreets.map((s) => {
            const isActive = currentStreet === s;
            const isVisited = step >= (firstIdxByStreet[s] ?? Infinity);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const idx = firstIdxByStreet[s];
                  if (idx >= 0) onGoTo(idx);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide transition-all duration-200",
                  isActive
                    ? STREET_ACTIVE[s]
                    : isVisited
                    ? "text-white/40 border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    : "text-white/18 border-white/[0.06] cursor-not-allowed opacity-40"
                )}
                disabled={firstIdxByStreet[s] < 0}
              >
                {STREET_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Action Timeline ───────────────────────────────────────── */}
        <ActionTimeline
          actions={actions}
          step={step}
          onGoTo={onGoTo}
        />

        {/* ── Coaching Panel ────────────────────────────────────────── */}
        {activeCoaching && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <CoachingPanel
              coaching={activeCoaching.coaching}
              actionIdx={activeCoaching.actionIdx}
              isCurrentAction={activeCoaching.actionIdx === step}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Action Timeline ──────────────────────────────────────────────────────────

function ActionTimeline({
  actions,
  step,
  onGoTo,
}: {
  actions: ReplayAction[];
  step: number;
  onGoTo: (n: number) => void;
}) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step]);

  let lastStreet = "";

  return (
    <div className="py-2">
      <p
        className="px-4 pt-2 pb-2 text-[9px] uppercase font-semibold tracking-[0.2em]"
        style={{ color: "rgba(100,116,139,0.6)" }}
      >
        Actions
      </p>
      {actions.map((action, i) => {
        const isCurrent = i === step;
        const isPast = i < step;
        const showStreetDivider = action.street !== lastStreet;
        lastStreet = action.street;

        return (
          <div key={i}>
            {showStreetDivider && i > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.04)" }} />
                <span
                  className="text-[8px] uppercase tracking-[0.2em] font-medium"
                  style={{ color: "rgba(100,116,139,0.4)" }}
                >
                  {action.street}
                </span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
            )}

            <div ref={isCurrent ? activeRef : undefined}>
              <button
                type="button"
                onClick={() => onGoTo(i)}
                className={cn(
                  "w-full text-left px-4 py-2 transition-all duration-150",
                  isCurrent
                    ? "bg-white/[0.05]"
                    : "hover:bg-white/[0.03]",
                  !isCurrent && !isPast && "opacity-30"
                )}
                style={
                  isCurrent
                    ? { borderLeft: `2px solid rgba(255,255,255,0.18)` }
                    : { borderLeft: "2px solid transparent" }
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Player indicator */}
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: action.is_hero
                        ? "#22C55E"
                        : "rgba(148,163,184,0.35)",
                    }}
                  />

                  {/* Player name */}
                  <span
                    className={cn(
                      "text-[10px] font-semibold min-w-[44px] truncate flex-shrink-0",
                      action.is_hero ? "text-emerald-400/80" : "text-slate-400/55"
                    )}
                  >
                    {action.is_hero ? "YOU" : action.player}
                  </span>

                  {/* Action + amount */}
                  <span
                    className={cn(
                      "text-[11px] font-semibold capitalize flex-shrink-0",
                      ACTION_COLOR[action.action] ?? "text-slate-400/50"
                    )}
                  >
                    {action.action}
                  </span>
                  {action.amount && (
                    <span
                      className="text-[10px] tabular-nums truncate"
                      style={{ color: "rgba(148,163,184,0.45)" }}
                    >
                      {action.amount}
                    </span>
                  )}

                  {/* Score badge for hero */}
                  {action.is_hero && action.coaching && (
                    <div className="ml-auto flex-shrink-0">
                      <ScoreBadge
                        score={action.coaching.score}
                        quality={action.coaching.quality}
                        small
                      />
                    </div>
                  )}
                </div>

                {/* Pot after (only on current/past hero actions with amount) */}
                {(isCurrent || isPast) && (action.amount || action.is_hero) && (
                  <div
                    className="mt-0.5 pl-4 text-[9px] tabular-nums"
                    style={{ color: "rgba(100,116,139,0.4)" }}
                  >
                    pot {action.pot_after.toFixed(1)}bb
                  </div>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Coaching Panel ───────────────────────────────────────────────────────────

function CoachingPanel({
  coaching,
  actionIdx,
  isCurrentAction,
}: {
  coaching: ActionCoaching;
  actionIdx: number;
  isCurrentAction: boolean;
}) {
  const qs = QUALITY_STYLE[coaching.quality] ?? QUALITY_STYLE.Standard;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => { cancelAnimationFrame(t); setMounted(false); };
  }, [actionIdx]);

  return (
    <div className="p-4 space-y-4 animate-slide-up-in">
      <p
        className="text-[9px] uppercase font-semibold tracking-[0.2em]"
        style={{ color: "rgba(100,116,139,0.6)" }}
      >
        Coaching
      </p>

      {/* Score row — SVG ring + badge */}
      <div className="flex items-center gap-3">
        <ScoreRing score={coaching.score} quality={coaching.quality} mounted={mounted} />
        <div>
          <p className="text-xs font-bold" style={{ color: qs.text }}>
            {coaching.quality}
          </p>
          <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>
            {coaching.mistake_level === "None"
              ? "No issues detected"
              : `${coaching.mistake_level} deviation`}
          </p>
        </div>
      </div>

      {/* Preferred actions */}
      {coaching.preferred_actions.length > 0 && (
        <div className="space-y-1.5">
          <p
            className="text-[9px] uppercase font-semibold tracking-[0.18em]"
            style={{ color: "rgba(100,116,139,0.55)" }}
          >
            Recommended
          </p>
          {coaching.preferred_actions.map((pa, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: "rgba(226,232,240,0.75)" }}>
                  {pa.action}
                </span>
                <span
                  className="text-[10px] tabular-nums font-semibold"
                  style={{ color: i === 0 ? qs.text : "rgba(100,116,139,0.55)" }}
                >
                  {pa.frequency}%
                </span>
              </div>
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: mounted ? `${pa.frequency}%` : "0%",
                    background: i === 0 ? qs.bar : "rgba(148,163,184,0.22)",
                    transition: `width 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${i * 100}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reason codes */}
      {coaching.reason_codes.length > 0 && (
        <div className="space-y-1.5">
          <p
            className="text-[9px] uppercase font-semibold tracking-[0.18em]"
            style={{ color: "rgba(100,116,139,0.55)" }}
          >
            Why
          </p>
          <div className="flex flex-wrap gap-1">
            {coaching.reason_codes.map((code) => (
              <span
                key={code}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(148,163,184,0.65)",
                }}
              >
                {REASON_LABEL[code] ?? code}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="space-y-1">
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "rgba(148,163,184,0.65)" }}
        >
          {coaching.explanation}
        </p>
      </div>

      {/* Adjustment */}
      <div
        className="rounded-lg px-3 py-2.5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p
          className="text-[9px] uppercase font-semibold tracking-[0.18em] mb-1"
          style={{ color: "rgba(100,116,139,0.55)" }}
        >
          Adjustment
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(226,232,240,0.6)" }}>
          {coaching.adjustment}
        </p>
      </div>
    </div>
  );
}

// ── Score Ring (SVG animated) ────────────────────────────────────────────────

function ScoreRing({
  score,
  quality,
  mounted,
}: {
  score: number;
  quality: string;
  mounted: boolean;
}) {
  const qs = QUALITY_STYLE[quality] ?? QUALITY_STYLE.Standard;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fillPct = score / 100;
  const dashOffset = mounted ? circ * (1 - fillPct) : circ;

  return (
    <div className="relative flex-shrink-0 h-12 w-12 flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        {/* Track */}
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
        />
        {/* Fill */}
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke={qs.bar}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.85s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span
        className="absolute text-[13px] font-bold tabular-nums"
        style={{ color: qs.text }}
      >
        {score}
      </span>
    </div>
  );
}

// ── Score Badge (small, for timeline) ───────────────────────────────────────

function ScoreBadge({
  score,
  quality,
  small = false,
}: {
  score: number;
  quality: string;
  small?: boolean;
}) {
  const qs = QUALITY_STYLE[quality] ?? QUALITY_STYLE.Standard;
  const size = small ? "h-6 w-6 text-[9px]" : "h-11 w-11 text-[15px]";

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold tabular-nums flex-shrink-0", size)}
      style={{
        background: qs.bg,
        border: `1px solid ${qs.border}`,
        color: qs.text,
      }}
    >
      {score}
    </div>
  );
}
