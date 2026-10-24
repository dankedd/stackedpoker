import { describe, expect, it } from "vitest";
import { flopVerdictShares, headlineTrends, MIN_SAMPLE, pct, skillRows, trend, type SkillStats, type Windows } from "../stats";

const w = (all: [number, number], d30: [number, number] = [0, 0], p30: [number, number] = [0, 0]): Windows => ({
  all, d30, p30, d90: [0, 0], p90: [0, 0],
});

const stats: SkillStats = {
  v: 1,
  computed_at: "2026-10-25T10:00:00Z",
  preflop: {
    overall: w([120, 90]),
    opens: w([60, 54], [20, 18], [20, 16]),
    defense: w([40, 24], [20, 15], [20, 9]),
    pushfold: w([12, 10]),
  },
  flop_review: { all: { n: 40, good: 20, ok: 10, questionable: 10 }, windows: { overall: w([40, 30]) } },
  flop_trainer: { overall: w([29, 25]) },
  weakest_texture: { category: "paired", n: 12, ok: 6 },
  trainer: { spots: 200, current_streak: 3, best_streak: 17 },
  day_streak: 5,
};

describe("skill stats", () => {
  it("hides a percentage below the minimum sample", () => {
    expect(pct([MIN_SAMPLE - 1, 20])).toBeNull();
    expect(pct([MIN_SAMPLE, 15])).toBe(50);
    expect(pct(undefined)).toBeNull();
  });

  it("rows per category with sample size and trend", () => {
    const rows = skillRows(stats);
    expect(rows.map((r) => [r.key, r.n, r.pct])).toEqual([
      ["opens", 60, 90],
      ["defense", 40, 60],
      ["pushfold", 12, null],
      ["flop_play", 40, 75],
      ["flop_reading", 29, null],
    ]);
    expect(rows.find((r) => r.key === "defense")!.trend).toBe(30);
    expect(rows.find((r) => r.key === "opens")!.trend).toBe(10);
  });

  it("trend needs both halves to have enough decisions", () => {
    expect(trend(w([40, 20], [14, 10], [20, 10]), 30)).toBeNull();
  });

  it("headline picks the biggest moves", () => {
    expect(headlineTrends(skillRows(stats)).map((r) => r.key)).toEqual(["defense", "opens"]);
  });

  it("flop verdict shares", () => {
    expect(flopVerdictShares(stats)).toEqual({ n: 40, good: 50, ok: 25, questionable: 25 });
    expect(flopVerdictShares({ ...stats, flop_review: { all: { n: 5, good: 5, ok: 0, questionable: 0 } } }).good).toBeNull();
  });
});
