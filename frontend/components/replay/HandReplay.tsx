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
import { ReplaySidebar } from "./ReplaySidebar";
import type { ReplayAnalysis, ReplayAction, ValidationInfo } from "@/lib/types";

interface HandReplayProps {
  analysis: ReplayAnalysis;
  filename: string;
  validation?: ValidationInfo;
}

// ── Color maps ───────────────────────────────────────────────────────────────

const STREET_PILL: Record<string, string> = {
  preflop: "text-sky-400/65 border-sky-500/18 bg-sky-500/8",
  flop:    "text-emerald-400/65 border-emerald-500/18 bg-emerald-500/8",
  turn:    "text-amber-400/65 border-amber-500/18 bg-amber-500/8",
  river:   "text-rose-400/65 border-rose-500/18 bg-rose-500/8",
};

const ACTION_COLOR: Record<string, string> = {
  fold:     "text-slate-400/55",
  check:    "text-slate-400/45",
  call:     "text-sky-300/75",
  bet:      "text-emerald-400/85",
  raise:    "text-emerald-400/85",
  "all-in": "text-amber-300/85",
};

// ── Confidence pill ──────────────────────────────────────────────────────────

function ConfidencePill({ validation }: { validation: ValidationInfo }) {
  const pct = Math.round(validation.confidence * 100);
  const cls =
    pct >= 80 ? "text-emerald-400/55 border-emerald-500/18" :
    pct >= 55 ? "text-amber-400/55 border-amber-500/18" :
                "text-rose-400/55 border-rose-500/18";
  const title = [
    `Detected by: ${validation.hero_detected_by}`,
    ...validation.warnings.map((w) => `⚠ ${w}`),
    ...validation.errors.map((e) => `✗ ${e}`),
  ].join("\n");
  return (
    <span
      title={title}
      className={cn("text-[9px] font-medium tracking-widest px-2 py-0.5 rounded-full border cursor-help", cls)}
    >
      {pct}%
    </span>
  );
}

// ── Action feed (mobile / condensed) ─────────────────────────────────────────

function ActionFeed({ actions, step }: { actions: ReplayAction[]; step: number }) {
  const visible = actions.slice(0, step + 1);
  const display = visible.slice(-5);
  const hasMore = visible.length > display.length;
  let lastStreet = "";

  if (display.length === 0) {
    return (
      <p className="text-center text-[11px] py-3 text-slate-500/50">
        Hand in progress…
      </p>
    );
  }

  return (
    <div className="space-y-px">
      {hasMore && (
        <p className="text-center text-[9px] pb-1 text-slate-500/35">
          {visible.length - display.length} earlier actions
        </p>
      )}
      {display.map((action, localIdx) => {
        const globalIdx = visible.length - display.length + localIdx;
        const isCurrent = globalIdx === step;
        const showSep = action.street !== lastStreet;
        lastStreet = action.street;

        return (
          <div key={globalIdx}>
            {showSep && localIdx > 0 && (
              <div className="flex items-center gap-2.5 py-2">
                <div className="h-px flex-1 bg-white/[0.04]" />
                <span className="text-[8px] uppercase tracking-[0.22em] font-medium text-slate-500/40">
                  {action.street}
                </span>
                <div className="h-px flex-1 bg-white/[0.04]" />
              </div>
            )}
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300",
                isCurrent ? "opacity-100" : "opacity-35"
              )}
              style={isCurrent ? {
                background: "rgba(255,255,255,0.038)",
                border: "1px solid rgba(255,255,255,0.055)",
              } : {}}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold min-w-[52px] truncate",
                  action.is_hero ? "text-emerald-400/75" : "text-slate-400/55"
                )}
              >
                {action.player}
              </span>
              <span className={cn("text-[11px] font-semibold capitalize", ACTION_COLOR[action.action] ?? "text-slate-400/45")}>
                {action.action}
              </span>
              {action.amount && (
                <span className="text-[10px] font-medium tabular-nums text-slate-500/50">
                  {action.amount}
                </span>
              )}
              {action.is_hero && action.feedback && (
                <span
                  className={cn(
                    "ml-auto h-1.5 w-1.5 rounded-full shrink-0",
                    action.feedback.rating === "good"    ? "bg-emerald-400" :
                    action.feedback.rating === "mistake" ? "bg-rose-400" :
                    "bg-amber-400"
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

// ── Progress track ───────────────────────────────────────────────────────────

function ProgressTrack({
  actions, step, onGoTo,
}: { actions: ReplayAction[]; step: number; onGoTo: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {actions.map((action, i) => {
        const isPast    = i < step;
        const isCurrent = i === step;
        const isFuture  = i > step;
        const rating    = action.feedback?.rating;

        let bg = "rgba(255,255,255,0.10)";
        if (action.is_hero && !isFuture) {
          bg = rating === "good"    ? "#22C55E" :
               rating === "mistake" ? "#F87171" :
               rating === "okay"    ? "#FBBF24" :
               "rgba(255,255,255,0.32)";
        } else if (!isFuture) {
          bg = isPast ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.28)";
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onGoTo(i)}
            title={`${action.player}: ${action.action}${action.amount ? " " + action.amount : ""}`}
            className={cn(
              "rounded-full transition-all duration-200 cursor-pointer hover:opacity-90",
              isCurrent ? "h-[9px] w-6" : "h-[9px] w-[9px]",
              isFuture && "opacity-[0.15]"
            )}
            style={{ background: bg }}
          />
        );
      })}
    </div>
  );
}

// ── Transport controls ───────────────────────────────────────────────────────

function Transport({
  isPlaying, isFirst, isLast,
  onPlay, onPause, onNext, onPrev, onReset, onSkipEnd,
}: {
  isPlaying: boolean; isFirst: boolean; isLast: boolean;
  onPlay: () => void; onPause: () => void; onNext: () => void;
  onPrev: () => void; onReset: () => void; onSkipEnd: () => void;
}) {
  const ghost = "p-2 rounded-full transition-all duration-200 disabled:opacity-[0.12] disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={onReset} disabled={isFirst}
        className={cn(ghost, "text-white/22 hover:text-white/50")}>
        <SkipBack className="h-3.5 w-3.5" />
      </button>

      <button type="button" onClick={onPrev} disabled={isFirst}
        className={cn(ghost, "text-white/38 hover:text-white/68")}>
        <ChevronLeft className="h-[18px] w-[18px]" />
      </button>

      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        disabled={isLast && !isPlaying}
        className="h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-[0.12] disabled:cursor-not-allowed bg-white/[0.08] hover:bg-white/[0.13] border border-white/[0.10]"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
      >
        {isPlaying
          ? <Pause className="h-4 w-4 text-white/75" />
          : <Play className="h-4 w-4 text-white/75 ml-0.5" />}
      </button>

      <button type="button" onClick={onNext} disabled={isLast}
        className={cn(ghost, "text-white/38 hover:text-white/68")}>
        <ChevronRight className="h-[18px] w-[18px]" />
      </button>

      <button type="button" onClick={onSkipEnd} disabled={isLast}
        className={cn(ghost, "text-white/22 hover:text-white/50")}>
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function HandReplay({ analysis, filename, validation }: HandReplayProps) {
  const replay = useReplay(analysis);
  const { hand_summary, actions, overall_verdict } = analysis;
  const seats = useMemo(() => buildSeatMap(analysis), [analysis]);

  const lastHeroFeedbackStep = useMemo(() => {
    for (let i = replay.step; i >= 0; i--) {
      if (actions[i].is_hero && actions[i].feedback) return i;
    }
    return -1;
  }, [replay.step, actions]);

  const showCoachCard = lastHeroFeedbackStep >= 0 && !!replay.currentFeedback;
  const mistakeCount = actions.filter((a) => a.is_hero && a.feedback?.rating === "mistake").length;
  const tableSize = seats.length;

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: "#0B0F14",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.88), 0 0 0 1px rgba(0,0,0,0.5)",
      }}
    >
      {/* ── Header — full width ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-white/72 shrink-0">
            {hand_summary.stakes}
          </span>
          <span className="w-px h-3.5 bg-white/[0.08] shrink-0" />
          <span className="text-xs text-slate-400/55 truncate">
            {hand_summary.hero_position}
            {hand_summary.villain_position && (
              <>
                <span className="text-slate-600/50 mx-1">vs</span>
                {hand_summary.villain_position}
              </>
            )}
          </span>
          <span className="w-px h-3.5 bg-white/[0.08] shrink-0" />
          <span className="text-xs text-slate-500/40 shrink-0">
            {hand_summary.effective_stack_bb.toFixed(0)}bb · {tableSize}p
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          {replay.currentAction && (
            <span
              className={cn(
                "text-[9px] font-medium tracking-widest px-2.5 py-0.5 rounded-full border transition-all duration-500",
                STREET_PILL[replay.currentStreet]
              )}
            >
              {replay.currentStreet}
            </span>
          )}
          {mistakeCount > 0 && (
            <span className="text-[9px] font-medium text-rose-400/45">
              {mistakeCount}×
            </span>
          )}
          {validation && <ConfidencePill validation={validation} />}
        </div>
      </div>

      {/* ── Body: desktop 2-col / mobile single-col ──────────────────────── */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] lg:items-stretch">

        {/* ── LEFT: table + controls ───────────────────────────────────── */}
        <div className="flex flex-col">
          {/* Table */}
          <div
            className="py-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 52% at 50% 48%, rgba(34,197,94,0.022) 0%, transparent 70%)",
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

          {/* Action feed — mobile only */}
          <div className="lg:hidden px-4 pb-3">
            <ActionFeed actions={actions} step={replay.step} />
          </div>

          {/* Coach card — mobile only */}
          {showCoachCard && replay.currentFeedback && (
            <div className="lg:hidden px-4 pb-4">
              <CoachCard
                feedback={replay.currentFeedback}
                triggerKey={lastHeroFeedbackStep}
              />
            </div>
          )}

          {/* Transport */}
          <div
            className="px-6 py-5 space-y-4 mt-auto"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <ProgressTrack actions={actions} step={replay.step} onGoTo={replay.goTo} />
            <Transport
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

          {/* Verdict */}
          {replay.showVerdict && (
            <div
              className="px-5 pt-5 pb-6"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.05)",
                background: "#0B0F14",
              }}
            >
              <VerdictCard verdict={overall_verdict} />
            </div>
          )}
        </div>

        {/* ── RIGHT: sidebar — desktop only ────────────────────────────── */}
        <div
          className="hidden lg:flex lg:flex-col"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="overflow-y-auto flex-1 min-h-0" style={{ maxHeight: "calc(100vh - 80px)" }}>
            <ReplaySidebar
              actions={actions}
              step={replay.step}
              onGoTo={replay.goTo}
              currentStreet={replay.currentStreet}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
