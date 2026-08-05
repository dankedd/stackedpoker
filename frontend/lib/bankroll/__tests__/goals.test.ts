import { describe, expect, it } from "vitest";
import { computeGoalProgress, type GoalProgressInput } from "../goals";

const base: GoalProgressInput = {
  goalType: "profit_target",
  targetValue: 1000,
  currentBankroll: 5000,
  startingBankroll: 4000,
  totalSessionProfit: 500,
  totalHours: 50,
  totalHands: 2000,
  sessionCount: 10,
  daysElapsed: 50,
};

describe("computeGoalProgress", () => {
  it("computes percentage and a pace-based ETA for profit_target", () => {
    // rate = 500 / 50 days = 10/day; remaining = 500; needs 50 more days
    const result = computeGoalProgress(base, new Date("2026-01-01"));
    expect(result.currentValue).toBe(500);
    expect(result.percentage).toBe(50);
    expect(result.achieved).toBe(false);
    expect(result.estimatedDate).toEqual(new Date("2026-02-20"));
  });

  it("marks a goal achieved once current reaches the target, with no ETA needed", () => {
    const result = computeGoalProgress({ ...base, totalSessionProfit: 1200 });
    expect(result.achieved).toBe(true);
    expect(result.percentage).toBe(120);
    expect(result.estimatedDate).toBeNull();
  });

  it("returns no ETA when the player isn't on pace (zero progress)", () => {
    const result = computeGoalProgress({ ...base, totalSessionProfit: 0 });
    expect(result.achieved).toBe(false);
    expect(result.estimatedDate).toBeNull();
  });

  it("returns no ETA when pace is negative (losing, not gaining)", () => {
    const result = computeGoalProgress({ ...base, goalType: "bankroll_amount", targetValue: 10000, currentBankroll: 3000, startingBankroll: 4000 });
    expect(result.estimatedDate).toBeNull();
  });

  it("uses bankroll growth (current - starting), not raw current_bankroll, as the pace basis", () => {
    // starting 4000, now 5000 over 50 days -> growth rate 20/day. Target 6000 -> remaining 1000 -> 50 days.
    const result = computeGoalProgress({ ...base, goalType: "bankroll_amount", targetValue: 6000 }, new Date("2026-01-01"));
    expect(result.currentValue).toBe(5000); // displayed "current" is the raw bankroll, not growth
    expect(result.estimatedDate).toEqual(new Date("2026-02-20"));
  });

  it("computes hours/hands/sessions goals directly from their totals", () => {
    expect(computeGoalProgress({ ...base, goalType: "hours_played", targetValue: 100 }).currentValue).toBe(50);
    expect(computeGoalProgress({ ...base, goalType: "hands_played", targetValue: 4000 }).currentValue).toBe(2000);
    expect(computeGoalProgress({ ...base, goalType: "sessions_count", targetValue: 20 }).currentValue).toBe(10);
  });
});
