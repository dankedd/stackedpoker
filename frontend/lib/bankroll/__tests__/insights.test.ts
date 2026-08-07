import { describe, expect, it } from "vitest";
import {
  computeStakeInsights, computeDurationInsight, computeTimeOfDayBreakdown, bestAndWorstTimeOfDay,
  computeVolumeInsight, computeRoi, computeBankrollGrowth, generateInsightTips,
  type InsightsBundle,
} from "../insights";
import type { SessionForStats } from "../stats";

function session(overrides: Partial<SessionForStats>): SessionForStats {
  return {
    session_type: "cash",
    started_at: "2026-01-15T14:00:00",
    buy_in_amount: 0,
    cash_out_amount: 0,
    hands_played: null,
    duration_minutes: 60,
    site: null,
    stakes: null,
    variant: null,
    fee_amount: null,
    prize_amount: null,
    finishing_position: null,
    ...overrides,
  };
}

describe("computeStakeInsights", () => {
  it("picks the highest and lowest average-profit stake, requiring a minimum sample", () => {
    const sessions = [
      ...Array.from({ length: 4 }, () => session({ stakes: "$1/$2", cash_out_amount: 50 })), // avg +50
      ...Array.from({ length: 4 }, () => session({ stakes: "$2/$5", cash_out_amount: -20 })), // avg -20
      session({ stakes: "$5/$10", cash_out_amount: 500 }), // only 1 session, excluded
    ];
    const { best, worst } = computeStakeInsights(sessions);
    expect(best).toEqual({ label: "$1/$2", avgProfit: 50, sessionCount: 4 });
    expect(worst).toEqual({ label: "$2/$5", avgProfit: -20, sessionCount: 4 });
  });

  it("returns null for both when only one stake has enough samples", () => {
    const sessions = Array.from({ length: 4 }, () => session({ stakes: "$1/$2", cash_out_amount: 10 }));
    const { best, worst } = computeStakeInsights(sessions);
    expect(best?.label).toBe("$1/$2");
    expect(worst).toBeNull();
  });

  it("returns nulls when nothing meets the minimum sample size", () => {
    expect(computeStakeInsights([session({ stakes: "$1/$2" })])).toEqual({ best: null, worst: null });
  });
});

describe("computeDurationInsight", () => {
  it("finds the duration bucket with the best $/hour", () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => session({ duration_minutes: 30, cash_out_amount: 60 })),  // Under 1h: 60/0.5h = 120/h
      ...Array.from({ length: 3 }, () => session({ duration_minutes: 180, cash_out_amount: 30 })),  // 2-3h: 30/3h = 10/h
    ];
    const { best } = computeDurationInsight(sessions);
    expect(best?.label).toBe("Under 1h");
    expect(best?.avgProfitPerHour).toBe(120);
  });

  it("returns null when no bucket has enough samples", () => {
    expect(computeDurationInsight([session({})]).best).toBeNull();
  });
});

describe("computeTimeOfDayBreakdown / bestAndWorstTimeOfDay", () => {
  it("buckets sessions by hour into the 4 periods, chronologically ordered", () => {
    const sessions = [
      session({ started_at: "2026-01-01T03:00:00", cash_out_amount: 10 }), // Night
      session({ started_at: "2026-01-01T20:00:00", cash_out_amount: 10 }), // Evening
      session({ started_at: "2026-01-01T08:00:00", cash_out_amount: 10 }), // Morning
    ];
    const breakdown = computeTimeOfDayBreakdown(sessions);
    expect(breakdown.map((b) => b.label)).toEqual([
      "Night (12am-6am)", "Morning (6am-12pm)", "Evening (6pm-12am)",
    ]);
  });

  it("identifies best and worst only among buckets meeting the minimum sample", () => {
    const breakdown = [
      { label: "Morning (6am-12pm)", avgProfit: 50, sessionCount: 5, winRate: 80 },
      { label: "Evening (6pm-12am)", avgProfit: -20, sessionCount: 5, winRate: 20 },
      { label: "Night (12am-6am)", avgProfit: 1000, sessionCount: 1, winRate: 100 }, // too few samples
    ];
    const { best, worst } = bestAndWorstTimeOfDay(breakdown);
    expect(best?.label).toBe("Morning (6am-12pm)");
    expect(worst?.label).toBe("Evening (6pm-12am)");
  });
});

describe("computeVolumeInsight", () => {
  it("sums settled sessions, hours and hands", () => {
    const sessions = [
      session({ cash_out_amount: 10, duration_minutes: 60, hands_played: 100 }),
      session({ cash_out_amount: 10, duration_minutes: 30, hands_played: 50 }),
      session({ cash_out_amount: null }), // unsettled, excluded
    ];
    expect(computeVolumeInsight(sessions)).toEqual({ sessionCount: 2, totalHours: 1.5, totalHands: 150 });
  });
});

describe("computeRoi", () => {
  it("computes profit relative to deposits", () => {
    expect(computeRoi(500, 1000)).toBe(50);
  });
  it("returns null with no deposits", () => {
    expect(computeRoi(500, 0)).toBeNull();
  });
});

describe("computeBankrollGrowth", () => {
  it("computes growth amount, percent and per-day rate", () => {
    const result = computeBankrollGrowth(1500, 1000, 50);
    expect(result.growthAmount).toBe(500);
    expect(result.growthPercent).toBe(50);
    expect(result.perDay).toBe(10);
  });
  it("returns null growthPercent when starting bankroll is 0", () => {
    expect(computeBankrollGrowth(500, 0, 10).growthPercent).toBeNull();
  });
});

describe("generateInsightTips", () => {
  const fullBundle: InsightsBundle = {
    stakes: { best: { label: "$1/$2", avgProfit: 50, sessionCount: 5 }, worst: { label: "$2/$5", avgProfit: -20, sessionCount: 5 } },
    duration: { best: { label: "Under 1h", avgProfit: 40, avgProfitPerHour: 80, sessionCount: 5 } },
    timeOfDay: { best: { label: "Morning (6am-12pm)", avgProfit: 30, sessionCount: 5, winRate: 70 }, worst: { label: "Evening (6pm-12am)", avgProfit: -10, sessionCount: 5, winRate: 30 } },
    volume: { sessionCount: 20, totalHours: 40, totalHands: 4000 },
    roi: 12.5,
    growth: { growthAmount: 500, growthPercent: 25, perDay: 10 },
    currency: "USD",
  };

  it("produces one tip per available insight, with bold figures embedded", () => {
    const tips = generateInsightTips(fullBundle);
    expect(tips.map((t) => t.id)).toEqual(["stake-comparison", "duration", "time-of-day", "roi", "growth"]);
    expect(tips.find((t) => t.id === "stake-comparison")?.text).toContain("**$1/$2**");
  });

  it("adds a 'not enough data' tip when session volume is below the reliability threshold", () => {
    const tips = generateInsightTips({ ...fullBundle, volume: { sessionCount: 1, totalHours: 1, totalHands: 100 } });
    expect(tips[0].id).toBe("not-enough-data");
  });

  it("omits tips whose underlying insight is unavailable", () => {
    const tips = generateInsightTips({ ...fullBundle, stakes: { best: null, worst: null }, roi: null });
    expect(tips.map((t) => t.id)).not.toContain("stake-comparison");
    expect(tips.map((t) => t.id)).not.toContain("roi");
  });
});
