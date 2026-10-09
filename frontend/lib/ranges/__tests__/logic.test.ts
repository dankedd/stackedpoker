import { describe, expect, it } from "vitest";
import { DEFENSE_CHARTS, MTT_OPEN_CHARTS, PUSH_FOLD_CHARTS } from "../data";
import {
  applyVerdict,
  availableActions,
  dealHand,
  defensePool,
  gradeFrequencies,
  newDeal,
  openPool,
  pushValue,
  scorePct,
  shouldPush,
  spotLabel,
  type DefenseScenario,
  type Rng,
  type Scenario,
} from "../logic";

/** Deterministic PRNG (mulberry32) so dealing tests are reproducible. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const defense = (pred: (c: (typeof DEFENSE_CHARTS)[number]) => boolean): DefenseScenario => {
  const c = DEFENSE_CHARTS.find(pred)!;
  return { type: "def", kind: "freq", chart: c, stack: c.stack, fmt: c.group, hero: c.hero, vil: c.vil, spot: c.spot };
};

describe("grading", () => {
  it("is correct at ≥50%", () => {
    expect(gradeFrequencies({ fold: 0.5, raise: 0.5 }, "raise").verdict).toBe("correct");
    expect(gradeFrequencies({ fold: 0.2, raise: 0.8 }, "raise").verdict).toBe("correct");
  });
  it("is correct for the top action of a spread mix if played >5%", () => {
    expect(gradeFrequencies({ fold: 0.3, call: 0.3, raise: 0.4 }, "raise").verdict).toBe("correct");
    expect(gradeFrequencies({ fold: 0.35, call: 0.35, raise: 0.3 }, "call").verdict).toBe("correct");
  });
  it("is mixed between 10% and the top action", () => {
    expect(gradeFrequencies({ fold: 0.7, raise: 0.3 }, "raise").verdict).toBe("mixed");
    expect(gradeFrequencies({ fold: 0.9, raise: 0.1 }, "raise").verdict).toBe("mixed");
  });
  it("is wrong below 10%", () => {
    expect(gradeFrequencies({ fold: 0.95, raise: 0.05 }, "raise").verdict).toBe("wrong");
    expect(gradeFrequencies({ fold: 1, raise: 0 }, "raise").verdict).toBe("wrong");
  });
  it("scores mixed as half and keeps the streak on mixed", () => {
    let s = { hands: 0, correct: 0, mixed: 0, streak: 0 };
    s = applyVerdict(s, "correct");
    s = applyVerdict(s, "mixed");
    expect(s.streak).toBe(2);
    s = applyVerdict(s, "wrong");
    expect(s).toEqual({ hands: 3, correct: 1, mixed: 1, streak: 0 });
    expect(scorePct(s)).toBe(50);
  });
});

describe("available buttons", () => {
  it("villain all-in → fold / call only", () => {
    const sc = defense((c) => c.spot === "push");
    expect(availableActions(sc)).toEqual(["fold", "call"]);
  });
  it("all-in but no raise in the chart → fold / call / all-in", () => {
    const sc = defense((c) => c.actions.some((a) => a.key === "allin") && !c.actions.some((a) => a.key === "raise"));
    expect(availableActions(sc)).toEqual(["fold", "call", "allin"]);
  });
  it("push/fold → fold / all-in", () => {
    const sc: Scenario = { type: "open", kind: "pf", chart: PUSH_FOLD_CHARTS[0], stack: 7, fmt: "mtt", hero: "SB", w: 1 / 9 };
    expect(availableActions(sc)).toEqual(["fold", "allin"]);
  });
  it("open → fold / limp / raise / all-in", () => {
    const c = MTT_OPEN_CHARTS[0];
    const sc: Scenario = { type: "open", kind: "freq", chart: c, stack: c.stack, fmt: "mtt", hero: c.pos };
    expect(availableActions(sc)).toEqual(["fold", "limp", "raise", "allin"]);
  });
  it("other defense → fold / call / raise / all-in", () => {
    const sc = defense((c) => c.spot === "open" && c.actions.some((a) => a.key === "raise"));
    expect(availableActions(sc)).toEqual(["fold", "call", "raise", "allin"]);
  });
  it("describes the spot from the villain's open chart", () => {
    const sc = defense((c) => c.group === "mtt" && c.hero === "BB" && c.vil === "BN" && c.stack === 25 && c.spot === "open");
    expect(spotLabel(sc)).toBe("BTN opens 2x");
  });
});

describe("push values", () => {
  it("reads a printed number", () => expect(pushValue(["red", "7"])).toBe(7));
  it("treats an empty black cell as always (10)", () => expect(pushValue(["black", ""])).toBe(10));
  it("treats an empty red cell as never (0)", () => expect(pushValue(["red", ""])).toBe(0));
  it("shoves when the value is at least the stack", () => {
    expect(shouldPush(["red", "7"], 7)).toBe(true);
    expect(shouldPush(["red", "7"], 8)).toBe(false);
    expect(shouldPush(["red", ""], 1)).toBe(false);
  });
});

describe("dealing", () => {
  it("never deals a hand that does not reach the spot", () => {
    const rng = seeded(42);
    const withNulls = defensePool("all").filter(
      (sc) => sc.type === "def" && Object.values(sc.chart.grid).some((v) => v === null),
    );
    expect(withNulls.length).toBeGreaterThan(0);
    for (const sc of withNulls) {
      for (let i = 0; i < 30; i++) {
        const { hand, cards } = dealHand(sc, rng);
        expect((sc.chart.grid as Record<string, unknown>)[hand], `${sc.chart.page} ${hand}`).not.toBeNull();
        expect(cards[0][0]).toBe(hand[0]);
        expect(cards[1][0]).toBe(hand[1]);
        if (hand.endsWith("s")) expect(cards[0][1]).toBe(cards[1][1]);
        else expect(cards[0][1]).not.toBe(cards[1][1]);
      }
    }
  });

  it("only offers push/fold in open pools", () => {
    expect(openPool("pf").every((s) => s.kind === "pf")).toBe(true);
    expect(defensePool("pf")).toHaveLength(0);
  });

  it("deals from every trainer type and mode", () => {
    const rng = seeded(7);
    for (const type of ["open", "def", "mix"] as const) {
      for (const mode of ["all", "mtt", "pf", "cash"] as const) {
        for (let i = 0; i < 50; i++) {
          const d = newDeal(type, mode, true, rng);
          expect((d.chart.grid as Record<string, unknown>)[d.hand]).not.toBeNull();
          expect(availableActions(d).length).toBeGreaterThan(1);
        }
      }
    }
  });
});
