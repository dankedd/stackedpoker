import { describe, expect, it } from "vitest";
import { alpha, mdf, requiredEquityFromPot } from "@/lib/theory/math";
import { BB_DEFENSE_COMPLETE_100BB } from "@/lib/learn/bbDefenseComplete";
import { RFI_DEEP } from "@/lib/learn/preflopBaselines";
import {
  BANKROLL_CATEGORIES,
  BANKROLL_PROVENANCE,
  calculateBankroll,
  defaultBuyInCount,
  explainBankroll,
  validateBankroll,
} from "../bankroll";
import { calculatePotOdds, explainPotOdds, validatePotOdds } from "../potOdds";
import { buildQuestion, POSITIONS, positionById, seatOrder } from "../positions";
import {
  buildQuizQuestion,
  gradeAnswer,
  MIX_TOLERANCE,
  QUIZ_LENGTH,
  type QuizMode,
} from "../startingHands";
import {
  calculateVariance,
  CONFIDENCE_LEVELS,
  normalCdf,
  validateVariance,
  zScoreFor,
} from "../variance";
import { parseCards, findDuplicates, formatCard, describeCard, remainingDeck } from "../cards";

// ── Cards ────────────────────────────────────────────────────────────────────

describe("card parsing", () => {
  it("accepts the shapes people actually type", () => {
    expect(parseCards("AsKh").cards).toEqual(["As", "Kh"]);
    expect(parseCards("As Kh").cards).toEqual(["As", "Kh"]);
    expect(parseCards("as,kh").cards).toEqual(["As", "Kh"]);
    expect(parseCards("A♠ K♥").cards).toEqual(["As", "Kh"]);
    expect(parseCards("10s Jd").cards).toEqual(["Ts", "Jd"]);
  });

  it("reports what it could not understand instead of dropping it", () => {
    const parsed = parseCards("As Xx Kh");
    expect(parsed.cards).toEqual(["As", "Kh"]);
    expect(parsed.invalid).toEqual(["Xx"]);
  });

  it("handles empty input", () => {
    expect(parseCards("   ")).toEqual({ cards: [], invalid: [] });
  });

  it("finds duplicates across groups", () => {
    expect(findDuplicates(["As", "Kh"], ["As"], ["2c"])).toEqual(["As"]);
    expect(findDuplicates(["As", "Kh"], ["Qd"])).toEqual([]);
  });

  it("formats and describes cards", () => {
    expect(formatCard("As")).toBe("A♠");
    expect(describeCard("Th")).toBe("ten of hearts");
  });

  it("removes used cards from the deck", () => {
    expect(remainingDeck(["As", "Kh"])).toHaveLength(50);
    expect(remainingDeck([])).toHaveLength(52);
  });
});

// ── Pot odds ─────────────────────────────────────────────────────────────────

describe("pot odds", () => {
  it("matches lib/theory/math rather than recomputing the maths", () => {
    const result = calculatePotOdds({ pot: 100, bet: 50 });
    expect(result.requiredEquityPct).toBeCloseTo(requiredEquityFromPot(150, 50), 10);
    expect(result.alphaPct).toBeCloseTo(alpha(50, 100) * 100, 10);
    expect(result.mdfPct).toBeCloseTo(mdf(50, 100) * 100, 10);
  });

  it("computes the textbook half-pot case", () => {
    const result = calculatePotOdds({ pot: 100, bet: 50 });
    expect(result.requiredEquityPct).toBeCloseTo(25, 10);
    expect(result.potAfterCall).toBe(200);
    expect(result.oddsRatio).toBe("3.0 : 1");
    expect(result.betAsPotFraction).toBeCloseTo(0.5, 10);
  });

  it("computes the pot-sized case", () => {
    const result = calculatePotOdds({ pot: 100, bet: 100 });
    expect(result.requiredEquityPct).toBeCloseTo(33.333, 3);
    expect(result.alphaPct).toBeCloseTo(50, 10);
    expect(result.mdfPct).toBeCloseTo(50, 10);
  });

  it("supports a call that differs from the bet", () => {
    // Villain shoves 200 into 100 but you can only call 60.
    const result = calculatePotOdds({ pot: 100, bet: 200, call: 60 });
    expect(result.callAmount).toBe(60);
    expect(result.requiredEquityPct).toBeCloseTo((60 / 360) * 100, 10);
  });

  it("handles a check (zero bet) without dividing by zero", () => {
    const result = calculatePotOdds({ pot: 100, bet: 0 });
    expect(result.requiredEquityPct).toBe(0);
    expect(result.oddsRatio).toBe("no cost");
    expect(Number.isFinite(result.mdfPct)).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(validatePotOdds({ pot: 0, bet: 10 })).toEqual({ kind: "pot-not-positive" });
    expect(validatePotOdds({ pot: -5, bet: 10 })).toEqual({ kind: "pot-not-positive" });
    expect(validatePotOdds({ pot: 100, bet: -1 })).toEqual({ kind: "bet-negative" });
    expect(validatePotOdds({ pot: 100, bet: 10, call: -1 })).toEqual({ kind: "call-negative" });
    expect(validatePotOdds({ pot: 100, bet: 50 })).toBeNull();
    expect(() => calculatePotOdds({ pot: 0, bet: 10 })).toThrow(/Invalid pot odds/);
  });

  it("explains the price without claiming to know whether to call", () => {
    const text = explainPotOdds(calculatePotOdds({ pot: 100, bet: 50 }));
    expect(text).toContain("25.0%");
    expect(text).toMatch(/depends on villain's range/);
  });
});

// ── Bankroll ─────────────────────────────────────────────────────────────────

describe("bankroll", () => {
  it("uses the product's own presets, not a second set of numbers", () => {
    for (const category of BANKROLL_CATEGORIES) {
      expect(defaultBuyInCount(category)).toBeGreaterThan(0);
      expect(BANKROLL_PROVENANCE[category].note.length).toBeGreaterThan(20);
    }
  });

  it("cites the book only where the book actually says something", () => {
    // Modern Poker Theory gives an MTT figure and nothing for the others.
    expect(BANKROLL_PROVENANCE.tournament.cited).toBe(true);
    expect(BANKROLL_PROVENANCE.tournament.note).toContain("p.264");
    for (const category of ["cash", "plo", "spin_and_go"] as const) {
      expect(BANKROLL_PROVENANCE[category].cited, category).toBe(false);
      expect(BANKROLL_PROVENANCE[category].note, category).toMatch(/own default/);
    }
  });

  it("computes the requirement and the shortfall", () => {
    const result = calculateBankroll({
      bankroll: 1000,
      category: "cash",
      buyIn: 100,
      buyInCount: 40,
    });
    expect(result.recommendedBankroll).toBe(4000);
    expect(result.buyInsAvailable).toBe(10);
    expect(result.affordableBuyIn).toBe(25);
    expect(result.shortfall).toBe(3000);
    expect(result.status).toBe("move_down");
    expect(result.warning).toContain("below your 40-buy-in rule");
  });

  it("reports a healthy roll as safe and a big one as ready to move up", () => {
    const safe = calculateBankroll({ bankroll: 4200, category: "cash", buyIn: 100, buyInCount: 40 });
    expect(safe.status).toBe("safe");
    expect(safe.shortfall).toBe(0);

    const up = calculateBankroll({ bankroll: 6500, category: "cash", buyIn: 100, buyInCount: 40 });
    expect(up.status).toBe("move_up");
    expect(up.moveUpAt).toBe(6000);
  });

  it("puts move-up and move-down on either side of the requirement", () => {
    for (const category of BANKROLL_CATEGORIES) {
      const result = calculateBankroll({ bankroll: 5000, category, buyIn: 50 });
      expect(result.moveUpAt, category).toBeGreaterThan(result.moveDownBelow);
    }
  });

  it("rejects a category that never came from the type system", () => {
    expect(validateBankroll({ bankroll: 100, category: "mtt" as never, buyIn: 50 })).toEqual({
      kind: "unknown-category",
      category: "mtt",
    });
  });

  it("rejects invalid input", () => {
    expect(validateBankroll({ bankroll: -1, category: "cash", buyIn: 100 })).toEqual({
      kind: "bankroll-negative",
    });
    expect(validateBankroll({ bankroll: 100, category: "cash", buyIn: 0 })).toEqual({
      kind: "buy-in-not-positive",
    });
    expect(validateBankroll({ bankroll: 100, category: "cash", buyIn: 10, buyInCount: 0 })).toEqual({
      kind: "buy-in-count-not-positive",
    });
    expect(() => calculateBankroll({ bankroll: 1, category: "cash", buyIn: 0 })).toThrow();
  });

  it("explains every status", () => {
    for (const bankroll of [500, 4200, 9000]) {
      const result = calculateBankroll({ bankroll, category: "cash", buyIn: 100, buyInCount: 40 });
      expect(explainBankroll(result, "cash").length).toBeGreaterThan(30);
    }
  });
});

// ── Variance ─────────────────────────────────────────────────────────────────

describe("variance", () => {
  it("scales expectation linearly and spread with the square root", () => {
    const small = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 10000 });
    const big = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 40000 });

    expect(small.expectedBb).toBeCloseTo(500, 10);
    expect(big.expectedBb).toBeCloseTo(2000, 10);
    // 4x the hands is 2x the standard deviation, never 4x.
    expect(big.stdDevBb / small.stdDevBb).toBeCloseTo(2, 10);
  });

  it("computes the 95% interval from the right z-score", () => {
    const result = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 10000 });
    expect(result.zScore).toBe(1.96);
    expect(result.stdDevBb).toBeCloseTo(1000, 10);
    expect(result.lowerBb).toBeCloseTo(500 - 1960, 8);
    expect(result.upperBb).toBeCloseTo(500 + 1960, 8);
  });

  it("centres the interval on the expectation", () => {
    const result = calculateVariance({ winRateBb100: 3, stdDevBb100: 90, hands: 25000 });
    expect((result.lowerBb + result.upperBb) / 2).toBeCloseTo(result.expectedBb, 8);
  });

  it("narrows the win-rate range as the sample grows", () => {
    const small = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 10000 });
    const big = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 1000000 });
    const width = (r: typeof small) => r.upperWinRate - r.lowerWinRate;
    expect(width(big)).toBeLessThan(width(small));
  });

  it("puts the probability of loss at 50% for a break-even player", () => {
    const result = calculateVariance({ winRateBb100: 0, stdDevBb100: 100, hands: 10000 });
    expect(result.probabilityOfLossPct).toBeCloseTo(50, 4);
  });

  it("lowers the probability of loss as the win rate rises", () => {
    const weak = calculateVariance({ winRateBb100: 1, stdDevBb100: 100, hands: 10000 });
    const strong = calculateVariance({ winRateBb100: 10, stdDevBb100: 100, hands: 10000 });
    expect(strong.probabilityOfLossPct).toBeLessThan(weak.probabilityOfLossPct);
    expect(strong.probabilityOfLossPct).toBeGreaterThan(0);
  });

  it("has a correct normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4);
    expect(normalCdf(1) - normalCdf(-1)).toBeCloseTo(0.6827, 3);
  });

  it("exposes only z-scores it can state exactly", () => {
    for (const level of CONFIDENCE_LEVELS) {
      expect(zScoreFor(level.confidence)).toBe(level.z);
    }
    expect(zScoreFor(0.42)).toBe(1.96); // documented fallback
  });

  it("produces a chart curve that starts at zero and ends at the sample size", () => {
    const result = calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 50000 });
    expect(result.points[0]).toEqual({ hands: 0, expected: 0, upper: 0, lower: 0 });
    expect(result.points.at(-1)!.hands).toBe(50000);
    for (const point of result.points) {
      expect(point.upper).toBeGreaterThanOrEqual(point.lower);
    }
  });

  it("handles a losing win rate", () => {
    const result = calculateVariance({ winRateBb100: -3, stdDevBb100: 100, hands: 100000 });
    expect(result.expectedBb).toBeLessThan(0);
    expect(result.probabilityOfLossPct).toBeGreaterThan(50);
  });

  it("rejects invalid input", () => {
    expect(validateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 0 })).toEqual({
      kind: "hands-not-positive",
    });
    expect(validateVariance({ winRateBb100: 5, stdDevBb100: 0, hands: 100 })).toEqual({
      kind: "std-dev-not-positive",
    });
    expect(
      validateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: 100, confidence: 1 }),
    ).toEqual({ kind: "confidence-out-of-range" });
    expect(() => calculateVariance({ winRateBb100: 5, stdDevBb100: 100, hands: -1 })).toThrow();
  });
});

// ── Position trainer ─────────────────────────────────────────────────────────

describe("position trainer", () => {
  it("has six seats with unique ids and orders", () => {
    expect(POSITIONS).toHaveLength(6);
    expect(new Set(POSITIONS.map((p) => p.id)).size).toBe(6);
    expect(new Set(POSITIONS.map((p) => p.preflopOrder))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(new Set(POSITIONS.map((p) => p.postflopOrder))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(new Set(POSITIONS.map((p) => p.seatFromButton)).size).toBe(6);
  });

  it("acts UTG first and BB last preflop", () => {
    expect(positionById("UTG").preflopOrder).toBe(0);
    expect(positionById("BB").preflopOrder).toBe(5);
  });

  it("acts SB first and BTN last postflop", () => {
    expect(positionById("SB").postflopOrder).toBe(0);
    expect(positionById("BTN").postflopOrder).toBe(5);
    expect(positionById("BTN").inPositionPostflop).toBe(true);
  });

  it("seats the table in button order", () => {
    expect(seatOrder().map((p) => p.id)).toEqual(["BTN", "CO", "MP", "UTG", "BB", "SB"]);
  });

  it("generates deterministic, answerable questions", () => {
    for (const mode of ["name-the-seat", "who-acts-first"] as const) {
      for (let i = 0; i < 40; i += 1) {
        const question = buildQuestion(i, 7, mode);
        const repeat = buildQuestion(i, 7, mode);
        expect(repeat).toEqual(question);
        expect(question.explanation.length).toBeGreaterThan(10);

        if (mode === "name-the-seat") {
          expect(question.highlight).toBe(question.answer);
        } else {
          expect(question.contenders).toHaveLength(2);
          expect(question.contenders[0]).not.toBe(question.contenders[1]);
          expect(question.contenders).toContain(question.answer);
          const [a, b] = question.contenders.map(positionById);
          const expected = a.preflopOrder < b.preflopOrder ? a.id : b.id;
          expect(question.answer).toBe(expected);
        }
      }
    }
  });
});

// ── Starting hand quiz ───────────────────────────────────────────────────────

describe("starting hand quiz", () => {
  const modes: QuizMode[] = ["open-or-fold", "defend-bb"];

  it("generates deterministic questions", () => {
    for (const mode of modes) {
      for (let i = 0; i < QUIZ_LENGTH; i += 1) {
        expect(buildQuizQuestion(i, 42, mode)).toEqual(buildQuizQuestion(i, 42, mode));
      }
    }
  });

  it("always offers the correct answer as one of the options", () => {
    for (const mode of modes) {
      for (let i = 0; i < 120; i += 1) {
        const question = buildQuizQuestion(i, i * 13 + 1, mode);
        expect(question.options, `${mode} #${i}`).toContain(question.answer);
        for (const accepted of question.alsoAccepted) {
          expect(question.options).toContain(accepted);
        }
      }
    }
  });

  it("grades against the chart, accepting a genuinely close second action", () => {
    for (const mode of modes) {
      for (let i = 0; i < 120; i += 1) {
        const question = buildQuizQuestion(i, i * 29 + 5, mode);
        expect(gradeAnswer(question, question.answer)).toBe(true);
        for (const accepted of question.alsoAccepted) {
          expect(gradeAnswer(question, accepted)).toBe(true);
        }
        const wrong = question.options.find(
          (o) => o !== question.answer && !question.alsoAccepted.includes(o),
        );
        if (wrong) expect(gradeAnswer(question, wrong)).toBe(false);
      }
    }
  });

  it("only accepts a second action when the chart is genuinely close", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuizQuestion(i, i * 7 + 3, "defend-bb");
      const top = question.mix[question.answer] ?? 0;
      for (const accepted of question.alsoAccepted) {
        expect(top - (question.mix[accepted] ?? 0)).toBeLessThanOrEqual(MIX_TOLERANCE + 1e-9);
      }
    }
  });

  it("keeps every mix a probability distribution", () => {
    for (const mode of modes) {
      for (let i = 0; i < 80; i += 1) {
        const question = buildQuizQuestion(i, i * 17 + 9, mode);
        const total = Object.values(question.mix).reduce((sum, freq) => sum + (freq ?? 0), 0);
        expect(total, `${mode} #${i} ${question.hand}`).toBeCloseTo(1, 3);
      }
    }
  });

  it("grades open-or-fold against the real RFI chart", () => {
    for (let i = 0; i < 60; i += 1) {
      const question = buildQuizQuestion(i, i * 11 + 2, "open-or-fold");
      const entry = (RFI_DEEP[question.position] ?? []).find((e) => e.hand === question.hand);
      const raiseFreq = entry?.freq ?? 0;
      const label = `${question.position} ${question.hand} @ ${raiseFreq}`;
      // The tolerance is on the GAP between the two frequencies, which for a
      // two-action mix is |2f - 1| — not on f itself.
      const gap = Math.abs(2 * raiseFreq - 1);

      if (gap > MIX_TOLERANCE && raiseFreq > 0.5) {
        expect(question.answer, label).toBe("raise");
      } else if (gap > MIX_TOLERANCE) {
        expect(question.answer, label).toBe("fold");
      } else {
        // A hand the chart opens close to half the time has no single right
        // answer, and the quiz must not pretend otherwise.
        expect(gradeAnswer(question, "raise"), label).toBe(true);
        expect(gradeAnswer(question, "fold"), label).toBe(true);
      }
    }
  });

  it("grades big-blind defence against the book-sourced chart", () => {
    for (let i = 0; i < 60; i += 1) {
      const question = buildQuizQuestion(i, i * 19 + 4, "defend-bb");
      const charts = Object.values(BB_DEFENSE_COMPLETE_100BB);
      const known = charts.some((chart) => chart[question.hand] !== undefined);
      expect(known, question.hand).toBe(true);
      expect(question.source).toContain("Modern Poker Theory");
      expect(question.source).toMatch(/p\.\d+/);
    }
  });

  it("never offers a call when nobody has entered the pot", () => {
    for (let i = 0; i < 40; i += 1) {
      expect(buildQuizQuestion(i, i, "open-or-fold").options).toEqual(["raise", "fold"]);
    }
  });
});
