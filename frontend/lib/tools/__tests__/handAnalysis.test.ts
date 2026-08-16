import { describe, expect, it } from "vitest";
import { requiredEquityFromPot } from "@/lib/theory/math";
import { calculateEquity } from "../equity";
import { analyzeHand } from "../handAnalysis/analyze";
import {
  buildCoachHandContext,
  coachOpeningQuestion,
  decodeHandFromQuery,
  encodeHandToQuery,
} from "../handAnalysis/coachContext";
import { parseHandHistory } from "../handAnalysis/parse";
import type { HandInput } from "../handAnalysis/types";
import { streetForBoard, validateHand } from "../handAnalysis/validate";

function hand(overrides: Partial<HandInput> = {}): HandInput {
  return {
    heroPosition: "BTN",
    heroCards: ["As", "5s"],
    board: [],
    actions: [],
    ...overrides,
  };
}

// ── Validation (§16 input) ───────────────────────────────────────────────────

describe("hand validation", () => {
  it("accepts a minimal valid hand", () => {
    expect(validateHand(hand())).toEqual([]);
  });

  it("rejects a hero hand that is not two cards", () => {
    expect(validateHand(hand({ heroCards: ["As"] }))[0].kind).toBe("hero-cards");
    expect(validateHand(hand({ heroCards: ["As", "5s", "2c"] }))[0].kind).toBe("hero-cards");
  });

  it("rejects a duplicated card anywhere in the hand", () => {
    const duplicate = validateHand(
      hand({ board: ["As", "7d", "2c"] }),
    ).find((i) => i.kind === "duplicate-cards");
    expect(duplicate).toBeTruthy();
    expect(duplicate!.message).toContain("As");

    const villainClash = validateHand(
      hand({ villainCards: ["As", "Kd"] }),
    ).find((i) => i.kind === "duplicate-cards");
    expect(villainClash).toBeTruthy();
  });

  it("rejects an impossible board", () => {
    expect(validateHand(hand({ board: ["2c", "3d", "4h", "5s", "6c", "7d"] }))[0].kind)
      .toBe("board-length");
    // One or two community cards is never a real street.
    expect(validateHand(hand({ board: ["2c"] }))[0].kind).toBe("board-length");
    expect(validateHand(hand({ board: ["2c", "3d"] }))[0].kind).toBe("board-length");
  });

  it("rejects a card that is not a card", () => {
    expect(validateHand(hand({ heroCards: ["Xx", "5s"] })).some((i) => i.kind === "bad-card"))
      .toBe(true);
  });

  it("rejects an action on a street that was never dealt", () => {
    const issues = validateHand(
      hand({ board: [], actions: [{ street: "flop", actor: "hero", type: "bet", amountBb: 3 }] }),
    );
    expect(issues.some((i) => i.kind === "action-street")).toBe(true);
    expect(issues.find((i) => i.kind === "action-street")!.message).toContain("flop");
  });

  it("rejects negative amounts and stacks", () => {
    expect(
      validateHand(hand({ actions: [{ street: "preflop", actor: "hero", type: "bet", amountBb: -1 }] }))
        .some((i) => i.kind === "negative-amount"),
    ).toBe(true);
    expect(validateHand(hand({ effectiveStackBb: 0 })).some((i) => i.kind === "stack")).toBe(true);
  });

  it("derives the street from the board", () => {
    expect(streetForBoard([])).toBe("preflop");
    expect(streetForBoard(["2c", "3d", "4h"])).toBe("flop");
    expect(streetForBoard(["2c", "3d", "4h", "5s"])).toBe("turn");
    expect(streetForBoard(["2c", "3d", "4h", "5s", "6c"])).toBe("river");
  });
});

// ── Analysis (§16 analysis) ──────────────────────────────────────────────────

describe("analysis", () => {
  it("refuses to analyse an invalid hand rather than guessing", () => {
    expect(() => analyzeHand(hand({ heroCards: ["As"] }))).toThrow(/Cannot analyse/);
  });

  it("states the facts without interpreting them", () => {
    const analysis = analyzeHand(
      hand({
        board: ["Kd", "Tc", "9s"],
        actions: [{ street: "flop", actor: "hero", type: "bet", amountBb: 4 }],
      }),
    );
    expect(analysis.facts.some((f) => f.includes("A♠ 5♠"))).toBe(true);
    expect(analysis.facts.some((f) => f.includes("K♦ T♣ 9♠"))).toBe(true);
    expect(analysis.facts.some((f) => f.includes("Hero bets 4bb on the flop"))).toBe(true);
  });

  it("computes the price from the same maths the lessons use", () => {
    const analysis = analyzeHand(
      hand({
        board: ["Kd", "Tc", "9s"],
        potBb: 10,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
      }),
    );
    const required = analysis.calculations.find((c) => c.id === "required-equity")!;
    expect(required.value).toBe(`${requiredEquityFromPot(15, 5).toFixed(1)}%`);
    expect(analysis.calculations.find((c) => c.id === "mdf")!.value).toBe("66.7%");
    expect(analysis.calculations.find((c) => c.id === "alpha")!.value).toBe("33.3%");
  });

  it("reports the made hand and the board texture", () => {
    const analysis = analyzeHand(hand({ heroCards: ["Kh", "Kc"], board: ["Kd", "Tc", "9s"] }));
    expect(analysis.calculations.find((c) => c.id === "made-hand")!.value).toBe("Three of a kind");
    expect(analysis.calculations.find((c) => c.id === "board-texture")!.value).toContain("unpaired");
  });

  it("computes exact equity only when both hands are known", () => {
    const known = analyzeHand(
      hand({ heroCards: ["Ah", "Kh"], villainCards: ["Qs", "Qd"], board: ["Jh", "7h", "2c"] }),
    );
    const live = calculateEquity(["Ah", "Kh"], ["Qs", "Qd"], ["Jh", "7h", "2c"]);
    expect(known.calculations.find((c) => c.id === "equity")!.value).toBe(
      `${(live.heroEquity * 100).toFixed(2)}%`,
    );

    const unknown = analyzeHand(hand({ board: ["Jh", "7h", "2c"] }));
    expect(unknown.calculations.some((c) => c.id === "equity")).toBe(false);
    expect(unknown.limitations.some((l) => l.includes("Villain's cards are unknown"))).toBe(true);
  });

  it("never estimates equity against a range", () => {
    // The whole point of the limitation: a range needs assumptions there is no
    // reviewed source for, so no number is produced at all.
    const analysis = analyzeHand(hand({ board: ["Jh", "7h", "2c"], potBb: 10 }));
    expect(analysis.limitations.join(" ")).toMatch(/no reviewed source/i);
    expect(analysis.calculations.every((c) => c.id !== "equity")).toBe(true);
  });

  it("only reaches a verdict when the arithmetic settles it", () => {
    // Known vs known, with a price: the maths decides.
    const decisive = analyzeHand(
      hand({
        heroCards: ["Ah", "Kh"],
        villainCards: ["Qs", "Qd"],
        board: ["Jh", "7h", "2c"],
        potBb: 10,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
      }),
    );
    expect(["profitable-by-the-maths", "unprofitable-by-the-maths"]).toContain(decisive.verdict);
    expect(decisive.confidence).toBe("high");

    // Villain unknown: the price is knowable, the decision is not.
    const undecided = analyzeHand(
      hand({
        board: ["Jh", "7h", "2c"],
        potBb: 10,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
      }),
    );
    expect(undecided.verdict).toBe("needs-review");
    expect(undecided.verdictBasis).toMatch(/villain/i);
  });

  it("calls the verdict correctly against the price", () => {
    // AhKh has well over the 25% a half-pot call needs on this board.
    const good = analyzeHand(
      hand({
        heroCards: ["Ah", "Kh"],
        villainCards: ["Qs", "Qd"],
        board: ["Jh", "7h", "2c"],
        potBb: 10,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
      }),
    );
    expect(good.verdict).toBe("profitable-by-the-maths");

    // 72o against aces on a dry board does not.
    const bad = analyzeHand(
      hand({
        heroCards: ["7d", "2h"],
        villainCards: ["As", "Ad"],
        board: ["Kc", "Qd", "9s"],
        potBb: 10,
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 10 }],
      }),
    );
    expect(bad.verdict).toBe("unprofitable-by-the-maths");
  });

  it("says there is nothing to assess when no action was entered", () => {
    const analysis = analyzeHand(hand());
    expect(analysis.verdict).toBe("insufficient-information");
    expect(analysis.confidence).toBe("insufficient");
  });

  it("detects concepts that exist in the reviewed registry, with a factual trigger", () => {
    const analysis = analyzeHand(
      hand({
        potBb: 10,
        effectiveStackBb: 100,
        board: ["Jh", "7h", "2c"],
        actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 15 }],
      }),
    );
    const ids = analysis.conceptIds;
    expect(ids).toContain("position_value");
    expect(ids).toContain("mdf");
    expect(ids).toContain("overbet"); // 15bb into a 10bb pot
    expect(ids).toContain("spr_theory");

    for (const concept of analysis.concepts) {
      expect(concept.explanation.length, concept.conceptId).toBeGreaterThan(20);
      expect(concept.trigger.length, concept.conceptId).toBeGreaterThan(10);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always states what it could not determine", () => {
    const analysis = analyzeHand(hand());
    expect(analysis.limitations.length).toBeGreaterThan(0);
    expect(analysis.limitations.join(" ")).toMatch(/not a solver/i);
  });

  it("handles a complete five-card board", () => {
    const analysis = analyzeHand(
      hand({ heroCards: ["As", "Ks"], board: ["Qs", "Js", "Ts", "2c", "3d"] }),
    );
    expect(analysis.summary.street).toBe("river");
    expect(analysis.calculations.find((c) => c.id === "made-hand")!.value).toBe("Straight flush");
  });
});

// ── Parsing (§16 parsing) ────────────────────────────────────────────────────

const POKERSTARS = `PokerStars Hand #234567890: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/15 14:45:12 ET
Table 'Adhafera IV' 6-Max Seat #1 is the button
Seat 1: Player1 ($112.30 in chips)
Seat 2: Hero ($100.00 in chips)
Seat 3: Player3 ($87.50 in chips)
Seat 4: Player4 ($134.20 in chips)
Seat 5: Player5 ($98.75 in chips)
Seat 6: Player6 ($72.40 in chips)
Player2: posts small blind $0.50
Player3: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Qh Jh]
Player4: folds
Player1: raises $2.50 to $3.00
Hero: calls $3.00
*** FLOP *** [Kd Tc 9s]
Hero: checks
Player1: bets $3.33
`;

describe("hand history parsing", () => {
  it("parses a PokerStars history into an analysable hand", () => {
    const result = parseHandHistory(POKERSTARS);
    expect(result.problems).toEqual([]);
    expect(result.format).toBe("pokerstars");
    expect(result.heroName).toBe("Hero");

    const parsed = result.hand!;
    expect(parsed.heroCards).toEqual(["Qh", "Jh"]);
    expect(parsed.board).toEqual(["Kd", "Tc", "9s"]);
    expect(parsed.heroPosition).toBe("SB"); // seat 2, one after the seat-1 button
    expect(validateHand(parsed)).toEqual([]);

    // Amounts are converted to big blinds from the stakes line.
    const villainBet = parsed.actions.find((a) => a.actor === "villain" && a.type === "bet");
    expect(villainBet?.amountBb).toBeCloseTo(3.33, 2);
    const heroCall = parsed.actions.find((a) => a.actor === "hero" && a.type === "call");
    expect(heroCall?.amountBb).toBeCloseTo(3, 2);
  });

  it("analyses what it parsed", () => {
    const parsed = parseHandHistory(POKERSTARS).hand!;
    const analysis = analyzeHand(parsed);
    expect(analysis.summary.heroCards).toBe("Q♥ J♥");
    expect(analysis.summary.street).toBe("flop");
  });

  it("refuses text that is not a hand history, and says what it accepts", () => {
    const result = parseHandHistory("I had aces and got stacked, was that bad?");
    expect(result.hand).toBeUndefined();
    expect(result.problems[0].message).toMatch(/PokerStars|GGPoker|manually/);
  });

  it("refuses empty input", () => {
    expect(parseHandHistory("   ").problems[0].message).toMatch(/paste a hand history/i);
  });

  it("reports the exact missing piece rather than guessing", () => {
    const noCards = POKERSTARS.replace("Dealt to Hero [Qh Jh]", "");
    const result = parseHandHistory(noCards);
    expect(result.hand).toBeUndefined();
    expect(result.undetermined.some((f) => f.field === "heroCards")).toBe(true);
    expect(result.undetermined.find((f) => f.field === "heroCards")!.message).toContain("Dealt to");
  });

  it("keeps everything it DID read when one field is missing", () => {
    // §6: one unreadable line must not cost the user their whole paste.
    const noCards = POKERSTARS.replace("Dealt to Hero [Qh Jh]", "");
    const result = parseHandHistory(noCards);
    expect(result.partial.board).toEqual(["Kd", "Tc", "9s"]);
    expect(result.partial.actions!.length).toBeGreaterThan(0);
    expect(result.parsed.some((f) => f.field === "board")).toBe(true);
  });

  it("does not invent a position when the seating cannot be read", () => {
    const noButton = POKERSTARS.replace("Seat #1 is the button", "");
    const result = parseHandHistory(noButton);
    // No complete hand, no guessed seat — but the cards and board survive.
    expect(result.hand).toBeUndefined();
    expect(result.partial.heroPosition).toBeUndefined();
    expect(result.partial.heroCards).toEqual(["Qh", "Jh"]);
    expect(result.undetermined.some((f) => f.field === "heroPosition")).toBe(true);
  });

  it("does not invent bet sizes when the stakes cannot be read", () => {
    const noStakes = POKERSTARS.replace("($0.50/$1.00 USD)", "").replace(
      "Player3: posts big blind $1.00",
      "",
    );
    const result = parseHandHistory(noStakes);
    expect(result.undetermined.some((f) => f.message.includes("big-blind size"))).toBe(true);
    // The actions are kept, but every one of them is sizeless rather than
    // carrying a number converted with a made-up big blind.
    expect(result.partial.actions!.every((a) => a.amountBb === undefined)).toBe(true);
  });

  it("attributes a malformed card to its line", () => {
    const badCard = POKERSTARS.replace("[Kd Tc 9s]", "[Kd Zz 9s]");
    const result = parseHandHistory(badCard);
    expect(result.problems.some((p) => p.line !== undefined && p.message.includes("Zz"))).toBe(true);
  });

  it("never returns a hand alongside problems", () => {
    // The contract that keeps a half-understood history from being analysed.
    for (const text of ["", "not a history", POKERSTARS.replace("Dealt to Hero [Qh Jh]", "")]) {
      const result = parseHandHistory(text);
      if (result.problems.length) expect(result.hand).toBeUndefined();
    }
  });
});

// ── AI Coach handoff (§16 integration) ───────────────────────────────────────

describe("AI Coach context", () => {
  const input = hand({
    heroCards: ["Ah", "Kh"],
    villainCards: ["Qs", "Qd"],
    board: ["Jh", "7h", "2c"],
    potBb: 10,
    effectiveStackBb: 100,
    actions: [{ street: "flop", actor: "villain", type: "bet", amountBb: 5 }],
  });

  it("carries the hand, the analysis and the way back", () => {
    const analysis = analyzeHand(input);
    const context = buildCoachHandContext(input, analysis, "/tools/poker-hand-analyzer?hc=AhKh");

    expect(context.source).toBe("hand_analyzer");
    expect(context.hand).toEqual(input);
    expect(context.analysis.verdict).toBe(analysis.verdict);
    expect(context.returnPath).toContain("/tools/poker-hand-analyzer");
    // The backend grounds its answer on this key — see coach_context.py.
    expect(context.concept_ids).toEqual(analysis.conceptIds);
    expect(context.concept_ids.length).toBeGreaterThan(0);
  });

  it("asks a question the coach can answer without a follow-up", () => {
    const question = coachOpeningQuestion(analyzeHand(input));
    expect(question).toContain("A♥ K♥");
    expect(question).toContain("BTN");
    expect(question.length).toBeGreaterThan(40);
  });

  it("round-trips a hand through a URL without losing it", () => {
    const query = encodeHandToQuery(input);
    const restored = decodeHandFromQuery(new URLSearchParams(query));

    expect(restored.heroPosition).toBe(input.heroPosition);
    expect(restored.heroCards).toEqual(input.heroCards);
    expect(restored.villainCards).toEqual(input.villainCards);
    expect(restored.board).toEqual(input.board);
    expect(restored.potBb).toBe(input.potBb);
    expect(restored.effectiveStackBb).toBe(input.effectiveStackBb);
    expect(restored.actions).toEqual(input.actions);

    // And the restored hand is still analysable — the round trip is the
    // feature, so a lossy encode would break the coach → analyser return.
    expect(validateHand(restored as HandInput)).toEqual([]);
  });

  it("omits what was never set rather than inventing defaults", () => {
    const minimal = hand();
    const restored = decodeHandFromQuery(new URLSearchParams(encodeHandToQuery(minimal)));
    expect(restored.potBb).toBeUndefined();
    expect(restored.villainCards).toBeUndefined();
    expect(restored.effectiveStackBb).toBeUndefined();
  });
});
