import { describe, expect, it } from "vitest";
import { DEFENSE_CHARTS } from "../data";
import { actionSteps, chipsBySeat, formatBb, stepText } from "../betSizes";
import type { Scenario } from "../logic";

const spot = (group: "mtt" | "cash", hero: string, vil: string, kind: string, stack: number): Scenario => {
  const chart = DEFENSE_CHARTS.find((c) => c.group === group && c.hero === hero && c.vil === vil && c.spot === kind && c.stack === stack);
  if (!chart) throw new Error(`no chart ${group} ${hero} vs ${vil} ${kind} ${stack}`);
  return { type: "def", kind: "freq", chart, stack, fmt: group, hero, vil, spot: chart.spot };
};
const line = (sc: Scenario) => actionSteps(sc).map(stepText).join(" → ");

describe("bet sizes and the action line", () => {
  it("MTT 60bb 4-bet in position: open from the chart, 3-bet from Table 43, 4-bet as the p. 297 OOP range", () => {
    // UTG opens 2x (MTT open chart), UTG+1 3-bets 7.5 (Table 43, 46–65bb IP), UTG 4-bets 2.5–3x OOP.
    expect(line(spot("mtt", "UTG+1", "UTG", "4bet", 60))).toBe("UTG opens 2 → You 3-bet 7.5 → UTG 4-bets 19–23");
  });

  it("MTT 4-bets below 60bb are all-in for the whole stack", () => {
    expect(line(spot("mtt", "UTG+1", "UTG", "4bet", 25))).toBe("UTG opens 2 → You 3-bet 5.5 → UTG 4-bets all-in 25");
  });

  it("blind 3-bettors use the SB/BB column and the IP 4-bet range", () => {
    // BB 3-bets 9 (Table 43, 46–65bb BB); the BN 4-bets in position, 2.25–2.5x.
    expect(line(spot("mtt", "BB", "BN", "4bet", 60))).toBe("BTN opens 2.3 → You 3-bet 9 → BTN 4-bets 20–23");
  });

  it("MTT blind vs blind follows the printed multipliers (3.5x open, 2.75x 3-bet, 2.6x 4-bet)", () => {
    expect(line(spot("mtt", "BB", "SB", "4bet", 60))).toBe("SB opens 3.5 → You 3-bet 9.6 → SB 4-bets 25");
  });

  it("MTT limp-raise: the BB raise from the limp chart, the SB re-raise 2.75x at 40bb and 3.4x at 60bb", () => {
    expect(line(spot("mtt", "BB", "SB", "lr", 40))).toBe("SB limps → You raise 3.5 → SB re-raises 9.6");
    expect(line(spot("mtt", "BB", "SB", "lr", 60))).toBe("SB limps → You raise 3.5 → SB re-raises 11.9");
    expect(line(spot("mtt", "BB", "SB", "lr", 25))).toBe("SB limps → You raise 3.3 → SB re-raises all-in 25");
  });

  it("cash 100bb uses the p. 181 sizes", () => {
    expect(line(spot("cash", "BN", "CO", "4bet", 100))).toBe("CO opens 2.5 → You 3-bet 8.5 → CO 4-bets 23");
    expect(line(spot("cash", "BB", "SB", "4bet", 100))).toBe("SB opens 3 → You 3-bet 9 → SB 4-bets 24");
    expect(line(spot("cash", "BB", "SB", "lr", 100))).toBe("SB limps → You raise 3.5 → SB re-raises 13");
  });

  it("chips: each player's last amount in bb, blinds otherwise", () => {
    expect(chipsBySeat(spot("mtt", "UTG+1", "UTG", "4bet", 60))).toEqual({ SB: "0.5", BB: "1", UTG: "19–23", "UTG+1": "7.5" });
    expect(chipsBySeat(spot("mtt", "BB", "SB", "push", 15))).toEqual({ SB: "15", BB: "1" });
  });

  it("formats without trailing zeros", () => {
    expect(formatBb(2)).toBe("2");
    expect(formatBb(9.625)).toBe("9.6");
    expect(formatBb([19, 22.5])).toBe("19–22.5");
  });
});
