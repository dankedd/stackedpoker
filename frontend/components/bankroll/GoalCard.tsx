"use client";

import { Wallet, TrendingUp, Clock, Hash, Layers, Trash2, X, Sparkles, CalendarClock, type LucideIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { GOAL_TYPE_META, computeGoalProgress, type GoalType, type GoalProgressInput } from "@/lib/bankroll/goals";
import { DeleteConfirmFooter } from "@/components/bankroll/DeleteConfirmFooter";
import type { BankrollGoalRow } from "@/lib/bankroll/types";

const TYPE_ICONS: Record<GoalType, LucideIcon> = {
  bankroll_amount: Wallet,
  profit_target: TrendingUp,
  hours_played: Clock,
  hands_played: Hash,
  sessions_count: Layers,
};

function formatValue(value: number, isMoney: boolean, unit: string, currency: string | null): string {
  if (isMoney) return formatCurrency(value, currency ?? "USD");
  const rounded = unit === "hrs" ? value.toFixed(1) : Math.round(value).toLocaleString();
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

function formatEta(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface GoalCardProps {
  goal: BankrollGoalRow;
  progressInput: Omit<GoalProgressInput, "goalType" | "targetValue">;
  confirmingDelete: boolean;
  onDelete: () => void;
  onCancelDelete: () => void;
}

export function GoalCard({ goal, progressInput, confirmingDelete, onDelete, onCancelDelete }: GoalCardProps) {
  const goalType = goal.goal_type as GoalType;
  const meta = GOAL_TYPE_META[goalType];
  const Icon = TYPE_ICONS[goalType] ?? Wallet;

  const progress = computeGoalProgress({ ...progressInput, goalType, targetValue: goal.target_value });
  const barWidth = Math.min(100, Math.max(0, progress.percentage));

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 p-5 card-lift transition-colors",
        confirmingDelete ? "border-red-500/40 bg-red-500/5" : progress.achieved ? "border-emerald-500/30" : "border-border/50 hover:border-violet-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/12 border border-violet-500/25 shrink-0">
            <Icon className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{goal.title}</p>
            <p className="text-[11px] text-muted-foreground/50">{meta.label}</p>
          </div>
        </div>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancelDelete}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-all shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-xs text-muted-foreground/60 truncate">
          {formatValue(progress.currentValue, meta.isMoney, meta.unit, goal.currency)} of {formatValue(goal.target_value, meta.isMoney, meta.unit, goal.currency)}
        </span>
        <span className={cn("text-xs font-bold tabular-nums shrink-0", progress.achieved ? "text-emerald-400" : "text-violet-300")}>
          {Math.round(progress.percentage)}%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progress.achieved ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-violet-500 to-blue-400"
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {progress.achieved ? (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
          <Sparkles className="h-3 w-3" />
          Goal reached!
        </p>
      ) : progress.estimatedDate ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
          <CalendarClock className="h-3 w-3" />
          Estimated: {formatEta(progress.estimatedDate)} <span className="text-muted-foreground/30">(at your average pace)</span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
          <CalendarClock className="h-3 w-3" />
          Not on pace yet — log more sessions to get an estimate
        </p>
      )}

      {confirmingDelete && <DeleteConfirmFooter itemLabel="goal" onConfirm={onDelete} />}
    </div>
  );
}
