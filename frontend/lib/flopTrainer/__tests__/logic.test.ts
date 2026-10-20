import { describe, expect, it } from "vitest";
import {
  categoryWeights,
  displayCards,
  explain,
  gradeAnswer,
  pickFlop,
  spotTitle,
  textureCategory,
  tierCuts,
  tierFor,
  tierOf,
  type FlopIndexRow,
  type FlopSpot,
} from "../logic";

// Same cases as backend/tests/test_flop_trainer.py — the server re-grades every answer.
describe("gradeAnswer", () => {
  it.each([
    [60, 60, "perfect", 2],
    [57, 60, "perfect", 2],
    [63, 60, "perfect", 2],
    [56.9, 60, "good", 1],
    [53, 60, "good", 1],
    [52.9, 60, "miss", 0],
    [90, 60, "miss", 0],
  ] as const)("guess %s vs %s → %s", (guess, exact, verdict, points) => {
    const g = gradeAnswer(guess, exact, "OOP", "IP");
    expect([g.verdict, g.points, g.nutCorrect]).toEqual([verdict, points, false]);
  });

  it("adds a point for the right nut advantage", () => {
    expect(gradeAnswer(60, 60, "IP", "IP").points).toBe(3);
    expect(gradeAnswer(80, 60, "EQUAL", "EQUAL").points).toBe(1);
  });
});

describe("textureCategory", () => {
  it.each([
    [["trips", "rainbow", "rank:Kxx", "straights:0"], "paired"],
    [["paired", "two-tone", "rank:Qxx", "straights:0"], "paired"],
    [["unpaired", "monotone", "rank:Axx", "straights:1"], "monotone"],
    [["unpaired", "rainbow", "rank:Axx", "straights:1"], "ace_high"],
    [["unpaired", "two-tone", "rank:Kxx", "straights:2"], "king_high"],
    [["unpaired", "rainbow", "rank:Jxx", "straights:3"], "high"],
    [["unpaired", "rainbow", "rank:Txx", "straights:1"], "connected"],
    [["unpaired", "two-tone", "rank:8xx", "straights:0"], "low_dry"],
  ])("%j → %s", (texture, cat) => {
    expect(textureCategory(texture)).toBe(cat);
  });
});

const row = (flop: string, equity_ip: number, texture: string[] = ["unpaired", "rainbow", "rank:Kxx", "straights:0"], w = 24): FlopIndexRow => ({
  flop,
  flop_weight: w,
  equity_ip,
  nut_adv: { ip: 20, oop: 8, diff: 12, leader: "IP" },
  texture,
});

const INDEX = [row("Kc7d2h", 70), row("Kc8d3h", 64), row("Kc9d4h", 58), row("Tc9d8h", 53), row("Jc9d8h", 51), row("Qc9d8h", 66)];

describe("difficulty", () => {
  it("splits flops into thirds by equity gap", () => {
    const cuts = tierCuts(INDEX);
    expect(tierOf(INDEX[0], cuts)).toBe(1);
    expect(tierOf(INDEX[3], cuts)).toBe(3);
    expect(tierOf(INDEX[2], cuts)).toBe(2);
    expect(tierOf(row("2c2d2h", 51, ["trips"]), cuts)).toBe(1);
  });

  it("runs a session from clear to close and adapts to accuracy", () => {
    expect([0, 3, 9].map((n) => tierFor(n, null))).toEqual([1, 2, 3]);
    expect(tierFor(0, 2)).toBe(2);
    expect(tierFor(9, 10)).toBe(2);
    expect(tierFor(0, 10)).toBe(1);
  });

  it("deals more of the categories a player misjudges", () => {
    const w = categoryWeights({ paired: [5, 12], ace_high: [10, 3], connected: [1, 30] });
    expect(w.paired).toBeGreaterThan(2);
    expect(w.ace_high).toBe(1);
    expect(w.connected).toBe(1); // too few answers to judge
  });

  it("picks from the wanted tier and never repeats an excluded flop", () => {
    const cuts = tierCuts(INDEX);
    const w = categoryWeights({});
    for (let i = 0; i < 20; i++) {
      const r = pickFlop(INDEX, cuts, 1, w, new Set(["Kc7d2h"]), () => i / 20);
      expect(r.flop).not.toBe("Kc7d2h");
      expect(tierOf(r, cuts)).toBe(1);
    }
  });
});

describe("cards and text", () => {
  it("relabels suits consistently", () => {
    const cards = displayCards("AcQd3c", () => 0.3);
    expect(cards.map((c) => c[0])).toEqual(["A", "Q", "3"]);
    expect(cards[0][1]).toBe(cards[2][1]);
    expect(cards[0][1]).not.toBe(cards[1][1]);
  });

  const spot: FlopSpot = {
    spot_id: "srp_bb_vs_bn_40",
    spot_type: "srp",
    ip: "BN",
    oop: "BB",
    stack_bb: 40,
    action: "BN opens 2.3x, folds to BB, BB calls",
    ip_range_pct: 50.8,
    oop_range_pct: 59.1,
    source_pages: [329, 397],
  };

  it("names the spot", () => {
    expect(spotTitle(spot)).toBe("BTN opens 2.3x, BB calls");
  });

  it("explains from the numbers", () => {
    const text = explain(spot, row("Kc7d2h", 61.4), null);
    expect(text).toContain("BTN is well ahead at 61%");
    expect(text).toContain("BTN has more Strong hands: 20% vs 8%");
  });
});
