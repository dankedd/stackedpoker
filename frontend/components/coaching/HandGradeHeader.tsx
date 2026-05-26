"use client";

/**
 * HandGradeHeader — hero banner showing overall hand grade.
 *
 * Appears at the top of hand review. Shows letter grade, score ring,
 * mistake count, and total EV loss in an engaging visual.
 */

import { cn } from "@/lib/utils";
import { type HandScore, gradeColor } from "@/lib/coaching/types";

interface HandGradeHeaderProps {
  handScore: HandScore;
}

const GRADE_MESSAGES: Record<string, string> = {
  "A+": "Flawless execution",
  A: "Excellent play",
  "B+": "Strong decisions",
  B: "Solid overall",
  "C+": "Room for improvement",
  C: "Several inaccuracies",
  D: "Significant mistakes",
  F: "Major errors detected",
};

export function HandGradeHeader({ handScore }: HandGradeHeaderProps) {
  const circumference = 2 * Math.PI * 42;
  const progress = handScore.overall_score / 100;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 overflow-hidden">
      {/* Background glow */}
      <div
        className={cn(
          "absolute inset-0 opacity-10",
          handScore.overall_score >= 75 && "bg-gradient-to-br from-emerald-500/20 to-transparent",
          handScore.overall_score >= 50 && handScore.overall_score < 75 && "bg-gradient-to-br from-blue-500/20 to-transparent",
          handScore.overall_score < 50 && "bg-gradient-to-br from-orange-500/20 to-transparent",
        )}
      />

      <div className="relative flex items-center gap-6">
        {/* Score ring */}
        <div className="flex-shrink-0 relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48" cy="48" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-white/5"
            />
            <circle
              cx="48" cy="48" r="42"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className={cn(
                "transition-all duration-1000 ease-out",
                handScore.overall_score >= 75 ? "stroke-emerald-400" :
                handScore.overall_score >= 50 ? "stroke-blue-400" :
                handScore.overall_score >= 25 ? "stroke-orange-400" :
                "stroke-red-400",
              )}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-black", gradeColor(handScore.grade))}>
              {handScore.grade}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {handScore.overall_score}/100
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {handScore.grade_label}
          </h3>
          <p className="text-sm text-muted-foreground">
            {GRADE_MESSAGES[handScore.grade] ?? "Hand reviewed"}
          </p>

          <div className="flex gap-4 pt-1">
            <div>
              <span className="text-xs text-muted-foreground block">Mistakes</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                handScore.mistakes_count === 0 ? "text-emerald-400" : "text-orange-400",
              )}>
                {handScore.mistakes_count}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">EV Lost</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                handScore.total_ev_loss_bb < 0.5 ? "text-emerald-400" : "text-red-400",
              )}>
                {handScore.total_ev_loss_bb.toFixed(1)}bb
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Actions</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {handScore.actions.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
