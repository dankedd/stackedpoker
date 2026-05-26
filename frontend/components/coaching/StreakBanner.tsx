"use client";

/**
 * StreakBanner — displays current training streak with fire animation.
 *
 * Compact horizontal banner for dashboard and drill screens.
 * Streak of 0 shows encouragement. Active streak shows fire + count.
 */

import { cn } from "@/lib/utils";

interface StreakBannerProps {
  streakDays: number;
  className?: string;
}

export function StreakBanner({ streakDays, className }: StreakBannerProps) {
  const isActive = streakDays > 0;
  const isBig = streakDays >= 7;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
        isActive
          ? "border-orange-500/20 bg-orange-500/5"
          : "border-border bg-card",
        isBig && "border-orange-400/30 bg-gradient-to-r from-orange-500/10 to-red-500/10",
        className,
      )}
    >
      <span className={cn("text-lg", isActive && "animate-pulse")}>
        {isActive ? "🔥" : "💤"}
      </span>
      <div>
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isActive ? "text-orange-400" : "text-muted-foreground",
          )}
        >
          {streakDays} day{streakDays !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-muted-foreground ml-1.5">
          {isActive ? "streak" : "— start training!"}
        </span>
      </div>
    </div>
  );
}
