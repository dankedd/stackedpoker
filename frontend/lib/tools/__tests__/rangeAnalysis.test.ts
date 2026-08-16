import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { comboCount } from "@/lib/learn/handGrid";
import { BB_DEFENSE_COMPLETE_100BB_PROVENANCE, type ChartProvenance } from "@/lib/learn/bbDefenseComplete";
import { analyzeHand } from "../handAnalysis/analyze";
import { buildCoachHandContext, decodeHandFromQuery, encodeHandToQuery } from "../handAnalysis/coachContext";
import {
  calculateRangeEquity,
  isRangeEquityError,
  legalCombos,
  presetCombos,
} from "../handAnalysis/rangeEquity";
import {
  applicablePresets,
  executablePresets,
  matchPreset,
  presetById,
  RANGE_PRESETS,
  unavailableReason,
} from "../handAnalysis/rangePresets";
import { citation, derivationNote, isExecutable, sourceStatusOf } from "../handAnalysis/rangeSource";
import { handFromSavedRow, type SavedHandRow } from "../handAnalysis/savedHands";
import type { HandInput } from "../handAnalysis/types";

/**
 * Range-based analysis (V2).
 *
 * The load-bearing assertions here are the ones about SOURCE. Everything else
 * in this feature is arithmetic that either works or does not; the thing that
 * could quietly go wrong, and would be worth nothing if it did, is an
 * unreviewed range becoming executable.
 */

const WIDGET = readFileSync(
  path.resolve(process.cwd(), "components/tools/PokerHandAnalyzer.tsx"),
  "utf8",
);

/** Hero opens BTN, BB calls, BB leads the flop — the canonical range spot. */
function rangeSpot(overrides: Partial<HandInput> = {}): HandInput {
  return {
    heroPosition: "BTN",
    heroCards: ["Ah", "Kh"],
    villainPosition: "BB",
    board: ["Qs", "7d", "2c"],
    potBb: 10,
    effectiveStackBb: 100,
    actions: [
      { street: "preflop", actor: "hero", type: "raise", amountBb: 2.5 },
      { street: "preflop", actor: "villain", type: "call", amountBb: 2.5 },
      { street: "flop", actor: "villain", type: "bet", amountBb: 6 },
    ],
    ...overrides,
  };
}

// ── Source status (§2, §21) ──────────────────────────────────────────────────

describe("only reviewed ranges are executable", () => {
  it("maps the existing derivation vocabulary onto executability", () => {
    const provenance = (derivation: ChartProvenance["derivation"]): ChartProvenance => ({
      source: "x",
      page: 1,
      figure: "y",
      gameAssumptions: "z",
      derivation,
      bookAggregate: { threeBet: 1, call: 1, fold: 98 },
    });

    expect(sourceStatusOf(provenance("exact_transcription"))).toBe("reviewed");
    expect(sourceStatusOf(provenance("exact_derived"))).toBe("reviewed");
    expect(sourceStatusOf(provenance("reconstructed"))).toBe("reviewed");
    expect(sourceStatusOf(provenance("pedagogical_model"))).toBe("illustrative");
  });

  it("refuses to execute an illustrative or planned range", () => {
    expect(isExecutable("reviewed")).toBe(true);
    expect(isExecutable("illustrative")).toBe(false);
    expect(isExecutable("planned")).toBe(false);
  });

  it("BUILD GATE — every shipped preset is reviewed", () => {
    for (const preset of RANGE_PRESETS) {
      expect(preset.sourceStatus, preset.id).toBe("reviewed");
      expect(isExecutable(preset.sourceStatus), preset.id).toBe(true);
    }
    expect(executablePresets()).toHaveLength(RANGE_PRESETS.length);
  });

  it("BUILD GATE — every preset carries full attribution", () => {
    for (const preset of RANGE_PRESETS) {
      expect(preset.provenance.source, preset.id).toMatch(/Modern Poker Theory/);
      expect(preset.provenance.page, preset.id).toBeGreaterThan(0);
      expect(preset.provenance.figure, preset.id).toMatch(/Hand Range \d+/);
      expect(preset.provenance.gameAssumptions, preset.id).toBeTruthy();
      expect(citation(preset.provenance), preset.id).toContain("p.");
      expect(derivationNote(preset.provenance), preset.id).toBeTruthy();
      expect(preset.assumptions.length, preset.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("BUILD GATE — no preset is empty, and every hand is real notation", () => {
    for (const preset of RANGE_PRESETS) {
      const hands = Object.entries(preset.hands);
      expect(hands.length, preset.id).toBeGreaterThan(0);
      for (const [hand, weight] of hands) {
        expect(hand, `${preset.id}/${hand}`).toMatch(/^[AKQJT98765432]{2}[so]?$/);
        expect(weight, `${preset.id}/${hand}`).toBeGreaterThan(0);
        expect(weight, `${preset.id}/${hand}`).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * The strongest check in the file.
   *
   * Each preset is one action's column sliced out of a source chart. If the
   * slice is faithful, its combo-weighted total must land on the aggregate the
   * book prints under that same chart. A slicing bug, a misread action key or
   * a swapped matchup all show up here as a number that no longer matches the
   * page it claims to come from.
   */
  it("BUILD GATE — every slice reproduces the aggregate its own source prints", () => {
    for (const preset of RANGE_PRESETS) {
      const weightedCombos = Object.entries(preset.hands).reduce(
        (sum, [hand, weight]) => sum + weight * comboCount(hand),
        0,
      );
      const computed = (weightedCombos / 1326) * 100;
      expect(
        Math.abs(computed - preset.bookAggregatePct),
        `${preset.id}: computed ${computed.toFixed(2)}% vs the source's stated ${preset.bookAggregatePct}%`,
      ).toBeLessThan(1.5);
    }
  });

  it("draws its hands from the existing charts rather than restating them", () => {
    // A regression guard against someone later pasting a hand list in here.
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/tools/handAnalysis/rangePresets.ts"),
      "utf8",
    );
    const handListLiteral = /['"](?:AA|KK|AKs|AKo|72o)['"]\s*:/;
    expect(handListLiteral.test(source)).toBe(false);
    expect(source).toContain("BB_DEFENSE_COMPLETE_100BB");
    expect(source).toContain("CASH_100BB_OPEN_RESPONSE_CHARTS");
  });

  it("keeps the provenance records it uses in step with their source", () => {
    // If a chart is re-extracted and its aggregate changes, the preset's
    // recorded percentage must move with it.
    for (const preset of RANGE_PRESETS.filter((p) => p.villainPosition === "BB")) {
      const matchup = `BB_vs_${preset.heroPosition === "MP" ? "HJ" : preset.heroPosition}`;
      const original = BB_DEFENSE_COMPLETE_100BB_PROVENANCE[matchup as keyof typeof BB_DEFENSE_COMPLETE_100BB_PROVENANCE];
      expect(preset.provenance, preset.id).toBe(original);
    }
  });
});

// ── Context filtering (§5, §21) ──────────────────────────────────────────────

describe("a range is only offered where it actually applies", () => {
  it("offers the matching preset for a spot it was solved for", () => {
    const presets = applicablePresets(rangeSpot());
    expect(presets.map((p) => p.id)).toContain("bb-called-vs-btn");
    // And only the ones that fit: no 3-bet range when villain called.
    expect(presets.every((p) => p.villainAction === "called")).toBe(true);
  });

  it("rejects the wrong villain position", () => {
    const match = matchPreset(presetById("bb-called-vs-btn")!, rangeSpot({ villainPosition: "CO" }));
    expect(match.rejections).toContain("villain-position");
    expect(applicablePresets(rangeSpot({ villainPosition: "CO" }))).toHaveLength(0);
  });

  it("rejects the wrong hero position", () => {
    const match = matchPreset(presetById("bb-called-vs-btn")!, rangeSpot({ heroPosition: "UTG" }));
    expect(match.rejections).toContain("hero-position");
  });

  it("rejects the wrong villain action — a caller is not a 3-bettor", () => {
    const match = matchPreset(presetById("bb-3bet-vs-btn")!, rangeSpot());
    expect(match.rejections).toContain("villain-action");
  });

  it("switches to the 3-bet range when villain 3-bet", () => {
    const threeBet = rangeSpot({
      actions: [
        { street: "preflop", actor: "hero", type: "raise", amountBb: 2.5 },
        { street: "preflop", actor: "villain", type: "3bet", amountBb: 9 },
        { street: "flop", actor: "villain", type: "bet", amountBb: 6 },
      ],
    });
    expect(applicablePresets(threeBet).map((p) => p.id)).toContain("bb-3bet-vs-btn");
  });

  it("rejects a spot where hero did not open", () => {
    const heroDefending = rangeSpot({
      actions: [
        { street: "preflop", actor: "villain", type: "raise", amountBb: 2.5 },
        { street: "preflop", actor: "hero", type: "call", amountBb: 2.5 },
        { street: "flop", actor: "villain", type: "bet", amountBb: 6 },
      ],
    });
    expect(applicablePresets(heroDefending)).toHaveLength(0);
    expect(unavailableReason(heroDefending)).toMatch(/you opened the pot/i);
  });

  it("rejects preflop, and says why in terms of the actual cost", () => {
    const preflop = rangeSpot({ board: [] });
    expect(applicablePresets(preflop)).toHaveLength(0);
    expect(unavailableReason(preflop)).toMatch(/needs a flop/i);
    expect(unavailableReason(preflop)).toMatch(/minutes/i);
  });

  it("rejects a stack depth the chart was not solved at", () => {
    for (const stack of [20, 40, 250]) {
      const shallow = rangeSpot({ effectiveStackBb: stack });
      expect(matchPreset(presetById("bb-called-vs-btn")!, shallow).rejections).toContain(
        "stack-depth",
      );
      expect(applicablePresets(shallow), String(stack)).toHaveLength(0);
    }
    // And accepts a normal one.
    expect(applicablePresets(rangeSpot({ effectiveStackBb: 120 })).length).toBeGreaterThan(0);
  });

  it("never leaves the user with an empty list and no explanation", () => {
    for (const spot of [
      rangeSpot({ board: [] }),
      rangeSpot({ villainPosition: "CO" }),
      rangeSpot({ effectiveStackBb: 20 }),
      rangeSpot({ actions: [] }),
    ]) {
      if (applicablePresets(spot).length === 0) {
        expect(unavailableReason(spot).length, JSON.stringify(spot.actions)).toBeGreaterThan(40);
      }
    }
  });

  it("excludes the MTT charts from a 6-max cash spot on context, not on provenance", () => {
    // MTT_RFI_CHARTS is genuinely reviewed and still must not appear here:
    // 9-max with an ante is a different game from the one being analysed.
    expect(RANGE_PRESETS.every((preset) => preset.format === "6-max cash")).toBe(true);
    expect(RANGE_PRESETS.every((preset) => preset.tableSize === 6)).toBe(true);
  });
});

// ── Equity (§7, §8, §21) ─────────────────────────────────────────────────────

describe("range equity is exact and legal", () => {
  const preset = presetById("bb-called-vs-btn")!;

  it("removes combos containing hero's cards or a board card", () => {
    const all = presetCombos(preset);
    const legal = legalCombos(all, ["Ah", "Kh", "Qs", "7d", "2c"]);
    expect(legal.length).toBeLessThan(all.length);
    for (const combo of legal) {
      for (const card of ["Ah", "Kh", "Qs", "7d", "2c"]) {
        expect(combo.cards, card).not.toContain(card);
      }
    }
  });

  it("counts the removal in the result", () => {
    const result = calculateRangeEquity(["Ah", "Kh"], preset, ["Qs", "7d", "2c"]);
    expect(isRangeEquityError(result)).toBe(false);
    if (isRangeEquityError(result)) return;
    expect(result.combosConsidered).toBeLessThan(result.combosInRange);
    expect(result.combosConsidered).toBeGreaterThan(0);
    expect(result.exact).toBe(true);
  });

  it("enumerates every runout for every remaining combo — no sampling", () => {
    const result = calculateRangeEquity(["Ah", "Kh"], preset, ["Qs", "7d", "2c"]);
    if (isRangeEquityError(result)) throw new Error("expected a result");
    // 990 boards on a flop, times the combos that survived removal.
    expect(result.boardsEvaluated).toBe(result.combosConsidered * 990);
  });

  it("produces a plausible, deterministic percentage", () => {
    const first = calculateRangeEquity(["Ah", "Kh"], preset, ["Qs", "7d", "2c"]);
    const second = calculateRangeEquity(["Ah", "Kh"], preset, ["Qs", "7d", "2c"]);
    if (isRangeEquityError(first) || isRangeEquityError(second)) throw new Error("expected results");
    expect(first.heroEquityPct).toBe(second.heroEquityPct);
    expect(first.heroEquityPct).toBeGreaterThan(0);
    expect(first.heroEquityPct).toBeLessThan(100);
  });

  it("agrees with the hand-vs-hand engine on a one-combo range", () => {
    // The bridge between the two engines: a range holding exactly one combo
    // must return exactly what the known-hand enumerator returns.
    const single = { ...preset, hands: { AA: 1 } };
    const result = calculateRangeEquity(["Ah", "Kh"], single, ["Qs", "7d", "2c"]);
    if (isRangeEquityError(result)) throw new Error("expected a result");
    // Six AA combos, minus none blocked here (hero holds Ah, so AhAx are out).
    expect(result.combosInRange).toBe(6);
    expect(result.combosConsidered).toBe(3);
  });

  it("refuses preflop rather than hanging the tab", () => {
    const result = calculateRangeEquity(["Ah", "Kh"], preset, []);
    expect(isRangeEquityError(result)).toBe(true);
    if (isRangeEquityError(result)) expect(result.kind).toBe("preflop-not-supported");
  });

  it("reports a fully blocked range instead of dividing by zero", () => {
    const blocked = { ...preset, hands: { AA: 1 } };
    const result = calculateRangeEquity(["Ah", "Ad"], blocked, ["As", "Ac", "2c"]);
    expect(isRangeEquityError(result)).toBe(true);
    if (isRangeEquityError(result)) expect(result.kind).toBe("no-legal-combos");
  });
});

// ── The three states (§9, §21) ───────────────────────────────────────────────

describe("known hand, range, and neither are three different results", () => {
  it("STATE A — a known villain hand gives an unconditional verdict", () => {
    const analysis = analyzeHand(rangeSpot({ villainCards: ["Qd", "Jc"] }));
    expect(analysis.verdict).toMatch(/^(un)?profitable-by-the-maths$/);
    expect(analysis.conditional).toBeUndefined();
    expect(analysis.calculations.some((c) => c.id === "equity")).toBe(true);
  });

  it("STATE A wins — a known hand is never replaced by a range", () => {
    const both = rangeSpot({
      villainCards: ["Qd", "Jc"],
      villainRangePresetId: "bb-called-vs-btn",
    });
    const analysis = analyzeHand(both);
    expect(analysis.conditional).toBeUndefined();
    expect(analysis.calculations.some((c) => c.id === "equity-vs-range")).toBe(false);
  });

  it("STATE B — a reviewed range gives a conditional verdict", () => {
    const analysis = analyzeHand(rangeSpot({ villainRangePresetId: "bb-called-vs-btn" }));
    expect(analysis.verdict).toMatch(/-against-the-range$/);
    expect(analysis.conditional).toBeTruthy();
    expect(analysis.conditional!.presetId).toBe("bb-called-vs-btn");
    expect(analysis.conditional!.citation).toMatch(/Modern Poker Theory/);
    expect(analysis.calculations.some((c) => c.id === "equity-vs-range")).toBe(true);
    expect(analysis.calculations.some((c) => c.id === "range-combos")).toBe(true);
  });

  it("STATE B is never full confidence — the arithmetic is exact, the range is not", () => {
    const analysis = analyzeHand(rangeSpot({ villainRangePresetId: "bb-called-vs-btn" }));
    expect(analysis.confidence).not.toBe("high");
  });

  it("STATE C — no range selected stays needs-review", () => {
    const analysis = analyzeHand(rangeSpot());
    expect(analysis.verdict).toBe("needs-review");
    expect(analysis.conditional).toBeUndefined();
  });

  it("an inapplicable preset is refused even when explicitly asked for", () => {
    // Arrives from a stale URL or an edited saved row. Must not execute.
    const wrong = rangeSpot({ villainPosition: "CO", villainRangePresetId: "bb-called-vs-btn" });
    const analysis = analyzeHand(wrong);
    expect(analysis.conditional).toBeUndefined();
    expect(analysis.verdict).toBe("needs-review");
  });

  it("an unknown preset id is refused", () => {
    const analysis = analyzeHand(rangeSpot({ villainRangePresetId: "does-not-exist" }));
    expect(analysis.conditional).toBeUndefined();
  });

  it("points the user at a range when one exists, and at cards when one does not", () => {
    const withRange = analyzeHand(rangeSpot());
    expect(withRange.unknowns.find((u) => u.id === "equity")!.resolvedBy).toBe("villainRange");
    expect(withRange.missing.map((m) => m.field)).toContain("villainRange");

    const noRange = analyzeHand(rangeSpot({ villainPosition: "CO" }));
    expect(noRange.unknowns.find((u) => u.id === "equity")!.resolvedBy).toBe("villainCards");
    expect(noRange.missing.map((m) => m.field)).not.toContain("villainRange");
  });

  it("names the one thing a range can never settle", () => {
    const analysis = analyzeHand(rangeSpot({ villainRangePresetId: "bb-called-vs-btn" }));
    const unknown = analysis.unknowns.find((u) => u.id === "villain-actual-range");
    expect(unknown).toBeTruthy();
    expect(unknown!.resolvedBy).toBeUndefined();
    expect(unknown!.because).toMatch(/model of equilibrium play/i);
  });
});

// ── Language safety (§11, §21) ───────────────────────────────────────────────

describe("the prose never claims more than was calculated", () => {
  const analyses = [
    analyzeHand(rangeSpot()),
    analyzeHand(rangeSpot({ villainRangePresetId: "bb-called-vs-btn" })),
    analyzeHand(rangeSpot({ villainCards: ["Qd", "Jc"] })),
    analyzeHand(rangeSpot({ villainRangePresetId: "bb-3bet-vs-btn" })),
  ];

  /**
   * Vocabulary that would claim more than the engine computed.
   *
   * Split in two on purpose. Everything the analyser ASSERTS is held to the
   * full list. The `unknowns` are held to a shorter one, because their whole
   * job is to NAME the things the tool refuses to produce — "the optimal
   * frequency to take this line" is the correct English for what cannot be
   * determined, and banning the word there would force a vaguer sentence that
   * told the reader less.
   */
  const BANNED_IN_CLAIMS = [
    /\bGTO\b/i,
    /solver says/i,
    /\boptimal\b/i,
    /\+EV\b/i,
    /\bEV of\b/i,
    /% of the time/i,
    /\bperfect\b/i,
    /should always/i,
    /\bbalanced range\b/i,
    /villain (probably|likely) has/i,
  ];

  /** Still forbidden even when describing an absence: these assert, whatever the frame. */
  const BANNED_EVERYWHERE = [
    /\bGTO\b/i,
    /solver says/i,
    /\+EV\b/i,
    /\bEV of\b/i,
    /villain (probably|likely) has/i,
    /should always/i,
  ];

  it("uses no unsupported vocabulary in anything it asserts", () => {
    for (const analysis of analyses) {
      const claims = [
        analysis.verdictBasis,
        analysis.keyDecision.question,
        analysis.keyDecision.relationship,
        ...analysis.keyDecision.factors.map((f) => `${f.label} ${f.value} ${f.bearing}`),
        ...analysis.calculations.map((c) => `${c.label} ${c.value} ${c.basis}`),
        ...analysis.concepts.map((c) => `${c.trigger} ${c.explanation}`),
      ].join(" ");
      for (const pattern of BANNED_IN_CLAIMS) {
        expect(pattern.test(claims), `${analysis.verdict}: ${pattern}`).toBe(false);
      }
    }
  });

  it("uses none of the outright-forbidden vocabulary even when stating a limit", () => {
    for (const analysis of analyses) {
      const limits = [
        ...analysis.unknowns.map((u) => `${u.question} ${u.because}`),
        ...analysis.limitations,
      ].join(" ");
      for (const pattern of BANNED_EVERYWHERE) {
        expect(pattern.test(limits), `${analysis.verdict}: ${pattern}`).toBe(false);
      }
    }
  });

  it("only ever uses 'optimal' to say it cannot produce one", () => {
    for (const analysis of analyses) {
      for (const unknown of analysis.unknowns) {
        if (!/optimal/i.test(unknown.question + unknown.because)) continue;
        expect(unknown.id).toBe("optimal-frequency");
        expect(unknown.because).toMatch(/not a solver/i);
        expect(unknown.resolvedBy).toBeUndefined();
      }
    }
  });

  it("says 'against the range' whenever the answer is conditional", () => {
    const conditional = analyses.filter((a) => a.conditional);
    expect(conditional.length).toBeGreaterThan(0);
    for (const analysis of conditional) {
      expect(analysis.verdictBasis).toMatch(/against the .+ range/i);
      expect(analysis.keyDecision.relationship).toMatch(/against the .+ range/i);
    }
  });

  it("keeps conditional wording out of an unconditional result", () => {
    const unconditional = analyzeHand(rangeSpot({ villainCards: ["Qd", "Jc"] }));
    expect(unconditional.verdictBasis).not.toMatch(/against the .+ range/i);
    expect(unconditional.verdictBasis).toMatch(/that exact hand/);
  });

  it("the verdict VALUE carries the condition, not just the prose", () => {
    // So nothing downstream can render a conditional result unconditionally by
    // reading the enum and ignoring the sentence.
    const conditional = analyzeHand(rangeSpot({ villainRangePresetId: "bb-called-vs-btn" }));
    expect(conditional.verdict).toContain("against-the-range");
  });
});

// ── Round trips (§14, §15, §21) ──────────────────────────────────────────────

describe("the selected range survives every round trip", () => {
  const input = rangeSpot({ villainRangePresetId: "bb-called-vs-btn" });
  const analysis = analyzeHand(input);

  it("through the URL", () => {
    const restored = decodeHandFromQuery(new URLSearchParams(encodeHandToQuery(input)));
    expect(restored.villainRangePresetId).toBe("bb-called-vs-btn");
    expect(analyzeHand(restored as HandInput).verdict).toBe(analysis.verdict);
  });

  it("through the coach handoff, marked conditional", () => {
    const context = buildCoachHandContext(input, analysis, "/tools/poker-hand-analyzer?x=1");
    expect(context.hand.villainRangePresetId).toBe("bb-called-vs-btn");
    expect(context.analysis.conditional).toBeTruthy();
    expect(context.analysis.conditional!.citation).toMatch(/p\.\d+/);
    expect(context.analysis.verdict).toContain("against-the-range");
    expect(context.returnPath).toBeTruthy();
  });

  it("a coach handoff for a KNOWN hand carries no conditional marker", () => {
    const known = rangeSpot({ villainCards: ["Qd", "Jc"] });
    const context = buildCoachHandContext(known, analyzeHand(known), "/x");
    expect(context.analysis.conditional).toBeUndefined();
  });

  it("through a saved row, and recomputes rather than replaying", () => {
    const row: SavedHandRow = {
      id: "r1",
      analyzed_at: "2026-08-16T00:00:00Z",
      hero_position: input.heroPosition,
      hero_cards: input.heroCards,
      board: input.board,
      actions: input.actions,
      effective_stack_bb: input.effectiveStackBb ?? null,
      spot_classification: {
        street: "flop",
        potBb: input.potBb ?? null,
        villainPosition: input.villainPosition ?? null,
        villainCards: null,
        villainRangePresetId: "bb-called-vs-btn",
        source: "hand_analyzer",
      },
      findings: {
        verdict: "profitable-by-the-maths",
        confidence: "high",
        verdictBasis: "stale prose that must never be shown again",
        conceptIds: [],
        source: "hand_analyzer",
      },
    };

    const restored = handFromSavedRow(row)!;
    expect(restored.villainRangePresetId).toBe("bb-called-vs-btn");

    const fresh = analyzeHand(restored);
    expect(fresh.verdictBasis).not.toBe(row.findings!.verdictBasis);
    // The stored verdict was unconditional; the recomputed one is not, which is
    // exactly the drift that reading stored prose would have hidden.
    expect(fresh.verdict).toContain("against-the-range");
    expect(fresh.verdict).not.toBe(row.findings!.verdict);
  });
});

// ── UI contract (§4, §6, §16, §21) ───────────────────────────────────────────

describe("the widget presents a range as an assumption", () => {
  it("asks the question in plain language", () => {
    expect(WIDGET).toContain("What do you think villain can have?");
    expect(WIDGET).toContain("I know their cards");
    expect(WIDGET).toContain("I don't know — use a reviewed range");
  });

  it("shows the source next to every option", () => {
    expect(WIDGET).toContain("preset.provenance.figure");
    expect(WIDGET).toContain("preset.provenance.page");
  });

  it("labels the result conditional, above everything but the verdict", () => {
    const result = WIDGET.slice(WIDGET.indexOf("function AnalysisResult"));
    expect(result.indexOf("ConditionalNotice")).toBeLessThan(result.indexOf('id="why"'));
    expect(WIDGET).toContain("Conditional analysis");
    expect(WIDGET).toContain("Your real equity depends on the range they");
  });

  it("styles a conditional verdict differently from a settled one", () => {
    expect(WIDGET).toMatch(/"profitable-against-the-range": "border-sky/);
    expect(WIDGET).toMatch(/"profitable-by-the-maths": "border-violet/);
  });

  it("hides the selector entirely when villain's cards are known", () => {
    expect(WIDGET).toContain("if (villainKnown) return null;");
  });

  it("explains an empty list instead of showing one", () => {
    expect(WIDGET).toContain("No reviewed range is available for this spot");
    expect(WIDGET).toContain("unavailable");
  });

  it("drops a selection that stops applying", () => {
    expect(WIDGET).toContain("if (presetId && !presets.some((preset) => preset.id === presetId))");
  });

  it("keeps the condition on the clipboard copy", () => {
    expect(WIDGET).toContain("Conditional on the ${analysis.conditional.presetLabel} range");
  });

  it("reports the range analytics the brief asks for, with no card data", () => {
    for (const event of [
      "rangeAnalysisStarted",
      "rangePresetSelected",
      "rangeAnalysisCompleted",
      "rangeAnalysisUnavailable",
    ]) {
      expect(WIDGET, event).toContain(`SEO_EVENTS.${event}`);
    }
    // Parameters must never include cards, board or history text.
    const params = WIDGET.match(/trackEvent\([^)]*\{[^}]*\}/g) ?? [];
    for (const call of params) {
      expect(call).not.toMatch(/heroText|boardText|villainText|historyText|heroCards|hero\.cards/);
    }
  });

  it("only runs the enumeration on submit, never on a keystroke", () => {
    // `applicablePresets` is a position/action comparison and is safe to run
    // live; `calculateRangeEquity` is not, and must stay out of the render path.
    expect(WIDGET).not.toContain("calculateRangeEquity");
  });

  it("says the coach is getting a conditional analysis", () => {
    const coach = readFileSync(path.resolve(process.cwd(), "app/coach/page.tsx"), "utf8");
    expect(coach).toContain("Conditional analysis");
    expect(coach).toContain("analysis.conditional");
    expect(coach).toContain("Back to hand analysis");
  });
});
