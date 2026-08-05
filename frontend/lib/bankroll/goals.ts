export type GoalType = "bankroll_amount" | "profit_target" | "hours_played" | "hands_played" | "sessions_count";

export const GOAL_TYPE_ORDER: GoalType[] = ["bankroll_amount", "profit_target", "hours_played", "hands_played", "sessions_count"];

export const GOAL_TYPE_META: Record<GoalType, { label: string; unit: string; isMoney: boolean; defaultTitle: (target: number) => string }> = {
  bankroll_amount: { label: "Bankroll goal", unit: "", isMoney: true, defaultTitle: (t) => `Reach a ${t.toLocaleString()} bankroll` },
  profit_target: { label: "Profit goal", unit: "", isMoney: true, defaultTitle: (t) => `Earn ${t.toLocaleString()} in profit` },
  hours_played: { label: "Hours goal", unit: "hrs", isMoney: false, defaultTitle: (t) => `Play ${t.toLocaleString()} hours` },
  hands_played: { label: "Hands goal", unit: "hands", isMoney: false, defaultTitle: (t) => `Play ${t.toLocaleString()} hands` },
  sessions_count: { label: "Sessions goal", unit: "sessions", isMoney: false, defaultTitle: (t) => `Log ${t.toLocaleString()} sessions` },
};

export interface GoalProgressInput {
  goalType: GoalType;
  targetValue: number;
  currentBankroll: number;
  startingBankroll: number;
  totalSessionProfit: number;
  totalHours: number;
  totalHands: number;
  sessionCount: number;
  /** Days since bankroll tracking started (bankroll_settings.starting_at). Always >= 1. */
  daysElapsed: number;
}

export interface GoalProgress {
  currentValue: number;
  /** Uncapped — can exceed 100 once the goal is passed. */
  percentage: number;
  achieved: boolean;
  /** null when achieved (no ETA needed) or when the player isn't on pace (rate <= 0). */
  estimatedDate: Date | null;
}

function currentValueFor(input: GoalProgressInput): number {
  switch (input.goalType) {
    case "bankroll_amount": return input.currentBankroll;
    case "profit_target": return input.totalSessionProfit;
    case "hours_played": return input.totalHours;
    case "hands_played": return input.totalHands;
    case "sessions_count": return input.sessionCount;
  }
}

/**
 * Average pace since tracking started, used only for the ETA projection.
 * bankroll_amount is the one type where "current" (a running total that
 * already includes the starting balance) and "rate" (how fast it's
 * actually growing) must use different bases — growth is
 * current_bankroll - starting_bankroll, not current_bankroll itself, or a
 * player who started with $5,000 and hasn't played a single session would
 * show a nonsensical pace. Every other type is a from-zero counter, so its
 * rate is just current / daysElapsed.
 */
function rateFor(input: GoalProgressInput): number {
  switch (input.goalType) {
    case "bankroll_amount": return (input.currentBankroll - input.startingBankroll) / input.daysElapsed;
    default: return currentValueFor(input) / input.daysElapsed;
  }
}

/**
 * Progress + a pace-based ETA for one goal. The ETA is a simple average-
 * pace projection ("at your average rate since you started tracking, you'll
 * get there around DATE") — not a poker-theory concept, just arithmetic —
 * and returns null rather than a date when the player isn't gaining ground
 * (rate <= 0), instead of showing a misleading date far in the past/never.
 */
export function computeGoalProgress(input: GoalProgressInput, today: Date = new Date()): GoalProgress {
  const currentValue = currentValueFor(input);
  const percentage = input.targetValue > 0 ? (currentValue / input.targetValue) * 100 : 0;
  const achieved = input.targetValue > 0 && currentValue >= input.targetValue;

  if (achieved) {
    return { currentValue, percentage, achieved: true, estimatedDate: null };
  }

  const rate = rateFor(input);
  if (rate <= 0) {
    return { currentValue, percentage, achieved: false, estimatedDate: null };
  }

  const remaining = input.targetValue - currentValue;
  const daysNeeded = Math.ceil(remaining / rate);
  const estimatedDate = new Date(today);
  estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);

  return { currentValue, percentage, achieved: false, estimatedDate };
}
