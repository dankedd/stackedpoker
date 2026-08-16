import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publishedEntries } from "@/lib/seo/content";
import { analyseHand, analyzeHand } from "../handAnalysis/analyze";
import { missingInformation, unknownsFor } from "../handAnalysis/completeness";
import {
  buildCoachHandContext,
  coachOpeningQuestion,
  decodeHandFromQuery,
  encodeHandToQuery,
} from "../handAnalysis/coachContext";
import { parseHandHistory } from "../handAnalysis/parse";
import {
  conceptRecommendations,
  DETECTABLE_CONCEPT_IDS,
  rankLessons,
  recommendationFor,
} from "../handAnalysis/recommendations";
import {
  filterSavedHands,
  handFromSavedRow,
  type SavedHandRow,
} from "../handAnalysis/savedHands";
import { classifyInput } from "../handAnalysis/validate";
import { isAnalysed, type HandInput } from "../handAnalysis/types";

/**
 * Regression cover for the product behaviour (§15), as opposed to the
 * arithmetic — which handAnalysis.test.ts already owns.
 *
 * Three groups, matching the three ways this feature can quietly break:
 * the STATE it decides an input is in, the FLOWS between surfaces, and the
 * RELEVANCE of what it recommends.
 */

const WIDGET = readFileSync(
  path.resolve(process.cwd(), "components/tools/PokerHandAnalyzer.tsx"),
  "utf8",
);

function hand(overrides: Partial<HandInput> = {}): HandInput {
  return {
    heroPosition: "BTN",
    heroCards: ["Ah", "Kh"],
    board: ["Qs", "7d", "2c"],
    actions: [],
    ...overrides,
  };
}

/** A spot with a price but no read on villain — the commonest real case. */
function needsReviewHand(): HandInput {
  return hand({
    potBb: 10,
    effectiveStackBb: 100,
    actions: [
      { street: "preflop", actor: "hero", type: "raise", amountBb: 2.5 },
      { street: "preflop", actor: "villain", type: "call", amountBb: 2.5 },
      { street: "flop", actor: "villain", type: "bet", amountBb: 6 },
    ],
  });
}

/** Both hands known and a price on the table — the maths can settle it. */
function decisiveHand(): HandInput {
  return { ...needsReviewHand(), villainCards: ["Qd", "Jc"], villainPosition: "BB" };
}

// ── Analysis states (§4) ─────────────────────────────────────────────────────

describe("the three input states are told apart", () => {
  it("a hand that cannot exist is invalid, not incomplete", () => {
    for (const impossible of [
      hand({ heroCards: ["Ah", "Ah"] }), // the same card twice
      hand({ board: ["Qs", "7d", "2c", "3h", "4h", "5h"] }), // six community cards
      hand({ heroCards: ["Ah", "Kh", "Qh"] }), // three hole cards
      hand({ board: [], actions: [{ street: "river", actor: "hero", type: "bet", amountBb: 5 }] }),
      hand({ effectiveStackBb: 0 }),
    ]) {
      expect(classifyInput(impossible), JSON.stringify(impossible)).toBe("invalid");
      const outcome = analyseHand(impossible);
      expect(isAnalysed(outcome)).toBe(false);
      expect(outcome.state).toBe("invalid");
      if (!isAnalysed(outcome)) expect(outcome.reasons[0]).toBeTruthy();
    }
  });

  it("a hand that is merely unfinished is incomplete, and is never called an error", () => {
    for (const unfinished of [
      hand({ heroCards: [] }),
      hand({ heroCards: ["Ah"] }),
      hand({ board: ["Qs"] }),
      hand({ villainCards: ["Qd"] }),
    ]) {
      expect(classifyInput(unfinished), JSON.stringify(unfinished)).toBe("incomplete");
      const outcome = analyseHand(unfinished);
      expect(outcome.state).toBe("incomplete");
    }
  });

  it("an impossible hand that is ALSO unfinished reports the impossibility first", () => {
    // Otherwise the user is sent off adding cards that will still collide.
    const both = hand({ heroCards: ["Ah"], board: ["Ah", "7d", "2c"] });
    expect(classifyInput(both)).toBe("invalid");
  });

  it("every incomplete state names a field that would finish it", () => {
    const outcome = analyseHand(hand({ heroCards: ["Ah"] }));
    expect(isAnalysed(outcome)).toBe(false);
    if (isAnalysed(outcome)) return;
    const blocking = outcome.missing.filter((item) => item.severity === "blocking");
    expect(blocking.map((item) => item.field)).toContain("heroCards");
    for (const item of outcome.missing) {
      expect(item.label, item.field).toBeTruthy();
      expect(item.unlocks, item.field).toBeTruthy();
    }
  });

  it("a complete hand is analyzable", () => {
    expect(classifyInput(decisiveHand())).toBe("analyzable");
    expect(isAnalysed(analyseHand(decisiveHand()))).toBe(true);
  });
});

// ── needs-review is still worth reading (§1) ─────────────────────────────────

describe("a needs-review result still teaches something", () => {
  const analysis = analyzeHand(needsReviewHand());

  it("does not pretend to a verdict it cannot support", () => {
    expect(analysis.verdict).toBe("needs-review");
  });

  it("still says what we know", () => {
    expect(analysis.facts.length).toBeGreaterThan(2);
    expect(analysis.facts.join(" ")).toContain("A♥ K♥");
  });

  it("still says what we can calculate", () => {
    const ids = analysis.calculations.map((c) => c.id);
    expect(ids).toContain("required-equity");
    expect(ids).toContain("mdf");
    expect(ids).toContain("spr");
    expect(ids).toContain("made-hand");
  });

  it("says what it cannot determine, and why, in structure not prose alone", () => {
    const equity = analysis.unknowns.find((u) => u.id === "equity");
    expect(equity).toBeTruthy();
    expect(equity!.because).toMatch(/Villain's cards are unknown/);
    expect(equity!.resolvedBy).toBe("villainCards");
  });

  it("separates gaps a user can close from gaps nobody can", () => {
    const resolvable = analysis.unknowns.filter((u) => u.resolvedBy);
    const inherent = analysis.unknowns.filter((u) => !u.resolvedBy);
    expect(resolvable.length).toBeGreaterThan(0);
    expect(inherent.length).toBeGreaterThan(0);
    // The inherent ones are the solver-shaped questions, and they must stay
    // unanswered rather than acquiring a "resolvedBy" that implies a setting.
    expect(inherent.map((u) => u.id)).toContain("villain-range");
    expect(inherent.map((u) => u.id)).toContain("optimal-frequency");
  });

  it("says what to investigate, from the reviewed registry", () => {
    expect(analysis.concepts.length).toBeGreaterThan(0);
    for (const concept of analysis.concepts) {
      expect(concept.explanation.length, concept.conceptId).toBeGreaterThan(20);
      expect(concept.trigger, concept.conceptId).toBeTruthy();
    }
  });

  it("offers the next input that would move the answer forward", () => {
    expect(analysis.missing.map((m) => m.field)).toContain("villainCards");
  });
});

// ── The "why" (§3) ───────────────────────────────────────────────────────────

describe("every analysis explains why, not just what", () => {
  it("names the decision the hand turns on", () => {
    const analysis = analyzeHand(needsReviewHand());
    expect(analysis.keyDecision.question).toMatch(/6bb bet on the flop/);
  });

  it("lists the factors with the bearing each one has", () => {
    const analysis = analyzeHand(decisiveHand());
    const labels = analysis.keyDecision.factors.map((f) => f.label);
    expect(labels).toContain("Your position");
    expect(labels).toContain("The price");
    expect(labels).toContain("Your equity");
    for (const factor of analysis.keyDecision.factors) {
      expect(factor.bearing.length, factor.label).toBeGreaterThan(30);
      expect(factor.value, factor.label).toBeTruthy();
    }
  });

  it("states the relationship between them, and admits where it runs out", () => {
    expect(analyzeHand(decisiveHand()).keyDecision.relationship).toMatch(/settle it/i);
    expect(analyzeHand(needsReviewHand()).keyDecision.relationship).toMatch(
      /solver this tool does not have/i,
    );
  });

  it("never claims a frequency, a range or an EV figure", () => {
    for (const input of [needsReviewHand(), decisiveHand(), hand()]) {
      const analysis = analyzeHand(input);
      const prose = [
        analysis.verdictBasis,
        analysis.keyDecision.question,
        analysis.keyDecision.relationship,
        ...analysis.keyDecision.factors.map((f) => f.bearing),
      ].join(" ");
      expect(prose, JSON.stringify(input)).not.toMatch(
        /\bGTO\b|\bsolver says\b|\bEV of\b|% of the time|optimal frequency is/i,
      );
    }
  });
});

// ── Flow: analyzer → coach → analyzer (§7) ───────────────────────────────────

describe("the AI Coach round trip preserves the hand", () => {
  const input = decisiveHand();
  const analysis = analyzeHand(input);
  const returnPath = `/tools/poker-hand-analyzer?${encodeHandToQuery(input)}`;
  const context = buildCoachHandContext(input, analysis, returnPath);

  it("carries the complete hand", () => {
    expect(context.hand).toEqual(input);
    expect(context.hand.board).toEqual(input.board);
    expect(context.hand.actions).toEqual(input.actions);
  });

  it("carries the analysis, the decision and the concepts", () => {
    expect(context.analysis.verdict).toBe(analysis.verdict);
    expect(context.analysis.keyDecision.question).toBe(analysis.keyDecision.question);
    expect(context.concept_ids).toEqual(analysis.conceptIds);
    expect(context.concept_ids.length).toBeGreaterThan(0);
  });

  it("carries a return path that restores the same hand", () => {
    const query = context.returnPath.split("?")[1];
    const restored = decodeHandFromQuery(new URLSearchParams(query));
    expect(restored.heroCards).toEqual(input.heroCards);
    expect(restored.villainCards).toEqual(input.villainCards);
    expect(restored.board).toEqual(input.board);
    expect(restored.actions).toEqual(input.actions);
    expect(restored.potBb).toBe(input.potBb);
    expect(restored.effectiveStackBb).toBe(input.effectiveStackBb);
    expect(restored.heroPosition).toBe(input.heroPosition);
  });

  it("re-analyses to the same verdict after the round trip", () => {
    const query = context.returnPath.split("?")[1];
    const restored = decodeHandFromQuery(new URLSearchParams(query)) as HandInput;
    expect(analyzeHand(restored).verdict).toBe(analysis.verdict);
  });

  it("opens the conversation on the decision the analyser named", () => {
    const question = coachOpeningQuestion(context.analysis);
    expect(question).toContain(analysis.summary.heroCards);
    expect(question.toLowerCase()).toContain("whether");
  });

  it("gives the coach page a way back", () => {
    const coachPage = readFileSync(path.resolve(process.cwd(), "app/coach/page.tsx"), "utf8");
    expect(coachPage).toContain("Back to hand analysis");
    expect(coachPage).toContain("handContext.returnPath");
  });
});

// ── Flow: paste → correct → analyse (§6) ─────────────────────────────────────

describe("a partially readable history is completed rather than discarded", () => {
  const HISTORY = `PokerStars Hand #250000001:  Hold'em No Limit ($0.50/$1.00 USD) - 2026/01/01 12:00:00 ET
Table 'Sirona' 6-max Seat #1 is the button
Seat 1: Player1 ($100.00 in chips)
Seat 2: Player2 ($100.00 in chips)
Seat 3: Player3 ($100.00 in chips)
Seat 4: Hero ($100.00 in chips)
Seat 5: Player5 ($100.00 in chips)
Seat 6: Player6 ($100.00 in chips)
Player2: posts small blind $0.50
Player3: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Qh Jh]
Hero: raises $2.50 to $3.00
Player3: calls $2.00
*** FLOP *** [Kd Tc 9s]
Player3: bets $3.33
Hero: calls $3.33
`;

  it("returns a complete hand when everything is present", () => {
    const result = parseHandHistory(HISTORY);
    expect(result.hand).toBeTruthy();
    expect(result.undetermined).toEqual([]);
    expect(result.parsed.map((f) => f.field)).toContain("heroCards");
  });

  it("keeps the board and the actions when the seating cannot be read", () => {
    const result = parseHandHistory(HISTORY.replace("Seat #1 is the button", ""));
    expect(result.hand).toBeUndefined();
    expect(result.partial.heroCards).toEqual(["Qh", "Jh"]);
    expect(result.partial.board).toEqual(["Kd", "Tc", "9s"]);
    expect(result.partial.actions!.length).toBeGreaterThan(2);
    expect(result.undetermined.map((f) => f.field)).toContain("heroPosition");
  });

  it("the completed hand then analyses normally", () => {
    const result = parseHandHistory(HISTORY.replace("Seat #1 is the button", ""));
    // What the user does next: pick a position from the control the report
    // points them at.
    const completed = { ...result.partial, heroPosition: "CO" } as HandInput;
    expect(classifyInput(completed)).toBe("analyzable");
    expect(analyzeHand(completed).summary.heroCards).toBe("Q♥ J♥");
  });

  it("still refuses text that is not a hand history at all", () => {
    const result = parseHandHistory("I had aces, was that bad?");
    expect(result.hand).toBeUndefined();
    expect(result.partial).toEqual({});
    expect(result.problems.length).toBeGreaterThan(0);
  });
});

// ── Flow: saved hand → reopen (§9) ───────────────────────────────────────────

describe("a saved hand reopens as the hand that was saved", () => {
  const input = decisiveHand();

  const row: SavedHandRow = {
    id: "row-1",
    analyzed_at: "2026-08-01T10:00:00Z",
    hero_position: input.heroPosition,
    hero_cards: input.heroCards,
    board: input.board,
    actions: input.actions,
    effective_stack_bb: input.effectiveStackBb ?? null,
    spot_classification: {
      street: "flop",
      potBb: input.potBb ?? null,
      villainPosition: input.villainPosition ?? null,
      villainCards: input.villainCards ?? null,
      source: "hand_analyzer",
    },
    findings: {
      verdict: "profitable-by-the-maths",
      confidence: "high",
      verdictBasis: "stored earlier",
      conceptIds: [],
      source: "hand_analyzer",
    },
  };

  it("rebuilds the exact input, villain and pot included", () => {
    expect(handFromSavedRow(row)).toEqual(input);
  });

  it("recomputes the analysis rather than replaying stored prose", () => {
    const restored = handFromSavedRow(row)!;
    const fresh = analyzeHand(restored);
    // The row's stored basis is deliberately nonsense; nothing may read it back
    // as the analysis.
    expect(fresh.verdictBasis).not.toBe(row.findings!.verdictBasis);
    expect(fresh.verdict).toBe(analyzeHand(input).verdict);
  });

  it("declines to reopen a row it cannot faithfully rebuild", () => {
    expect(handFromSavedRow({ ...row, hero_cards: null })).toBeNull();
    expect(handFromSavedRow({ ...row, hero_position: null })).toBeNull();
    expect(handFromSavedRow({ ...row, hero_cards: ["Ah"] })).toBeNull();
  });

  it("filters the list on anything visible in it", () => {
    const rows = [row, { ...row, id: "row-2", hero_cards: ["2c", "2d"], hero_position: "SB" }];
    expect(filterSavedHands(rows, "Ah").map((r) => r.id)).toEqual(["row-1"]);
    expect(filterSavedHands(rows, "SB").map((r) => r.id)).toEqual(["row-2"]);
    expect(filterSavedHands(rows, "")).toHaveLength(2);
    expect(filterSavedHands(rows, "nothing here")).toHaveLength(0);
  });

  it("stores villain and the pot, which the table has no columns for", () => {
    // The reason SavedSpot exists at all — losing these would make "reopen"
    // silently return a different hand from the one that was analysed.
    expect(row.spot_classification!.villainCards).toEqual(input.villainCards);
    expect(row.spot_classification!.potBb).toBe(input.potBb);
  });
});

// ── Flow: anonymous → signup (§10) ───────────────────────────────────────────

describe("the account CTA follows the value rather than gating it", () => {
  it("the analysis path has no auth check on it", () => {
    expect(WIDGET).not.toMatch(/if\s*\(\s*!user\s*\)[^}]*analyseHand/);
  });

  it("the CTA lives inside the result, not beside the form", () => {
    const ctaIndex = WIDGET.indexOf("Want to keep improving this decision?");
    const resultIndex = WIDGET.indexOf("function AnalysisResult");
    expect(ctaIndex).toBeGreaterThan(resultIndex);
  });

  it("the signup click is attributable", () => {
    expect(WIDGET).toContain("SEO_EVENTS.signupClicked");
  });

  it("saving is the first thing that asks for an account", () => {
    expect(WIDGET).toContain("Save this hand");
    expect(WIDGET).toMatch(/signedIn \?/);
  });
});

// ── Recommendations (§8) ─────────────────────────────────────────────────────

describe("recommendations are relevant and always reachable", () => {
  const published = new Set(publishedEntries().map((entry) => entry.path));
  const recommendations = conceptRecommendations([...DETECTABLE_CONCEPT_IDS]);

  it("never points at a route that is not published", () => {
    for (const [conceptId, recommendation] of Object.entries(recommendations)) {
      const links = [
        recommendation.wiki,
        recommendation.tool,
        ...recommendation.lessons,
      ].filter(Boolean) as { path: string }[];
      for (const link of links) {
        expect(published.has(link.path), `${conceptId} → ${link.path}`).toBe(true);
      }
      // The glossary link is a fragment on a letter page; the page itself is
      // what has to exist.
      if (recommendation.glossary) {
        expect(published.has(recommendation.glossary.path.split("#")[0])).toBe(true);
      }
    }
  });

  it("prefers a lesson that lists the concept exactly over one that merely overlaps", () => {
    for (const conceptId of DETECTABLE_CONCEPT_IDS) {
      const ranked = rankLessons(conceptId);
      if (ranked.length < 2) continue;
      const exact = ranked.filter((lesson) => lesson.concept_ids.includes(conceptId));
      if (!exact.length || exact.length === ranked.length) continue;
      const firstExact = ranked.findIndex((lesson) => lesson.concept_ids.includes(conceptId));
      const firstLoose = ranked.findIndex((lesson) => !lesson.concept_ids.includes(conceptId));
      expect(firstExact, conceptId).toBeLessThan(firstLoose);
    }
  });

  it("is deterministic — the same concept always resolves the same way", () => {
    for (const conceptId of DETECTABLE_CONCEPT_IDS) {
      expect(recommendationFor(conceptId)).toEqual(recommendationFor(conceptId));
    }
  });

  it("explains why the top lesson is the one on offer", () => {
    for (const recommendation of Object.values(recommendations)) {
      if (!recommendation.lessons.length) continue;
      expect(recommendation.reason, recommendation.conceptId).toBeTruthy();
    }
  });

  it("covers every concept the engine can actually detect", () => {
    // A new detection rule must not ship without somewhere to send the reader.
    const detected = new Set<string>();
    for (const input of [needsReviewHand(), decisiveHand(), hand(), hand({ actions: [] })]) {
      for (const id of analyzeHand(input).conceptIds) detected.add(id);
    }
    for (const id of detected) {
      expect(DETECTABLE_CONCEPT_IDS as readonly string[], id).toContain(id);
    }
  });
});

// ── Result hierarchy and accessibility (§2, §12) ─────────────────────────────

describe("the result is laid out conclusion-first", () => {
  it("renders the sections in the order the brief fixes", () => {
    // Scoped to the result component: the input form has its own "What
    // happened" label, and matching that one would compare the wrong things.
    const result = WIDGET.slice(WIDGET.indexOf("function AnalysisResult"));
    const order = [
      "Your decision",
      "Why?",
      "What happened",
      "What we can calculate",
      "What we cannot determine",
      "What to investigate",
      "Recommended next lesson",
      "Ask the AI Coach about this hand",
    ];
    let cursor = -1;
    for (const heading of order) {
      const index = result.indexOf(heading);
      expect(index, heading).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("puts the verdict in plain language for someone new to poker", () => {
    expect(WIDGET).toContain("VERDICT_PLAIN");
    expect(WIDGET).toMatch(/wins money over time/);
  });

  it("moves focus to the conclusion once an analysis lands", () => {
    expect(WIDGET).toContain("resultRef.current?.focus()");
    expect(WIDGET).toMatch(/tabIndex=\{-1\}/);
  });

  it("announces validation problems immediately", () => {
    const panel = readFileSync(path.resolve(process.cwd(), "components/tools/ToolPanel.tsx"), "utf8");
    expect(panel).toContain('role="alert"');
    expect(panel).toContain('aria-live="polite"');
  });

  it("labels every control the analyser adds", () => {
    // The action editor's selects have no visible label of their own.
    const labels = WIDGET.match(/aria-label=\{?`?Action \$\{index \+ 1\}/g) ?? [];
    expect(labels.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the primary action reachable on a phone", () => {
    expect(WIDGET).toMatch(/sticky bottom-2/);
  });
});

// ── Missing information is always actionable (§5) ────────────────────────────

describe("no limitation is a dead end", () => {
  it("every field the analyser wants has a label and a payoff", () => {
    for (const item of missingInformation(hand())) {
      expect(item.label, item.field).toMatch(/^Add /);
      expect(item.unlocks, item.field).toBeTruthy();
    }
  });

  it("asks for the turn once a flop is entered, and the river after that", () => {
    expect(missingInformation(hand({ board: ["Qs", "7d", "2c"] })).map((m) => m.label)).toContain(
      "Add the turn",
    );
    expect(
      missingInformation(hand({ board: ["Qs", "7d", "2c", "3h"] })).map((m) => m.label),
    ).toContain("Add the river");
    expect(missingInformation(hand({ board: [] })).map((m) => m.label)).toContain("Add the flop");
  });

  it("asks for nothing once a full board is in", () => {
    const full = missingInformation(hand({ board: ["Qs", "7d", "2c", "3h", "4d"] }));
    expect(full.map((m) => m.field)).not.toContain("board");
  });

  it("wires every resolvable unknown to a field the form actually has", () => {
    const fields = new Set(missingInformation(hand()).map((m) => m.field));
    fields.add("heroCards");
    for (const unknown of unknownsFor(hand(), { equity: false, price: false, board: true })) {
      if (!unknown.resolvedBy) continue;
      expect(fields, unknown.id).toContain(unknown.resolvedBy);
    }
  });

  it("the widget can focus every field an unknown can point at", () => {
    for (const field of [
      "heroCards",
      "heroPosition",
      "villainCards",
      "villainPosition",
      "board",
      "potBb",
      "effectiveStackBb",
      "actions",
    ]) {
      expect(WIDGET, field).toContain(`${field}:`);
    }
  });
});
