import { describe, expect, it } from "vitest";
import { boardCount, calculateEquity, validateEquityInput } from "../equity";

/**
 * The enumeration is exhaustive, so most of these are exact identities rather
 * than tolerances: with a complete board the answer is 0, 1 or a chop, and
 * with an incomplete board the counts must still add up and stay symmetric.
 *
 * The few benchmark match-ups are asserted as wide bands. Quoting a precise
 * published percentage would be asserting someone else's number; the bands
 * check the shape of the result (a dominated pair is a big favourite, a
 * pair-versus-two-overcards is close to a coin flip) without pretending to
 * a source this file does not have.
 */

describe("validation", () => {
  it("requires two cards for each player", () => {
    expect(validateEquityInput(["As"], ["Kd", "Kh"], [])).toEqual({ kind: "hero-incomplete" });
    expect(validateEquityInput(["As", "Ad"], ["Kd"], [])).toEqual({ kind: "villain-incomplete" });
  });

  it("rejects a board longer than five cards", () => {
    const board = ["2c", "3d", "4h", "5s", "7c", "8d"];
    expect(validateEquityInput(["As", "Ad"], ["Kc", "Kh"], board)).toEqual({
      kind: "board-too-long",
      count: 6,
    });
  });

  it("rejects a card used twice", () => {
    expect(validateEquityInput(["As", "Ad"], ["As", "Kh"], [])).toEqual({
      kind: "duplicate-cards",
      cards: ["As"],
    });
    expect(validateEquityInput(["As", "Ad"], ["Kc", "Kh"], ["Ad", "2c", "3d"])).toEqual({
      kind: "duplicate-cards",
      cards: ["Ad"],
    });
  });

  it("accepts a valid spot", () => {
    expect(validateEquityInput(["As", "Ad"], ["Kc", "Kh"], ["2c", "7d", "9h"])).toBeNull();
  });

  it("throws rather than returning a partial result", () => {
    expect(() => calculateEquity(["As"], ["Kc", "Kh"], [])).toThrow(/Invalid equity input/);
  });
});

describe("complete boards are decided, not estimated", () => {
  it("gives the winner 100%", () => {
    const result = calculateEquity(["As", "Ad"], ["Kc", "Kh"], ["Ah", "7d", "2c", "5s", "9h"]);
    expect(result.boardsEvaluated).toBe(1);
    expect(result.heroEquity).toBe(1);
    expect(result.villainEquity).toBe(0);
    expect(result.heroWinPct).toBe(100);
    expect(result.tiePct).toBe(0);
  });

  it("splits a played-board chop exactly in half", () => {
    // Both players play the board: a royal flush in spades.
    const result = calculateEquity(["2c", "3d"], ["4h", "6s"], ["As", "Ks", "Qs", "Js", "Ts"]);
    expect(result.heroEquity).toBe(0.5);
    expect(result.villainEquity).toBe(0.5);
    expect(result.tiePct).toBe(100);
  });
});

describe("incomplete boards enumerate every runout", () => {
  it("enumerates the right number of boards at each street", () => {
    expect(calculateEquity(["As", "Ad"], ["Kc", "Kh"], ["2c", "7d", "9h", "3s"]).boardsEvaluated)
      .toBe(44);
    expect(calculateEquity(["As", "Ad"], ["Kc", "Kh"], ["2c", "7d", "9h"]).boardsEvaluated)
      .toBe(990);
    expect(boardCount(0)).toBe(1712304);
    expect(boardCount(3)).toBe(990);
    expect(boardCount(4)).toBe(44);
    expect(boardCount(5)).toBe(1);
  });

  it("keeps equities summing to exactly 1", () => {
    const spots: [string[], string[], string[]][] = [
      [["As", "Ad"], ["Kc", "Kh"], []],
      [["Ah", "Ks"], ["7c", "7d"], ["2c", "9h", "Jd"]],
      [["Qs", "Js"], ["Ac", "Kd"], ["Ts", "9s", "2h", "4c"]],
    ];
    for (const [hero, villain, board] of spots) {
      const result = calculateEquity(hero, villain, board);
      expect(result.heroEquity + result.villainEquity).toBeCloseTo(1, 12);
      expect(result.heroWinPct + result.villainWinPct + result.tiePct).toBeCloseTo(100, 10);
    }
  });

  it("is symmetric when the players are swapped", () => {
    const forward = calculateEquity(["Ah", "Ks"], ["7c", "7d"], ["2c", "9h", "Jd"]);
    const reversed = calculateEquity(["7c", "7d"], ["Ah", "Ks"], ["2c", "9h", "Jd"]);
    expect(reversed.heroEquity).toBeCloseTo(forward.villainEquity, 12);
    expect(reversed.tiePct).toBeCloseTo(forward.tiePct, 12);
  });

  it("is deterministic — no sampling", () => {
    const a = calculateEquity(["Ah", "Ks"], ["7c", "7d"], ["2c", "9h", "Jd"]);
    const b = calculateEquity(["Ah", "Ks"], ["7c", "7d"], ["2c", "9h", "Jd"]);
    expect(a).toEqual(b);
  });
});

describe("benchmark match-ups land in the expected band", () => {
  it("makes aces a large favourite over kings preflop", () => {
    const result = calculateEquity(["As", "Ah"], ["Kc", "Kd"], []);
    expect(result.boardsEvaluated).toBe(1712304);
    expect(result.heroEquity).toBeGreaterThan(0.79);
    expect(result.heroEquity).toBeLessThan(0.84);
  });

  it("makes a pair versus two overcards close to a coin flip", () => {
    const result = calculateEquity(["7c", "7d"], ["Ah", "Ks"], []);
    expect(result.heroEquity).toBeGreaterThan(0.5);
    expect(result.heroEquity).toBeLessThan(0.58);
  });

  it("makes a dominated ace a big underdog", () => {
    const strong = calculateEquity(["Ah", "Kd"], ["Ac", "Qs"], []);
    expect(strong.heroEquity).toBeGreaterThan(0.7);
  });

  it("counts the chop chance when both players hold the same pair", () => {
    const result = calculateEquity(["Ah", "Ad"], ["Ac", "As"], []);
    expect(result.heroEquity).toBeCloseTo(0.5, 10);
    expect(result.tiePct).toBeGreaterThan(95);
  });
});

describe("performance", () => {
  it("finishes the worst case (preflop, 1.7M boards) quickly enough to run in a browser", () => {
    const started = Date.now();
    calculateEquity(["As", "Ah"], ["Kc", "Kd"], []);
    expect(Date.now() - started).toBeLessThan(8000);
  });
});
