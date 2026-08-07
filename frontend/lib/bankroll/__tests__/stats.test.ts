import { describe, expect, it } from "vitest";
import { computeStreaks, computeBiggestWinLoss, computeWinRate, groupSessionsBy, computeTournamentStats, type SessionForStats } from "../stats";

function session(overrides: Partial<SessionForStats>): SessionForStats {
  return {
    session_type: "cash",
    started_at: "2026-01-01T12:00:00Z",
    buy_in_amount: 0,
    cash_out_amount: 0,
    hands_played: null,
    duration_minutes: null,
    site: null,
    stakes: null,
    variant: null,
    fee_amount: null,
    prize_amount: null,
    finishing_position: null,
    ...overrides,
  };
}

function tournament(overrides: Partial<SessionForStats>): SessionForStats {
  return session({ session_type: "tournament", ...overrides });
}

describe("computeStreaks", () => {
  it("finds the longest win and loss streaks in chronological order, regardless of input order", () => {
    const sessions = [
      session({ started_at: "2026-01-05", cash_out_amount: -10 }), // loss
      session({ started_at: "2026-01-01", cash_out_amount: 50 }),  // win (1)
      session({ started_at: "2026-01-02", cash_out_amount: 20 }),  // win (2)
      session({ started_at: "2026-01-03", cash_out_amount: 10 }),  // win (3)
      session({ started_at: "2026-01-04", cash_out_amount: -5 }),  // loss (1)
      session({ started_at: "2026-01-06", cash_out_amount: -15 }), // loss (2)
      session({ started_at: "2026-01-07", cash_out_amount: 5 }),   // win (1)
    ];
    expect(computeStreaks(sessions)).toEqual({ longestWinStreak: 3, longestLossStreak: 3 });
  });

  it("treats a push (result === 0) as a win, breaking a loss streak", () => {
    const sessions = [
      session({ started_at: "2026-01-01", cash_out_amount: -10 }),
      session({ started_at: "2026-01-02", cash_out_amount: 0 }),
      session({ started_at: "2026-01-03", cash_out_amount: -10 }),
    ];
    expect(computeStreaks(sessions)).toEqual({ longestWinStreak: 1, longestLossStreak: 1 });
  });

  it("ignores unsettled (in-progress) sessions", () => {
    const sessions = [
      session({ started_at: "2026-01-01", cash_out_amount: 50 }),
      session({ started_at: "2026-01-02", cash_out_amount: null }),
      session({ started_at: "2026-01-03", cash_out_amount: 50 }),
    ];
    expect(computeStreaks(sessions).longestWinStreak).toBe(2);
  });

  it("returns zeros for no settled sessions", () => {
    expect(computeStreaks([])).toEqual({ longestWinStreak: 0, longestLossStreak: 0 });
  });
});

describe("computeBiggestWinLoss", () => {
  it("finds the max and min result", () => {
    const sessions = [
      session({ cash_out_amount: 200, buy_in_amount: 100 }), // +100
      session({ cash_out_amount: 0, buy_in_amount: 300 }),   // -300
      session({ cash_out_amount: 50, buy_in_amount: 50 }),   // 0
    ];
    expect(computeBiggestWinLoss(sessions)).toEqual({ biggestWin: 100, biggestLoss: -300 });
  });

  it("returns nulls when there are no settled sessions", () => {
    expect(computeBiggestWinLoss([session({ cash_out_amount: null })])).toEqual({ biggestWin: null, biggestLoss: null });
  });
});

describe("computeWinRate", () => {
  it("computes the % of non-negative-result sessions", () => {
    const sessions = [
      session({ cash_out_amount: 10 }),
      session({ cash_out_amount: -10 }),
      session({ cash_out_amount: 0 }),
      session({ cash_out_amount: -5 }),
    ];
    expect(computeWinRate(sessions)).toBe(50);
  });

  it("returns null with no settled sessions", () => {
    expect(computeWinRate([])).toBeNull();
  });
});

describe("groupSessionsBy", () => {
  const sessions = [
    session({ started_at: "2026-01-05", site: "PokerStars", stakes: "$1/$2", variant: "NLHE", cash_out_amount: 100, hands_played: 200, duration_minutes: 60 }),
    session({ started_at: "2026-02-10", site: "PokerStars", stakes: "$2/$5", variant: "PLO", cash_out_amount: -40, hands_played: 100, duration_minutes: 30 }),
    session({ started_at: "2025-12-20", site: "GGPoker", stakes: "$1/$2", variant: "NLHE", cash_out_amount: 60, hands_played: 150, duration_minutes: 45 }),
  ];

  it("groups by site and sorts by profit descending", () => {
    const groups = groupSessionsBy(sessions, "site");
    expect(groups.map((g) => g.label)).toEqual(["PokerStars", "GGPoker"]);
    expect(groups[0].profit).toBe(60); // 100 - 40
    expect(groups[0].sessionCount).toBe(2);
    expect(groups[1].profit).toBe(60);
  });

  it("groups by month, most recent first", () => {
    const groups = groupSessionsBy(sessions, "month");
    expect(groups.map((g) => g.label)).toEqual(["Feb 2026", "Jan 2026", "Dec 2025"]);
  });

  it("groups by year, most recent first", () => {
    const groups = groupSessionsBy(sessions, "year");
    expect(groups.map((g) => g.label)).toEqual(["2026", "2025"]);
    expect(groups[0].sessionCount).toBe(2);
  });

  it("falls back to 'Unknown' for missing site/stakes/variant", () => {
    const groups = groupSessionsBy([session({ site: null, cash_out_amount: 10 })], "site");
    expect(groups[0].label).toBe("Unknown");
  });

  it("computes hours, hands and win rate per group", () => {
    const groups = groupSessionsBy(sessions, "site");
    const pokerStars = groups.find((g) => g.label === "PokerStars")!;
    expect(pokerStars.hours).toBe(1.5); // 90 minutes
    expect(pokerStars.hands).toBe(300);
    expect(pokerStars.winRate).toBe(50); // 1 of 2 sessions won
  });
});

describe("computeTournamentStats", () => {
  it("returns an all-null/zero shape when there are no tournament sessions, without crashing", () => {
    expect(computeTournamentStats([session({ cash_out_amount: 50 })])).toEqual({
      tournamentCount: 0, totalBuyIns: 0, avgBuyIn: null, avgFinish: null, itmPercent: null, roi: null, totalPrizes: 0, biggestCash: null,
    });
  });

  it("reports the pure buy-in (excluding fee) for totalBuyIns/avgBuyIn, but includes fee in ROI's cost basis", () => {
    // buy_in_amount stores buy-in+fee (109 = 100+9); pure buy-in is 100.
    const t = tournament({ buy_in_amount: 109, fee_amount: 9, prize_amount: 500, cash_out_amount: 500, finishing_position: 3 });
    const stats = computeTournamentStats([t]);
    expect(stats.tournamentCount).toBe(1);
    expect(stats.totalBuyIns).toBe(100);
    expect(stats.avgBuyIn).toBe(100);
    // profit = cash_out - buy_in = 500 - 109 = 391; roi = 391 / 109 * 100
    expect(stats.roi).toBeCloseTo((391 / 109) * 100, 5);
  });

  it("computes ITM% from prize_amount > 0, average finish from recorded positions, and the biggest cash", () => {
    const stats = computeTournamentStats([
      tournament({ buy_in_amount: 100, prize_amount: 300, cash_out_amount: 300, finishing_position: 5 }),  // ITM
      tournament({ buy_in_amount: 50, prize_amount: 0, cash_out_amount: 0, finishing_position: 80 }),      // not ITM
      tournament({ buy_in_amount: 20, prize_amount: 0, cash_out_amount: 0, finishing_position: null }),    // no finish recorded
    ]);
    expect(stats.itmPercent).toBeCloseTo((1 / 3) * 100, 5);
    expect(stats.avgFinish).toBe((5 + 80) / 2); // only the 2 sessions with a recorded finish
    expect(stats.totalPrizes).toBe(300);
    expect(stats.biggestCash).toBe(300);
  });

  it("ignores unsettled tournaments and non-tournament sessions", () => {
    const stats = computeTournamentStats([
      session({ cash_out_amount: 999 }), // cash, excluded
      tournament({ cash_out_amount: null, buy_in_amount: 100 }), // unsettled, excluded
    ]);
    expect(stats.tournamentCount).toBe(0);
  });
});
