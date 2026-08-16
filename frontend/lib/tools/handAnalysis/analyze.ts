import { classifyFlop } from "@/lib/learn/flopClassifier";
import { conceptExplainer, firstSentence } from "@/lib/seo/content/concepts";
import {
  alpha,
  classifySPR,
  computeSPR,
  drawProbabilityByRiver,
  mdf,
  requiredEquityFromPot,
} from "@/lib/theory/math";
import { formatCards, type Card } from "../cards";
import { calculateEquity, validateEquityInput } from "../equity";
import { evaluateHand } from "../handEvaluator";
import { positionById, type PositionId } from "../positions";
import { missingInformation, unknownsFor } from "./completeness";
import { calculateRangeEquity, isRangeEquityError } from "./rangeEquity";
import { applicablePresets, matchPreset, presetById } from "./rangePresets";
import { citation, derivationNote } from "./rangeSource";
import { blockingIssues, classifyInput, streetForBoard, validateHand } from "./validate";
import type {
  AnalysisOutcome,
  Calculation,
  ConditionalRange,
  Confidence,
  DecisionFactor,
  DetectedConcept,
  HandAction,
  HandAnalysis,
  HandInput,
  KeyDecision,
  Verdict,
} from "./types";

/**
 * The analysis engine.
 *
 * Three tiers, never mixed:
 *
 *  FACTS         — restatements of the input. Always safe.
 *  CALCULATIONS  — produced ONLY by lib/theory/math.ts, lib/tools/equity.ts and
 *                  lib/tools/handEvaluator.ts, the maths the lessons already
 *                  run on. Each one records the formula it came from.
 *  CONCEPTS      — quoted verbatim from lib/theory/concepts.json. Detection
 *                  decides WHICH concept applies, from facts about the hand;
 *                  the explanation is the registry's own words.
 *
 * What it will not do: invent a range, a frequency, an EV figure or a solver
 * output. A verdict is emitted only where arithmetic settles the question —
 * which, in practice, means both hands are known. Everywhere else the verdict
 * is `needs-review` or `insufficient-information`, and `limitations` says why.
 * That is the honest ceiling for a tool with no solver behind it.
 */

const STREET_ORDER = ["preflop", "flop", "turn", "river"] as const;

function lastAction(actions: HandAction[], actor?: "hero" | "villain"): HandAction | undefined {
  const filtered = actor ? actions.filter((a) => a.actor === actor) : actions;
  return filtered.at(-1);
}

const AGGRESSIVE: string[] = ["bet", "raise", "3bet", "4bet", "allin"];

/**
 * The last bet villain put in — the price hero is being laid.
 *
 * "Last" rather than "unanswered": a hand entered after the fact usually
 * includes hero's response, and the price that response was getting is still
 * exactly the number the analysis is about.
 */
function facingBet(actions: HandAction[]): HandAction | undefined {
  return actions.filter((a) => a.actor === "villain" && AGGRESSIVE.includes(a.type)).at(-1);
}

function describeAction(action: HandAction): string {
  const amount = action.amountBb !== undefined ? ` ${action.amountBb}bb` : "";
  const label: Record<string, string> = {
    fold: "folds",
    check: "checks",
    call: "calls",
    bet: "bets",
    raise: "raises",
    "3bet": "3-bets",
    "4bet": "4-bets",
    allin: "moves all in",
  };
  return `${action.actor === "hero" ? "Hero" : "Villain"} ${label[action.type]}${amount} on the ${action.street}`;
}

// ── Concept detection ────────────────────────────────────────────────────────

/**
 * Which reviewed concepts this hand exercises.
 *
 * Every rule fires on a FACT about the hand (a bet larger than the pot, a
 * monotone flop, an out-of-position hero), never on a judgement. The concept's
 * explanation then comes from the registry — this function never writes one.
 */
function detectConcepts(input: HandInput): DetectedConcept[] {
  const triggers: { conceptId: string; trigger: string }[] = [];
  const facing = facingBet(input.actions);
  const heroAction = lastAction(input.actions, "hero");
  const heroSeat = positionById(input.heroPosition as PositionId);

  // Position applies to every hand, and is the one concept a beginner can act
  // on immediately.
  triggers.push({
    conceptId: "position_value",
    trigger: heroSeat.inPositionPostflop
      ? `Hero is on the ${input.heroPosition}, last to act after the flop.`
      : `Hero is in the ${input.heroPosition} and acts before the button after the flop.`,
  });

  if (facing) {
    triggers.push({
      conceptId: "mdf",
      trigger: `Hero faces a ${facing.type}${facing.amountBb ? ` of ${facing.amountBb}bb` : ""}.`,
    });
    triggers.push({
      conceptId: "alpha",
      trigger: "A bet sets the fold frequency it needs to break even as a bluff.",
    });

    if (facing.amountBb !== undefined && input.potBb !== undefined && facing.amountBb > input.potBb) {
      triggers.push({
        conceptId: "overbet",
        trigger: `The bet of ${facing.amountBb}bb is larger than the ${input.potBb}bb pot.`,
      });
    }
  }

  if (
    heroAction &&
    ["bet", "raise"].includes(heroAction.type) &&
    heroAction.street === "flop" &&
    input.actions.some((a) => a.actor === "hero" && a.street === "preflop" && ["raise", "3bet", "4bet"].includes(a.type))
  ) {
    triggers.push({
      conceptId: "cbet_theory",
      trigger: "Hero raised preflop and bet the flop — a continuation bet.",
    });
  }

  if (input.board.length >= 3) {
    const flop = classifyFlop([input.board[0], input.board[1], input.board[2]] as [string, string, string]);
    if (flop.texture === "monotone") {
      triggers.push({
        conceptId: "cbet_theory",
        trigger: "The flop is monotone — three cards of one suit.",
      });
    }
    if (flop.structure === "paired") {
      triggers.push({ conceptId: "equity_bucket", trigger: "The board is paired." });
    }
  }

  if (input.effectiveStackBb !== undefined && input.potBb !== undefined && input.potBb > 0) {
    triggers.push({
      conceptId: "spr_theory",
      trigger: `Effective stack ${input.effectiveStackBb}bb into a ${input.potBb}bb pot.`,
    });
  }

  // Dedupe on concept id, keeping the first (most specific) trigger, then
  // resolve each against the registry. A concept with no registry entry is
  // dropped rather than explained by this file.
  const seen = new Set<string>();
  const concepts: DetectedConcept[] = [];
  for (const { conceptId, trigger } of triggers) {
    if (seen.has(conceptId)) continue;
    seen.add(conceptId);
    const explainer = conceptExplainer(conceptId);
    if (!explainer) continue;
    concepts.push({
      conceptId,
      name: explainer.name,
      trigger,
      explanation: firstSentence(explainer.beginner),
    });
  }
  return concepts;
}

// ── The "why" (§3) ───────────────────────────────────────────────────────────

const ACTION_NOUN: Record<string, string> = {
  bet: "bet",
  raise: "raise",
  "3bet": "3-bet",
  "4bet": "4-bet",
  allin: "all-in",
};

/**
 * The question the hand actually turns on.
 *
 * Named from the action sequence, never from a judgement about it: "whether to
 * call villain's 6bb bet on the turn" is a restatement, and the user should
 * recognise their own spot in it before reading a word of analysis.
 */
function keyDecisionQuestion(input: HandInput, street: string): string {
  const facing = facingBet(input.actions);
  const heroAction = lastAction(input.actions, "hero");

  if (facing) {
    const size = facing.amountBb !== undefined ? `${facing.amountBb}bb ` : "";
    const noun = ACTION_NOUN[facing.type] ?? facing.type;
    // If hero already responded, the decision under review is that response.
    const responded =
      heroAction && input.actions.indexOf(heroAction) > input.actions.indexOf(facing);
    return responded
      ? `Whether ${heroAction.type === "fold" ? "folding" : `${heroAction.type}ing`} villain's ${size}${noun} on the ${facing.street} was right.`
      : `Whether to call villain's ${size}${noun} on the ${facing.street}.`;
  }

  if (heroAction && AGGRESSIVE.includes(heroAction.type)) {
    const size = heroAction.amountBb !== undefined ? ` for ${heroAction.amountBb}bb` : "";
    return `Whether ${heroAction.type === "bet" ? "betting" : "raising"} the ${heroAction.street}${size} was the right move.`;
  }

  if (input.actions.length === 0) {
    return `What ${formatCards(input.heroCards)} in the ${input.heroPosition} is worth on this ${street}.`;
  }

  return `Whether the line hero took to the ${street} holds up.`;
}

/**
 * What bears on that question.
 *
 * Every `bearing` is a DEFINITION — what the number means — not advice about
 * what to do with it. That boundary is the whole reason this section can exist
 * without a solver behind it: saying "below this number the call loses money
 * at these odds" is arithmetic; saying "so you should fold" would not be.
 */
function decisionFactors(
  input: HandInput,
  calculations: Calculation[],
  heroSeatInPosition: boolean,
): DecisionFactor[] {
  const factors: DecisionFactor[] = [];
  const byId = (id: string) => calculations.find((c) => c.id === id);

  factors.push({
    label: "Your position",
    value: input.heroPosition,
    bearing: heroSeatInPosition
      ? "You act last after the flop, so every later decision is made already knowing what villain did."
      : "You act before villain after the flop, so every later decision is made without knowing what they will do.",
  });

  const made = byId("made-hand");
  if (made) {
    factors.push({
      label: "What you have made",
      value: made.value,
      bearing: "The best five-card hand available from your two cards and the board as it stands.",
    });
  }

  const texture = byId("board-texture");
  if (texture) {
    factors.push({
      label: "The board",
      value: texture.value,
      bearing: "How paired, connected and suited the flop is — which is what decides how many hands it can improve.",
    });
  }

  const required = byId("required-equity");
  if (required) {
    factors.push({
      label: "The price",
      value: `${required.value} needed to call`,
      bearing: "At these odds a call below this share of the pot loses money over time, and above it makes money.",
    });
  }

  const equity = byId("equity");
  if (equity) {
    factors.push({
      label: "Your equity",
      value: equity.value,
      bearing: "The share of the pot your hand wins on average, counted over every remaining runout — not an estimate.",
    });
  }

  const rangeEquity = byId("equity-vs-range");
  if (rangeEquity) {
    factors.push({
      label: "Your equity against the range",
      value: rangeEquity.value,
      bearing:
        "The share of the pot your hand wins on average against every hand in the selected range, weighted by how often that range holds each one. Exact given the range — and only as true as the range is.",
    });
  }

  const spr = byId("spr");
  if (spr) {
    factors.push({
      label: "Stack-to-pot ratio",
      value: spr.value,
      bearing: "How many pot-sized bets are still behind, which sets how much room is left to manoeuvre.",
    });
  }

  return factors;
}

/** How the factors combine — and where they stop combining. */
function factorRelationship(
  factors: DecisionFactor[],
  heroEquityPct?: number,
  requiredEquityPct?: number,
  /** Set when the equity above came from a range rather than a known hand. */
  rangeLabel?: string,
): string {
  if (heroEquityPct !== undefined && requiredEquityPct !== undefined) {
    const margin = heroEquityPct - requiredEquityPct;
    const clears = margin >= 0;

    // The conditional wording is a different sentence, not the same sentence
    // with a caveat bolted on: the condition belongs in the claim itself.
    if (rangeLabel) {
      return clears
        ? `Two numbers decide it, and one of them is an assumption. The price is ${requiredEquityPct.toFixed(1)}% — that part is fixed, whatever villain holds. Against the ${rangeLabel} range you hold ${heroEquityPct.toFixed(2)}%, clearing it by ${margin.toFixed(2)} points. Swap the range and the second number moves; the first does not.`
        : `Two numbers decide it, and one of them is an assumption. The price is ${requiredEquityPct.toFixed(1)}% — that part is fixed, whatever villain holds. Against the ${rangeLabel} range you hold ${heroEquityPct.toFixed(2)}%, ${Math.abs(margin).toFixed(2)} points short. Swap the range and the second number moves; the first does not.`;
    }

    return clears
      ? `These two numbers settle it. You need ${requiredEquityPct.toFixed(1)}% and you hold ${heroEquityPct.toFixed(2)}%, so the call clears the price by ${margin.toFixed(2)} points. Position and texture change how the rest of the hand plays, but they do not change this call's arithmetic.`
      : `These two numbers settle it. You need ${requiredEquityPct.toFixed(1)}% and you hold ${heroEquityPct.toFixed(2)}%, so the call falls short by ${Math.abs(margin).toFixed(2)} points. Position and texture change how the rest of the hand plays, but they do not rescue this call's arithmetic.`;
  }

  if (requiredEquityPct !== undefined) {
    return `The price is fixed: ${requiredEquityPct.toFixed(1)}%. What is not fixed is whether your hand clears it, because that depends on the range villain bets this way — and modelling that range needs a solver this tool does not have. The number to carry away is the ${requiredEquityPct.toFixed(1)}%: it is the bar, whatever they hold.`;
  }

  const labels = factors.map((f) => f.label.toLowerCase());
  return `No arithmetic settles this one — no bet and pot were entered together, so there is no price to compare anything against. What the hand does fix is its shape: ${labels.join(", ")}. Those are what to reason from, and the concepts below are the reviewed theory for reasoning about them.`;
}

// ── Analysis ─────────────────────────────────────────────────────────────────

/**
 * The entry point the UI uses.
 *
 * Returns one of the three states rather than throwing, because "you have not
 * finished entering the hand" is a normal thing for a user to be doing and
 * should not arrive as an exception.
 */
export function analyseHand(input: HandInput): AnalysisOutcome {
  const state = classifyInput(input);
  if (state !== "analyzable") {
    return {
      state,
      reasons: blockingIssues(input).map((issue) => issue.message),
      missing: missingInformation(input),
    };
  }
  return analyzeHand(input);
}

export function analyzeHand(input: HandInput): HandAnalysis {
  const issues = validateHand(input);
  if (issues.length) {
    throw new Error(`Cannot analyse an invalid hand: ${issues[0].message}`);
  }

  const street = streetForBoard(input.board);
  const facts: string[] = [];
  const calculations: Calculation[] = [];
  const limitations: string[] = [];

  // ── Facts ──────────────────────────────────────────────────────────────
  facts.push(`Hero holds ${formatCards(input.heroCards)} in the ${input.heroPosition}.`);
  if (input.villainCards?.length === 2) {
    facts.push(
      `Villain holds ${formatCards(input.villainCards)}${input.villainPosition ? ` in the ${input.villainPosition}` : ""}.`,
    );
  } else if (input.villainPosition) {
    facts.push(`Villain is in the ${input.villainPosition}; their cards are unknown.`);
  }
  if (input.board.length) {
    facts.push(`The board is ${formatCards(input.board)} (${street}).`);
  } else {
    facts.push("The hand is still preflop.");
  }
  for (const action of input.actions) facts.push(describeAction(action));

  // ── Calculations ───────────────────────────────────────────────────────

  // Made hand, once there are five cards to evaluate.
  if (input.board.length >= 3 && input.heroCards.length === 2) {
    const available = [...input.heroCards, ...input.board];
    if (available.length >= 5) {
      const made = evaluateHand(available);
      calculations.push({
        id: "made-hand",
        label: "Your hand right now",
        value: made.category,
        basis: "Best five cards from your two plus the board.",
        confidence: "high",
      });
    }
  }

  // Board texture, from the classifier the curriculum uses.
  if (input.board.length >= 3) {
    const flop = classifyFlop([input.board[0], input.board[1], input.board[2]] as [string, string, string]);
    calculations.push({
      id: "board-texture",
      label: "Flop texture",
      value: `${flop.structure}, ${flop.texture}`,
      basis: "lib/learn/flopClassifier.ts — the same classifier the lessons use.",
      confidence: "high",
    });
  }

  // The price hero is being laid.
  const facing = facingBet(input.actions);
  let requiredEquityPct: number | undefined;
  if (facing?.amountBb !== undefined && input.potBb !== undefined && input.potBb > 0) {
    const potBeforeCall = input.potBb + facing.amountBb;
    requiredEquityPct = requiredEquityFromPot(potBeforeCall, facing.amountBb);
    calculations.push({
      id: "required-equity",
      label: "Equity needed to call",
      value: `${requiredEquityPct.toFixed(1)}%`,
      basis: "call / (pot after the bet + call)",
      confidence: "high",
    });
    calculations.push({
      id: "mdf",
      label: "Minimum defense frequency",
      value: `${(mdf(facing.amountBb, input.potBb) * 100).toFixed(1)}%`,
      basis: "MDF = pot / (pot + bet)",
      confidence: "high",
    });
    calculations.push({
      id: "alpha",
      label: "Fold frequency the bet needs",
      value: `${(alpha(facing.amountBb, input.potBb) * 100).toFixed(1)}%`,
      basis: "alpha = bet / (pot + bet)",
      confidence: "high",
    });
  }

  // Stack-to-pot ratio.
  if (input.effectiveStackBb !== undefined && input.potBb !== undefined && input.potBb > 0) {
    const spr = computeSPR(input.effectiveStackBb, input.potBb);
    calculations.push({
      id: "spr",
      label: "Stack-to-pot ratio",
      value: `${spr.toFixed(1)} (${classifySPR(spr)})`,
      basis: "SPR = effective stack / pot",
      confidence: "high",
    });
  }

  // ── Equity: the three states, kept strictly apart (§9) ─────────────────
  //
  //   A  villain's hand known          → exact, unconditional
  //   B  hand unknown + reviewed range → exact, CONDITIONAL on that range
  //   C  neither                       → nothing; the verdict stays open
  //
  // A always beats B: a known hand is not a model of anything, and offering a
  // range for a hand we can see would be replacing a fact with an assumption.
  let heroEquityPct: number | undefined;
  /** Kept separate from `heroEquityPct` so a conditional number can never be
   *  mistaken for an unconditional one anywhere downstream. */
  let rangeEquityPct: number | undefined;
  let conditional: ConditionalRange | undefined;

  if (input.villainCards?.length === 2 && input.heroCards.length === 2) {
    const invalid = validateEquityInput(input.heroCards, input.villainCards, input.board);
    if (!invalid) {
      const equity = calculateEquity(input.heroCards, input.villainCards, input.board);
      heroEquityPct = equity.heroEquity * 100;
      calculations.push({
        id: "equity",
        label: "Your equity against that exact hand",
        value: `${heroEquityPct.toFixed(2)}%`,
        basis: `Exact — every one of the ${equity.boardsEvaluated.toLocaleString("en-US")} remaining runouts counted.`,
        confidence: "high",
      });
    }
  } else if (input.villainRangePresetId) {
    const preset = presetById(input.villainRangePresetId);
    // Re-checked here rather than trusted from the UI: a preset can arrive
    // from a URL, a saved row or a stale form, and an inapplicable chart must
    // never be executed just because something asked for it.
    const applies = preset && matchPreset(preset, input).rejections.length === 0;
    if (preset && applies) {
      const result = calculateRangeEquity(input.heroCards, preset, input.board);
      if (!isRangeEquityError(result)) {
        rangeEquityPct = result.heroEquityPct;
        conditional = {
          presetId: preset.id,
          presetLabel: preset.label,
          citation: citation(preset.provenance),
          derivationNote: derivationNote(preset.provenance),
          assumptions: preset.assumptions,
          combosConsidered: result.combosConsidered,
          combosInRange: result.combosInRange,
        };
        calculations.push({
          id: "equity-vs-range",
          label: `Your equity against the ${preset.label} range`,
          value: `${result.heroEquityPct.toFixed(2)}%`,
          basis: `Exact against that range — ${result.combosConsidered} of its ${result.combosInRange} combos are still possible once your cards and the board are removed, and every remaining runout was counted for each (${result.boardsEvaluated.toLocaleString("en-US")} board evaluations).`,
          confidence: "high",
        });
        calculations.push({
          id: "range-combos",
          label: "Combos villain can still hold",
          value: `${result.combosConsidered} of ${result.combosInRange}`,
          basis: "Combos containing one of your cards or a board card are impossible and were removed.",
          confidence: "high",
        });
      }
    }
  }

  // ── Verdict ────────────────────────────────────────────────────────────
  //
  // Emitted only where arithmetic settles it: a known-vs-known equity against
  // a known price. Everything else is explicitly "needs review".
  let verdict: Verdict = "needs-review";
  let confidence: Confidence = "medium";
  let verdictBasis =
    "The facts and the maths below are solid, but whether the play is right depends on villain's range — which this tool does not model.";

  const heroFacingDecision = facing !== undefined;

  if (heroEquityPct !== undefined && requiredEquityPct !== undefined) {
    const margin = heroEquityPct - requiredEquityPct;
    verdict = margin >= 0 ? "profitable-by-the-maths" : "unprofitable-by-the-maths";
    confidence = "high";
    verdictBasis =
      margin >= 0
        ? `Calling needs ${requiredEquityPct.toFixed(1)}% and you have ${heroEquityPct.toFixed(2)}% against that exact hand — the call beats the price by ${margin.toFixed(2)} points.`
        : `Calling needs ${requiredEquityPct.toFixed(1)}% and you have ${heroEquityPct.toFixed(2)}% against that exact hand — the call is short by ${Math.abs(margin).toFixed(2)} points.`;
  } else if (rangeEquityPct !== undefined && requiredEquityPct !== undefined && conditional) {
    // Conditional. The verdict VALUE carries the condition, and so does every
    // sentence: "against this range", never "you are ahead".
    const margin = rangeEquityPct - requiredEquityPct;
    verdict = margin >= 0 ? "profitable-against-the-range" : "unprofitable-against-the-range";
    // Never `high`: the arithmetic is exact but rests on an assumed range, and
    // the confidence field is the one place that distinction is machine-readable.
    confidence = "medium";
    verdictBasis =
      margin >= 0
        ? `Against the ${conditional.presetLabel} range you have ${rangeEquityPct.toFixed(2)}% and the call needs ${requiredEquityPct.toFixed(1)}% — clearing the price by ${margin.toFixed(2)} points, IF villain's range really is that one.`
        : `Against the ${conditional.presetLabel} range you have ${rangeEquityPct.toFixed(2)}% and the call needs ${requiredEquityPct.toFixed(1)}% — falling short by ${Math.abs(margin).toFixed(2)} points, IF villain's range really is that one.`;
  } else if (rangeEquityPct !== undefined && conditional) {
    verdictBasis = `Against the ${conditional.presetLabel} range you have ${rangeEquityPct.toFixed(2)}%. No bet and pot were entered together, so there is no price to hold that up against yet.`;
  } else if (!heroFacingDecision && input.actions.length === 0) {
    verdict = "insufficient-information";
    confidence = "insufficient";
    verdictBasis =
      "No action was entered, so there is no decision to assess — only the hand itself.";
  } else if (heroEquityPct === undefined && requiredEquityPct !== undefined) {
    verdictBasis = `The price is clear — you need ${requiredEquityPct.toFixed(1)}% to call. Whether your hand clears it depends on what villain is betting with, which needs a range this tool will not guess at.`;
  }

  // ── What could not be determined ───────────────────────────────────────
  //
  // Structured, so the UI can turn "villain's cards are unknown" into a button
  // that adds them rather than a sentence the user has to act on themselves.
  const unknowns = unknownsFor(input, {
    equity: heroEquityPct !== undefined,
    price: requiredEquityPct !== undefined,
    board: input.board.length >= 3,
    range: rangeEquityPct !== undefined,
    rangeAvailable: applicablePresets(input).length > 0,
  });
  limitations.push(...unknowns.map((unknown) => `${unknown.question}: ${unknown.because}`));

  const concepts = detectConcepts(input);
  const heroAction = lastAction(input.actions, "hero");
  const heroSeat = positionById(input.heroPosition as PositionId);

  const factors = decisionFactors(input, calculations, heroSeat.inPositionPostflop);
  const keyDecision: KeyDecision = {
    question: keyDecisionQuestion(input, street),
    factors,
    relationship: factorRelationship(
      factors,
      heroEquityPct ?? rangeEquityPct,
      requiredEquityPct,
      conditional?.presetLabel,
    ),
  };

  return {
    state: "analyzable",
    keyDecision,
    ...(conditional ? { conditional } : {}),
    unknowns,
    missing: missingInformation(input),
    summary: {
      heroCards: formatCards(input.heroCards),
      heroPosition: input.heroPosition,
      villain: input.villainCards?.length === 2 ? formatCards(input.villainCards) : input.villainPosition,
      board: input.board.length ? formatCards(input.board) : "—",
      street,
      lastHeroAction: heroAction ? describeAction(heroAction) : undefined,
      potBb: input.potBb,
    },
    verdict,
    confidence,
    verdictBasis,
    facts,
    calculations,
    concepts,
    limitations,
    conceptIds: concepts.map((c) => c.conceptId),
  };
}

/** Outs → probability, offered as a follow-up rather than guessed at. */
export function outsToEquity(outs: number): string {
  return `${(drawProbabilityByRiver(outs) * 100).toFixed(1)}%`;
}

export { STREET_ORDER, type Card };
