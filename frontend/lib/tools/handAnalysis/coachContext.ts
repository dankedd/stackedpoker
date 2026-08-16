import type { HandAnalysis, HandInput } from "./types";

/**
 * The AI Coach handoff (§7).
 *
 * Mirrors the mechanism LessonPlayer already uses to hand a Coach Review to
 * /coach across a full navigation (see lib/learn/coachReviewStorage.ts): the
 * payload goes into sessionStorage under a shared key, the coach page reads
 * and consumes it once on mount. Reusing that pattern rather than inventing a
 * second one is what keeps the two handoffs from drifting apart.
 *
 * Two things travel that the lesson handoff does not need:
 *   - `returnPath`, so the coach can offer a link BACK to the analyser with
 *     the hand intact (§7's round trip);
 *   - `concept_ids`, which the backend already uses to ground its answer in
 *     reviewed theory (see coach_context.py's `ground_theory`), so the coach
 *     talks about the same concepts the analysis surfaced.
 *
 * The hand itself is included so the coach can discuss the actual cards, and
 * the analysis so it does not contradict what the user was just shown.
 */

/**
 * The analysis, trimmed to what the coach needs.
 *
 * Not the whole `HandAnalysis`: the formulas, the concept prose and the fact
 * list are already things the coach can derive or does not need, and a smaller
 * payload keeps the prompt on the hand rather than on our output. The key
 * decision travels because it is the question the user was just shown — the
 * coach opening on a different question would read as if it had not been
 * listening.
 */
export interface CoachHandAnalysis {
  verdict: HandAnalysis["verdict"];
  confidence: HandAnalysis["confidence"];
  verdictBasis: string;
  summary: HandAnalysis["summary"];
  keyDecision: HandAnalysis["keyDecision"];
  /**
   * Present exactly when the conclusion was reached against a chosen range.
   *
   * The coach has to know this or it will discuss the number as if villain's
   * holding were established. Carrying the citation too means the coach can
   * name the chart if asked, instead of vaguely gesturing at "a range".
   */
  conditional?: HandAnalysis["conditional"];
  calculations: { label: string; value: string }[];
  limitations: string[];
}

export interface CoachHandContext {
  source: "hand_analyzer";
  /** The hand as analysed. */
  hand: HandInput;
  /** What the analyser concluded, so the coach starts from the same place. */
  analysis: CoachHandAnalysis;
  /** Grounding key the backend already understands. */
  concept_ids: string[];
  /** Where to send the user back to, hand intact. */
  returnPath: string;
}

export function buildCoachHandContext(
  hand: HandInput,
  analysis: HandAnalysis,
  returnPath: string,
): CoachHandContext {
  return {
    source: "hand_analyzer",
    hand,
    analysis: {
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      verdictBasis: analysis.verdictBasis,
      summary: analysis.summary,
      keyDecision: analysis.keyDecision,
      ...(analysis.conditional ? { conditional: analysis.conditional } : {}),
      // Only the numbers, not the formulas — the coach needs the result, and a
      // smaller payload keeps the prompt focused.
      calculations: analysis.calculations.map((c) => ({ label: c.label, value: c.value })),
      limitations: analysis.limitations,
    },
    concept_ids: analysis.conceptIds,
    returnPath,
  };
}

/**
 * The opening message the coach is asked.
 *
 * Phrased as the user's own question so the conversation reads naturally, built
 * from the hand so the coach never has to ask "which hand?", and pointed at the
 * key decision the analyser just named so the two surfaces are talking about
 * the same moment.
 *
 * Takes the trimmed payload rather than a full `HandAnalysis` — the coach page
 * only ever has the trimmed one, and widening the parameter to fit it was the
 * kind of thing that ends with a fake analysis object being constructed at the
 * call site just to satisfy a type.
 */
export function coachOpeningQuestion(analysis: CoachHandAnalysis): string {
  const { summary } = analysis;
  const where = summary.board === "—" ? "preflop" : `on ${summary.board}`;
  const decision = analysis.keyDecision?.question
    ? ` The question I am stuck on: ${lowerFirst(analysis.keyDecision.question)}`
    : "";
  // Stated by the user, in the user's own opening line, so the conversation
  // starts from the right footing rather than needing to be corrected later.
  const conditional = analysis.conditional
    ? ` I don't know their cards, so I ran it against the ${analysis.conditional.presetLabel} range.`
    : "";
  return `I had ${summary.heroCards} in the ${summary.heroPosition} ${where}. ${
    summary.lastHeroAction ?? "Walk me through the spot"
  }.${conditional}${decision} What should I be thinking about here?`;
}

function lowerFirst(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

/**
 * Encodes a hand into a URL query so the analyser can be restored from a link
 * — the return half of the round trip, and what makes an analysis shareable.
 *
 * Deliberately compact and lossy-free for the fields that matter; anything
 * unset simply does not appear.
 */
export function encodeHandToQuery(hand: HandInput): string {
  const params = new URLSearchParams();
  params.set("hp", hand.heroPosition);
  params.set("hc", hand.heroCards.join(""));
  if (hand.villainPosition) params.set("vp", hand.villainPosition);
  if (hand.villainCards?.length) params.set("vc", hand.villainCards.join(""));
  if (hand.board.length) params.set("b", hand.board.join(""));
  if (hand.potBb !== undefined) params.set("pot", String(hand.potBb));
  if (hand.effectiveStackBb !== undefined) params.set("stack", String(hand.effectiveStackBb));
  if (hand.villainRangePresetId) params.set("vr", hand.villainRangePresetId);
  if (hand.actions.length) {
    params.set(
      "a",
      hand.actions
        .map((action) =>
          [action.street, action.actor, action.type, action.amountBb ?? ""].join(":"),
        )
        .join(","),
    );
  }
  return params.toString();
}

/** The inverse of `encodeHandToQuery` — restores a hand from a shared link. */
export function decodeHandFromQuery(params: URLSearchParams): Partial<HandInput> {
  const hand: Partial<HandInput> = {};
  const position = params.get("hp");
  if (position) hand.heroPosition = position as HandInput["heroPosition"];
  const heroCards = params.get("hc");
  if (heroCards) hand.heroCards = heroCards.match(/.{1,2}/g) ?? [];
  const villainPosition = params.get("vp");
  if (villainPosition) hand.villainPosition = villainPosition as HandInput["heroPosition"];
  const villainCards = params.get("vc");
  if (villainCards) hand.villainCards = villainCards.match(/.{1,2}/g) ?? [];
  const board = params.get("b");
  if (board) hand.board = board.match(/.{1,2}/g) ?? [];
  const pot = params.get("pot");
  if (pot && Number.isFinite(Number(pot))) hand.potBb = Number(pot);
  const stack = params.get("stack");
  if (stack && Number.isFinite(Number(stack))) hand.effectiveStackBb = Number(stack);
  const range = params.get("vr");
  if (range) hand.villainRangePresetId = range;
  const actions = params.get("a");
  if (actions) {
    hand.actions = actions
      .split(",")
      .map((entry) => entry.split(":"))
      .filter((parts) => parts.length >= 3)
      .map((parts) => ({
        street: parts[0] as HandInput["actions"][number]["street"],
        actor: parts[1] as HandInput["actions"][number]["actor"],
        type: parts[2] as HandInput["actions"][number]["type"],
        ...(parts[3] ? { amountBb: Number(parts[3]) } : {}),
      }));
  }
  return hand;
}
