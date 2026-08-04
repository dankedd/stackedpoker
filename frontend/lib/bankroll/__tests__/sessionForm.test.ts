import { describe, expect, it } from "vitest";
import { buildSessionTimestamps, computeSessionResult, splitSessionTimestamps } from "../sessionForm";

describe("buildSessionTimestamps", () => {
  it("builds started_at/ended_at on the same day when end is after start", () => {
    const { startedAt, endedAt, durationMinutes } = buildSessionTimestamps("2026-01-15", "19:00", "23:30");
    expect(new Date(startedAt).toISOString()).toBe(new Date("2026-01-15T19:00").toISOString());
    expect(new Date(endedAt).toISOString()).toBe(new Date("2026-01-15T23:30").toISOString());
    expect(durationMinutes).toBe(270);
  });

  it("rolls ended_at forward a day when the session crosses midnight", () => {
    const { startedAt, endedAt, durationMinutes } = buildSessionTimestamps("2026-01-15", "23:00", "01:30");
    expect(new Date(endedAt).getTime()).toBeGreaterThan(new Date(startedAt).getTime());
    expect(durationMinutes).toBe(150);
  });

  it("produces a zero-length session when begin equals end", () => {
    const { durationMinutes } = buildSessionTimestamps("2026-01-15", "20:00", "20:00");
    expect(durationMinutes).toBe(0);
  });
});

describe("splitSessionTimestamps", () => {
  it("is the inverse of buildSessionTimestamps for a same-day session", () => {
    const built = buildSessionTimestamps("2026-01-15", "19:00", "23:30");
    const split = splitSessionTimestamps(built.startedAt, built.endedAt);
    expect(split).toEqual({ date: "2026-01-15", beginTime: "19:00", endTime: "23:30" });
  });

  it("falls back to the start time when ended_at is null", () => {
    const built = buildSessionTimestamps("2026-01-15", "19:00", "19:00");
    const split = splitSessionTimestamps(built.startedAt, null);
    expect(split.beginTime).toBe("19:00");
    expect(split.endTime).toBe("19:00");
  });
});

describe("computeSessionResult", () => {
  it("returns cash_out minus buy_in", () => {
    expect(computeSessionResult({ buy_in_amount: 0, cash_out_amount: 245 })).toBe(245);
    expect(computeSessionResult({ buy_in_amount: 0, cash_out_amount: -60 })).toBe(-60);
  });

  it("is correct for rows written with a non-zero buy_in (e.g. from another data path)", () => {
    expect(computeSessionResult({ buy_in_amount: 200, cash_out_amount: 350 })).toBe(150);
  });

  it("treats a null cash_out as zero", () => {
    expect(computeSessionResult({ buy_in_amount: 50, cash_out_amount: null })).toBe(-50);
  });
});
