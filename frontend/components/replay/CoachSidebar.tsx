"use client";

import { cn } from "@/lib/utils";
import { Brain, CheckCircle2, AlertTriangle, MinusCircle, Lightbulb, TrendingUp } from "lucide-react";
import type { ReplayFeedback, ReplayAction, HandSummaryData } from "@/lib/types";

interface CoachSidebarProps {
  feedback: ReplayFeedback | null;
  currentAction: ReplayAction | null;
  handSummary: HandSummaryData;
  step: number;
}

const RATING = {
  good: {
    gradient: "from-poker-green/8 to-transparent",
    border:   "border-poker-green/25",
    badge:    "bg-poker-green/15 text-poker-green border border-poker-green/30",
    icon:     <CheckCircle2 className="h-4 w-4" />,
    label:    "Good Play",
    dot:      "bg-poker-green",
  },
  okay: {
    gradient: "from-yellow-500/6 to-transparent",
    border:   "border-yellow-500/20",
    badge:    "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    icon:     <MinusCircle className="h-4 w-4" />,
    label:    "Suboptimal",
    dot:      "bg-yellow-400",
  },
  mistake: {
    gradient: "from-red-500/8 to-transparent",
    border:   "border-red-500/25",
    badge:    "bg-red-500/15 text-red-400 border border-red-500/30",
    icon:     <AlertTriangle className="h-4 w-4" />,
    label:    "Mistake",
    dot:      "bg-red-500",
  },
} as const;

function Divider() {
  return <div className="h-px bg-white/5" />;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold flex-shrink-0">{label}</span>
      <span className="text-[11px] text-white/60 text-right font-medium">{value}</span>
    </div>
  );
}

export function CoachSidebar({ feedback, currentAction, handSummary, step }: CoachSidebarProps) {
  // ── Idle state ─────────────────────────────────────────────────────────
  if (step < 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-poker-green/15">
              <Brain className="h-4 w-4 text-poker-green" />
            </div>
            <span className="text-sm font-semibold text-white/80">AI Coach</span>
          </div>
        </div>

        {/* Meta */}
        <div className="px-5 py-4 space-y-2.5 border-b border-white/5">
          <MetaRow label="Stakes"    value={handSummary.stakes} />
          <MetaRow label="Position"  value={handSummary.hero_position} />
          <MetaRow label="Stack"     value={`${handSummary.effective_stack_bb.toFixed(0)}bb`} />
          {handSummary.villain_position && (
            <MetaRow label="Villain" value={handSummary.villain_position} />
          )}
        </div>

        {/* Empty prompt */}
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="text-center space-y-2">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-white/5">
              <TrendingUp className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-xs text-white/30 leading-relaxed">
              Press <span className="text-white/50 font-semibold">Play</span> or{" "}
              <span className="text-white/50 font-semibold">Next</span> to begin.<br />
              Coaching appears on every hero action.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Villain action ──────────────────────────────────────────────────────
  if (!currentAction?.is_hero || !feedback) {
    const verb = currentAction
      ? `${currentAction.player} ${currentAction.action}${currentAction.amount ? `s ${currentAction.amount}` : "s"}`
      : "Waiting…";
    return (
      <div className="h-full flex flex-col">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
              <Brain className="h-4 w-4 text-white/30" />
            </div>
            <span className="text-sm font-semibold text-white/40">Opponent</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-sm text-white/30 text-center">{verb}</p>
        </div>
      </div>
    );
  }

  // ── Hero action with feedback ───────────────────────────────────────────
  const r = RATING[feedback.rating];

  return (
    <div
      key={step} // re-mount on step change → re-runs fade-in
      className={cn(
        "h-full flex flex-col animate-fade-in border-l-2 transition-colors duration-300",
        r.border
      )}
      style={{
        background: `linear-gradient(180deg, var(--tw-gradient-from, transparent) 0%, transparent 100%)`,
      }}
    >
      {/* Header */}
      <div className={cn("px-5 py-4 border-b border-white/5 bg-gradient-to-b", r.gradient)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", r.badge)}>
              {r.icon}
            </div>
            <span className="text-sm font-semibold text-white/80">AI Coach</span>
          </div>
          <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", r.badge)}>
            {r.label}
          </span>
        </div>

        {/* Action context */}
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", r.dot)} />
          <span className="text-[11px] text-white/40 uppercase tracking-wide font-medium">
            {currentAction.street} · {currentAction.action}
            {currentAction.amount ? ` ${currentAction.amount}` : ""}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Title */}
        <h3 className="text-base font-bold text-white leading-snug">
          {feedback.title}
        </h3>

        {/* Explanation */}
        <p className="text-sm leading-relaxed text-white/55">
          {feedback.explanation}
        </p>

        {/* GTO note */}
        {feedback.gto_note && (
          <>
            <Divider />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3 text-yellow-400/60" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/25">
                  Solver note
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-white/40 italic">
                {feedback.gto_note}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Meta footer */}
      <Divider />
      <div className="px-5 py-3 space-y-2">
        <MetaRow label="Hero"    value={handSummary.hero_position} />
        <MetaRow label="Pot"     value={`${currentAction.pot_after.toFixed(1)}bb after`} />
      </div>
    </div>
  );
}
