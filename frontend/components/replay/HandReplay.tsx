"use client";

import { useMemo } from "react";
import {
  Play, Pause, ChevronLeft, ChevronRight, SkipBack, SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReplay } from "@/hooks/useReplay";
import { buildSeatMap } from "@/lib/replay/seatEngine";
import { PokerTable } from "./PokerTable";
import { CoachCard } from "./CoachCard";
import { VerdictCard } from "./VerdictCard";
import type { ReplayAnalysis, ReplayAction, ValidationInfo } from "@/lib/types";

// ── Props ───────────────────────────────────────────────────────────────────

interface HandReplayProps {
  analysis: ReplayAnalysis;
  filename: string;
  validation?: ValidationInfo;
}

// ── Street pill ─────────────────────────────────────────────────────────────

const STREET_PILL: Record<string, string> = {
  preflop: "bg-blue-500/12 text-blue-300/80 border-blue-500/20",
  flop:    "bg-emerald-500/12 text-emerald-300/80 border-emerald-500/20",
  turn:    "bg-orange-500/12 text-orange-300/80 border-orange-500/20",
  river:   "bg-red-500/12 text-red-300/80 border-red-500/20",
};

// ── Action log colors ────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  fold:   "text-red-400/75",
  check:  "text-white/40",
  call:   "text-sky-300/80",
  bet:    "text-poker-green",
  raise:  "text-poker-green",
  "all-in": "text-yellow-300",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function ConfidencePill({ validation }: { validation: ValidationInfo }) {
  const pct = Math.round(validation.confidence * 100);
  const color =
    pct >= 80 ? "bg-poker-green/12 text-poker-green/80 border-poker-green/20" :
    pct >= 55 ? "bg-yellow-500/12 text-yellow-300/80 border-yellow-500/20" :
                "bg-red-500/12 text-red-400/80 border-red-500/20";
  const title = [
    `Detected by: ${validation.hero_detected_by}`,
    ...validation.warnings.map((w) => `⚠ ${w}`),
    ...validation.errors.map((e) => `✗ ${e}`),
  ].join("\n");
  return (
    <span
      title={title}
      className={cn(
        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border cursor-help",
        color
      )}
    >
      {pct}%
    </span>
  );
}

// Compact action log — shows all actions up to current step
function ActionLog({
  actions,
  step,
}: {
  actions: ReplayAction[];
  step: number;
}) {
  const visible = actions.slice(0, step + 1);
  // Show last 6 + current
  const display = visible.slice(-5);
  const hasMore = visible.length > display.length;

  if (display.length === 0) {
    return (
      <div className="text-center text-[11px] text-white/20 py-2">
        Waiting for first action…
      </div>
    );
  }

  // Group by street for separators
  let lastStreet = "";

  return (
    <div className="space-y-0.5">
      {hasMore && (
        <div className="text-[9px] text-white/18 text-center pb-1">
          ↑ {visible.length - display.length} earlier actions…
        </div>
      )}
      {display.map((action, localIdx) => {
        const globalIdx = visible.length - display.length + localIdx;
        const isCurrent = globalIdx === step;
        const showStreetSep = action.street !== lastStreet;
        lastStreet = action.street;

        return (
          <div key={globalIdx}>
            {showStreetSep && localIdx > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-white/6" />
                <span className="text-[8px] uppercase tracking-widest text-white/20 font-semibold">
                  {action.street}
                </span>
                <div className="h-px flex-1 bg-white/6" />
              </div>
            )}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200",
                isCurrent
                  ? "bg-white/7 border border-white/7"
                  : "opacity-45"
              )}
            >
              {/* Player name */}
              <span
                className={cn(
                  "text-[10px] font-semibold min-w-[56px] truncate",
                  action.is_hero ? "text-poker-green/90" : "text-white/55"
                )}
              >
                {action.player}
              </span>

              {/* Action */}
              <span
                className={cn(
                  "text-[11px] font-bold capitalize",
                  ACTION_COLOR[action.action] ?? "text-white/50"
                )}
              >
                {action.action}
              </span>

              {/* Amount */}
              {action.amount && (
                <span className="text-[10px] text-white/40 font-medium tabular-nums">
                  {action.amount}
                </span>
              )}

              {/* Hero feedback dot */}
              {action.is_hero && action.feedback && (
                <span
                  className={cn(
                    "ml-auto h-1.5 w-1.5 rounded-full shrink-0",
                    action.feedback.rating === "good"    ? "bg-poker-green" :
                    action.feedback.rating === "mistake" ? "bg-red-400" :
                    "bg-yellow-400"
                  )}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Progress dots
function ReplayDots({
  actions,
  step,
  onGoTo,
}: {
  actions: ReplayAction[];
  step: number;
  onGoTo: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {actions.map((action, i) => {
        const isPast    = i < step;
        const isCurrent = i === step;
        const isFuture  = i > step;
        const rating    = action.feedback?.rating;

        let dotClass = "bg-white/12";
        if (action.is_hero) {
          if (!isFuture) {
            dotClass =
              rating === "good"    ? "bg-poker-green" :
              rating === "mistake" ? "bg-red-400" :
              rating === "okay"    ? "bg-yellow-400" :
              "bg-white/35";
          }
        } else if (!isFuture) {
          dotClass = isPast ? "bg-white/18" : "bg-white/32";
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onGoTo(i)}
            title={`${action.player}: ${action.action}${action.amount ? " " + action.amount : ""}`}
            className={cn(
              "rounded-full transition-all duration-200 cursor-pointer hover:opacity-80",
              isCurrent ? "w-5 h-2" : "w-2 h-2",
              dotClass,
              isFuture && "opacity-22"
            )}
          />
        );
      })}
    </div>
  );
}

// Minimal playback controls
function MinimalControls({
  isPlaying, isFirst, isLast,
  onPlay, onPause, onNext, onPrev, onReset, onSkipEnd,
}: {
  isPlaying: boolean; isFirst: boolean; isLast: boolean;
  onPlay: () => void; onPause: () => void; onNext: () => void;
  onPrev: () => void; onReset: () => void; onSkipEnd: () => void;
}) {
  const btnBase =
    "p-1.5 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={onReset} disabled={isFirst}
        className={cn(btnBase, "text-white/28 hover:text-white/55")}>
        <SkipBack className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onPrev} disabled={isFirst}
        className={cn(btnBase, "text-white/42 hover:text-white/70")}>
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLast && !isPlaying}
        className="h-10 w-10 rounded-full flex items-center justify-center bg-white/7 hover:bg-white/12 text-white/65 hover:text-white transition-all border border-white/8 disabled:opacity-20 disabled:cursor-not-allowed"
      >
        {isPlaying
          ? <Pause className="h-3.5 w-3.5" />
          : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      <button type="button" onClick={onNext} disabled={isLast}
        className={cn(btnBase, "text-white/42 hover:text-white/70")}>
        <ChevronRight className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSkipEnd} disabled={isLast}
        className={cn(btnBase, "text-white/28 hover:text-white/55")}>
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function HandReplay({ analysis, filename, validation }: HandReplayProps) {
  const replay = useReplay(analysis);
  const { hand_summary, actions, overall_verdict } = analysis;

  // Build the full seat map once (stable across re-renders for same analysis)
  const seats = useMemo(() => buildSeatMap(analysis), [analysis]);

  // Most recent hero feedback for stable CoachCard key
  const lastHeroFeedbackStep = useMemo(() => {
    for (let i = replay.step; i >= 0; i--) {
      if (actions[i].is_hero && actions[i].feedback) return i;
    }
    return -1;
  }, [replay.step, actions]);

  const showCoachCard = lastHeroFeedbackStep >= 0 && !!replay.currentFeedback;

  const mistakeCount = actions.filter(
    (a) => a.is_hero && a.feedback?.rating === "mistake"
  ).length;

  const tableSize = seats.length;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/5 animate-fade-in"
      style={{ background: "#080B12", boxShadow: "0 32px 80px rgba(0,0,0,0.88)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-white/5"
        style={{ background: "rgba(255,255,255,0.018)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white/70">{hand_summary.stakes}</span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] text-white/42">{hand_summary.hero_position}</span>
          {hand_summary.villain_position && (
            <>
              <span className="text-[11px] text-white/18">vs</span>
              <span className="text-[11px] text-white/42">{hand_summary.villain_position}</span>
            </>
          )}
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] text-white/28">
            {hand_summary.effective_stack_bb.toFixed(0)}bb
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] text-white/28">{tableSize}-max</span>
        </div>

        <div className="flex items-center gap-2">
          {replay.currentAction && (
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all",
                STREET_PILL[replay.currentStreet]
              )}
            >
              {replay.currentStreet}
            </span>
          )}
          {mistakeCount > 0 && (
            <span className="text-[9px] text-red-400/55 font-semibold">
              {mistakeCount} mistake{mistakeCount !== 1 ? "s" : ""}
            </span>
          )}
          {validation && <ConfidencePill validation={validation} />}
        </div>
      </div>

      {/* ── Poker table ───────────────────────────────────────────────────── */}
      <div
        className="pt-8 pb-4"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 44%, rgba(0,200,83,0.028) 0%, transparent 70%)",
        }}
      >
        <PokerTable
          seats={seats}
          visibleBoard={replay.visibleBoard}
          currentAction={replay.currentAction}
          currentPot={replay.currentPot}
          currentStep={replay.step}
        />
      </div>

      {/* ── Action log + coach card ───────────────────────────────────────── */}
      <div className="px-4 pb-3 space-y-2.5">
        {/* Action log */}
        <div
          className="rounded-2xl border border-white/5 px-1 py-1.5"
          style={{ background: "rgba(0,0,0,0.22)" }}
        >
          <ActionLog actions={actions} step={replay.step} />
        </div>

        {/* Coach feedback */}
        <div className="min-h-[52px] flex items-start">
          {showCoachCard && replay.currentFeedback && (
            <CoachCard
              feedback={replay.currentFeedback}
              triggerKey={lastHeroFeedbackStep}
            />
          )}
        </div>
      </div>

      {/* ── Footer: dots + controls ───────────────────────────────────────── */}
      <div
        className="px-5 py-5 space-y-4 border-t border-white/5"
        style={{ background: "rgba(0,0,0,0.22)" }}
      >
        <ReplayDots
          actions={actions}
          step={replay.step}
          onGoTo={replay.goTo}
        />
        <MinimalControls
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
      </div>

      {/* ── Verdict ───────────────────────────────────────────────────────── */}
      {replay.showVerdict && (
        <div
          className="px-5 pb-5 pt-4 border-t border-white/5"
          style={{ background: "#080B12" }}
        >
          <VerdictCard verdict={overall_verdict} />
        </div>
      )}
    </div>
  );
}
