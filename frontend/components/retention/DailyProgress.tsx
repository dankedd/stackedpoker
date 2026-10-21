"use client";

import { useEffect, useRef } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { noteActivity, useStreak, type Streak } from "@/hooks/useStreak";
import { DAILY, STREAK } from "@/lib/lifecycle/strings";
import { cn } from "@/lib/utils";

/** "🔥 3-day streak" plus the line under it. Day 1 (streak 0–1) asks the user to come back tomorrow. */
export function StreakLine({ streak, className }: { streak: Streak; className?: string }) {
  const hint =
    streak.streak === 0 ? STREAK.startNone : streak.streak === 1 ? STREAK.start : streak.activeToday ? STREAK.doneToday : STREAK.keepToday;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {streak.streak > 0 && <b className="font-semibold text-orange-300">{STREAK.badge(streak.streak)}</b>}
      <span className="text-muted-foreground">{hint}</span>
    </span>
  );
}

/**
 * Trainer header and dashboard strip: the day streak and "Today: 12/50
 * spots done" (Free) or "Today: 12 spots done" (Pro/trial). Signed-in only;
 * renders nothing until both numbers are known.
 */
export function DailyProgress({ className }: { className?: string }) {
  const streak = useStreak();
  const { entitlements } = useEntitlements();
  const used = entitlements?.usage.trainerHandsToday ?? null;

  // A hand was just played: the first one of the day extends the streak.
  const lastUsed = useRef<number | null>(null);
  useEffect(() => {
    if (used !== null && lastUsed.current !== null && used > lastUsed.current) noteActivity();
    lastUsed.current = used;
  }, [used]);

  if (!streak || !entitlements) return null;
  return (
    <div
      data-tour="daily-progress"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-orange-400/20 bg-orange-400/[0.05] px-3.5 py-2 text-sm",
        className,
      )}
    >
      <StreakLine streak={streak} />
      <span className="font-medium tabular-nums text-foreground">{DAILY.today(used ?? 0, entitlements.limits.trainerHandsPerDay)}</span>
    </div>
  );
}
