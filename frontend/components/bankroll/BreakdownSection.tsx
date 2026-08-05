"use client";

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { BREAKDOWN_DIMENSIONS, type BankrollDimensionBreakdowns } from "@/lib/bankroll/stats";

interface BreakdownSectionProps {
  breakdowns: BankrollDimensionBreakdowns;
  currency: string;
}

export function BreakdownSection({ breakdowns, currency }: BreakdownSectionProps) {
  const [active, setActive] = useState(BREAKDOWN_DIMENSIONS[0].key);
  const groups = breakdowns[active];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 card-lift">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h2 className="text-sm font-semibold text-foreground">Results per</h2>
        <div className="flex items-center flex-wrap rounded-full border border-border/50 bg-background/40 p-0.5 gap-0.5">
          {BREAKDOWN_DIMENSIONS.map((dim) => (
            <button
              key={dim.key}
              type="button"
              onClick={() => setActive(dim.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all duration-150",
                active === dim.key
                  ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-sm shadow-violet-900/40"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {dim.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 py-8 text-center">No settled sessions yet for this breakdown.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const positive = group.profit >= 0;
            return (
              <div
                key={group.label}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border/30 bg-background/30 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground sm:w-40 shrink-0 truncate">{group.label}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground/60 flex-1">
                  <span className={cn("font-bold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
                    {positive ? "+" : ""}{formatCurrency(group.profit, currency)}
                  </span>
                  <span>{group.sessionCount} session{group.sessionCount !== 1 ? "s" : ""}</span>
                  <span>{group.hours.toFixed(1)}h</span>
                  <span>{group.hands.toLocaleString()} hands</span>
                  <span>{Math.round(group.winRate)}% win rate</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
