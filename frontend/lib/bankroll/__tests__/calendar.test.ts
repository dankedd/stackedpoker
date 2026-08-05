import { describe, expect, it } from "vitest";
import { dateKeyOf, buildCalendarDayMap, dayStatus, buildMonthGrid, type CalendarSession } from "../calendar";

function session(overrides: Partial<CalendarSession>): CalendarSession {
  return {
    id: "s1",
    started_at: "2026-01-15T14:00:00",
    buy_in_amount: 0,
    cash_out_amount: 0,
    duration_minutes: 60,
    site: null,
    variant: null,
    stakes: null,
    notes: null,
    ...overrides,
  };
}

describe("dateKeyOf", () => {
  it("formats using local Y-M-D, zero-padded", () => {
    expect(dateKeyOf(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKeyOf(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("buildCalendarDayMap", () => {
  it("sums profit and hours for multiple sessions on the same day", () => {
    const map = buildCalendarDayMap([
      session({ id: "a", started_at: "2026-01-15T09:00:00", cash_out_amount: 100, duration_minutes: 60 }),
      session({ id: "b", started_at: "2026-01-15T20:00:00", cash_out_amount: -30, duration_minutes: 90 }),
    ]);
    const day = map.get("2026-01-15")!;
    expect(day.profit).toBe(70);
    expect(day.hours).toBe(2.5);
    expect(day.sessions).toHaveLength(2);
  });

  it("keeps separate days separate", () => {
    const map = buildCalendarDayMap([
      session({ id: "a", started_at: "2026-01-15T09:00:00", cash_out_amount: 50 }),
      session({ id: "b", started_at: "2026-01-16T09:00:00", cash_out_amount: 20 }),
    ]);
    expect(map.size).toBe(2);
    expect(map.get("2026-01-15")!.profit).toBe(50);
    expect(map.get("2026-01-16")!.profit).toBe(20);
  });

  it("excludes unsettled sessions", () => {
    const map = buildCalendarDayMap([session({ cash_out_amount: null })]);
    expect(map.size).toBe(0);
  });
});

describe("dayStatus", () => {
  it("returns 'none' for a missing or empty day", () => {
    expect(dayStatus(undefined)).toBe("none");
  });

  it("returns 'win' for non-negative profit, 'loss' for negative", () => {
    expect(dayStatus({ dateKey: "x", profit: 0, hours: 0, sessions: [session({})] })).toBe("win");
    expect(dayStatus({ dateKey: "x", profit: 50, hours: 0, sessions: [session({})] })).toBe("win");
    expect(dayStatus({ dateKey: "x", profit: -1, hours: 0, sessions: [session({})] })).toBe("loss");
  });
});

describe("buildMonthGrid", () => {
  it("always produces a 42-cell (6-week) grid", () => {
    expect(buildMonthGrid(2026, 0)).toHaveLength(42);
    expect(buildMonthGrid(2026, 1)).toHaveLength(42); // Feb, shortest month
  });

  it("pads with the correct leading days from the previous month", () => {
    // January 1, 2024 is a Monday -> grid starts Sunday Dec 31, 2023.
    const grid = buildMonthGrid(2024, 0);
    expect(grid[0].dateKey).toBe("2023-12-31");
    expect(grid[0].inMonth).toBe(false);
    expect(grid[1].dateKey).toBe("2024-01-01");
    expect(grid[1].inMonth).toBe(true);
  });

  it("marks every day of the target month as inMonth", () => {
    const grid = buildMonthGrid(2026, 1); // Feb 2026, 28 days
    const inMonthDays = grid.filter((c) => c.inMonth);
    expect(inMonthDays).toHaveLength(28);
    expect(inMonthDays[0].dateKey).toBe("2026-02-01");
    expect(inMonthDays[27].dateKey).toBe("2026-02-28");
  });
});
