"use client";

import { cn } from "@/lib/utils";
import { Brain, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReplayFeedback, ReplayAction } from "@/lib/types";

interface CoachPanelProps {
  feedback: ReplayFeedback | null;
  currentAction: ReplayAction | null;
  step: number;
}

const RATING_CONFIG = {
  good: {
    border: "border-poker-green/30",
    bg: "bg-poker-green/5",
    badge: "bg-poker-green/20 text-poker-green border-poker-green/30",
    icon: <CheckCircle2 className="h-4 w-4 text-poker-green" />,
    label: "Good Play",
    glow: "shadow-[0_0_20px_rgba(0,200,83,0.1)]",
  },
  okay: {
    border: "border-yellow-400/30",
    bg: "bg-yellow-400/5",
    badge: "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
    icon: <MinusCircle className="h-4 w-4 text-yellow-400" />,
    label: "Suboptimal",
    glow: "",
  },
  mistake: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    label: "Mistake",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",
  },
};

export function CoachPanel({ feedback, currentAction, step }: CoachPanelProps) {
  // Empty state before first action
  if (step < 0) {
    return (
      <Card className="border-border/40 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-poker-green/20">
              <Brain className="h-4 w-4 text-poker-green" />
            </div>
            AI Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Press <span className="font-semibold text-foreground">Next</span> or{" "}
            <span className="font-semibold text-foreground">Play</span> to start the replay.
            <br />
            <span className="opacity-60">Coaching appears on each hero action.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Villain action — no feedback
  if (!feedback || !currentAction?.is_hero) {
    const verb = currentAction ? `${currentAction.player} ${currentAction.action}${currentAction.amount ? `s ${currentAction.amount}` : "s"}` : "Villain acts";
    return (
      <Card className="border-border/40 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            Opponent Action
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center">{verb}</p>
        </CardContent>
      </Card>
    );
  }

  const cfg = RATING_CONFIG[feedback.rating];

  return (
    <Card className={cn("border h-full flex flex-col transition-all duration-300", cfg.border, cfg.bg, cfg.glow)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", cfg.badge)}>
              {cfg.icon}
            </div>
            AI Coach
          </div>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", cfg.badge)}>
            {cfg.label}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pt-0 animate-fade-in">
        {/* Title */}
        <p className="text-sm font-semibold text-foreground leading-snug">
          {feedback.title}
        </p>

        {/* Explanation */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {feedback.explanation}
        </p>

        {/* GTO note */}
        {feedback.gto_note && (
          <div className="rounded-md bg-secondary/60 px-3 py-2 border border-border/40">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground/70">Solver: </span>
              {feedback.gto_note}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
