"use client";

/**
 * DrillSessionSummary — end-of-session results screen.
 *
 * Shows: accuracy %, streak, XP earned, weak areas, and CTA to continue.
 * Celebratory for good performance, constructive for poor performance.
 */

import { cn } from "@/lib/utils";
import type { DrillResult } from "@/lib/coaching/types";

interface DrillSessionSummaryProps {
  results: DrillResult[];
  onContinue: () => void;
  onRetry: () => void;
  xpEarned?: number;
}

export function DrillSessionSummary({
  results,
  onContinue,
  onRetry,
  xpEarned = 0,
}: DrillSessionSummaryProps) {
  const total = results.length;
  const correct = results.filter((r) => r.is_correct).length;
  const acceptable = results.filter((r) => r.is_acceptable && !r.is_correct).length;
  const wrong = total - correct - acceptable;
  const accuracy = total > 0 ? correct / total : 0;
  const avgTime = total > 0
    ? Math.round(results.reduce((sum, r) => sum + r.time_ms, 0) / total / 1000)
    : 0;

  const isGreat = accuracy >= 0.8;
  const isOkay = accuracy >= 0.5;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-10">
      {/* Score ring */}
      <div className="relative w-32 h-32 mb-6">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r="56"
            fill="none" stroke="currentColor" strokeWidth="5"
            className="text-white/5"
          />
          <circle
            cx="64" cy="64" r="56"
            fill="none" strokeWidth="5" strokeLinecap="round"
            className={cn(
              "transition-all duration-1000 ease-out",
              isGreat ? "stroke-emerald-400" : isOkay ? "stroke-blue-400" : "stroke-orange-400",
            )}
            strokeDasharray={2 * Math.PI * 56}
            strokeDashoffset={2 * Math.PI * 56 * (1 - accuracy)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            "text-3xl font-black tabular-nums",
            isGreat ? "text-emerald-400" : isOkay ? "text-blue-400" : "text-orange-400",
          )}>
            {Math.round(accuracy * 100)}%
          </span>
        </div>
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold text-foreground mb-1">
        {isGreat ? "Excellent Session!" : isOkay ? "Solid Practice" : "Keep Working"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        {correct} of {total} correct
        {acceptable > 0 ? ` • ${acceptable} acceptable` : ""}
      </p>

      {/* Stats row */}
      <div className="flex gap-6 mb-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{correct}</div>
          <div className="text-xs text-muted-foreground">Correct</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400 tabular-nums">{acceptable}</div>
          <div className="text-xs text-muted-foreground">Acceptable</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 tabular-nums">{wrong}</div>
          <div className="text-xs text-muted-foreground">Wrong</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground tabular-nums">{avgTime}s</div>
          <div className="text-xs text-muted-foreground">Avg Time</div>
        </div>
      </div>

      {/* XP earned */}
      {xpEarned > 0 && (
        <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20">
          <span className="text-violet-400 text-sm font-bold">+{xpEarned} XP</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className={cn(
            "flex-1 py-3 rounded-xl font-medium text-sm",
            "border border-border bg-card hover:bg-white/5 text-foreground",
            "transition-all active:scale-[0.98]",
          )}
        >
          Retry
        </button>
        <button
          onClick={onContinue}
          className={cn(
            "flex-1 py-3 rounded-xl font-medium text-sm",
            "bg-violet-600 hover:bg-violet-500 text-white",
            "transition-all active:scale-[0.98]",
          )}
        >
          Next Set
        </button>
      </div>
    </div>
  );
}
