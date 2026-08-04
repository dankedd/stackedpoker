import { describe, expect, it } from "vitest";
import { buildBankrollSeries } from "../series";

describe("buildBankrollSeries", () => {
  it("returns just the starting point when there is no activity", () => {
    const { series, hasEvData } = buildBankrollSeries(1000, "2026-01-01T00:00:00Z", [], []);
    expect(series).toEqual([{ date: "2026-01-01T00:00:00Z", bankroll: 1000, evBankroll: 1000 }]);
    expect(hasEvData).toBe(false);
  });

  it("walks deposits and withdrawals forward chronologically regardless of input order", () => {
    const { series } = buildBankrollSeries(
      500,
      "2026-01-01T00:00:00Z",
      [],
      [
        { occurred_at: "2026-01-10T00:00:00Z", type: "withdrawal", amount: 100 },
        { occurred_at: "2026-01-05T00:00:00Z", type: "deposit", amount: 300 },
      ]
    );
    expect(series.map((p) => p.bankroll)).toEqual([500, 800, 700]);
  });

  it("only counts settled sessions (cash_out_amount set) toward the bankroll", () => {
    const { series } = buildBankrollSeries(
      1000,
      "2026-01-01T00:00:00Z",
      [
        { started_at: "2026-01-02T00:00:00Z", buy_in_amount: 200, cash_out_amount: 350, ev_amount: null },
        { started_at: "2026-01-03T00:00:00Z", buy_in_amount: 100, cash_out_amount: null, ev_amount: null }, // in progress
      ],
      []
    );
    expect(series.map((p) => p.bankroll)).toEqual([1000, 1150]);
  });

  it("uses ev_amount for the EV line where present, and falls back to actual profit otherwise", () => {
    const { series, hasEvData } = buildBankrollSeries(
      1000,
      "2026-01-01T00:00:00Z",
      [
        { started_at: "2026-01-02T00:00:00Z", buy_in_amount: 200, cash_out_amount: 350, ev_amount: 100 },
        { started_at: "2026-01-03T00:00:00Z", buy_in_amount: 50, cash_out_amount: 20, ev_amount: null },
      ],
      []
    );
    expect(hasEvData).toBe(true);
    // actual: 1000 -> 1150 -> 1120
    expect(series.map((p) => p.bankroll)).toEqual([1000, 1150, 1120]);
    // EV: 1000 -> +100 = 1100 -> no ev_amount, falls back to actual profit (-30) = 1070
    expect(series.map((p) => p.evBankroll)).toEqual([1000, 1100, 1070]);
  });

  it("merges deposits, withdrawals and sessions into one chronological walk", () => {
    const { series } = buildBankrollSeries(
      0,
      "2026-01-01T00:00:00Z",
      [{ started_at: "2026-01-15T00:00:00Z", buy_in_amount: 100, cash_out_amount: 250, ev_amount: null }],
      [{ occurred_at: "2026-01-10T00:00:00Z", type: "deposit", amount: 500 }]
    );
    expect(series.map((p) => p.bankroll)).toEqual([0, 500, 650]);
  });
});
