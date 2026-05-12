"use client";

import { cn } from "@/lib/utils";
import type { UsageData } from "@/hooks/useUsage";

interface Props {
  usage: UsageData;
  className?: string;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  admin: "Admin",
};

const PLAN_COLOR: Record<string, string> = {
  free: "text-muted-foreground border-border/50",
  pro: "text-blue-400 border-blue-500/40",
  admin: "text-violet-400 border-violet-500/40",
};

export function UsageWidget({ usage, className }: Props) {
  const { plan, used, limit, remaining, isUnlimited } = usage;

  const planLabel = PLAN_LABEL[plan] ?? plan;
  const planColor = PLAN_COLOR[plan] ?? PLAN_COLOR.free;
  const pct = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = !isUnlimited && remaining <= 1;

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {/* Plan badge */}
      <span className={cn("px-2 py-0.5 rounded border font-medium tracking-wide uppercase text-[10px]", planColor)}>
        {planLabel}
      </span>

      {isUnlimited ? (
        <span className="text-muted-foreground">Unlimited analyses</span>
      ) : (
        <div className="flex items-center gap-2">
          {/* Mini progress bar */}
          <div className="h-1.5 w-16 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isNearLimit ? "bg-amber-500" : "bg-violet-500/80"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <span className={cn("tabular-nums", isNearLimit ? "text-amber-400" : "text-muted-foreground")}>
            {remaining === 0
              ? "No analyses left"
              : remaining === 1
              ? "1 analysis left"
              : `${remaining} analyses left`}
          </span>
        </div>
      )}
    </div>
  );
}
