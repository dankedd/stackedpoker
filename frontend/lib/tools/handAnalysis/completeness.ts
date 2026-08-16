import { applicablePresets } from "./rangePresets";
import type { HandInput, MissingInformation, Unknown } from "./types";

/**
 * What is missing, and what it would buy (§5).
 *
 * The rule this file exists to enforce: the analyser never says "insufficient
 * information" without naming the field that would fix it. A user who is told
 * their analysis is limited, and not told what to do about it, has been given
 * a dead end — and every dead end here is avoidable, because the analyser knows
 * exactly which input it wanted.
 *
 * `unlocks` is written from the reader's side. Not "villainCards is null" but
 * "exact equity, and a verdict the maths can settle" — the thing they get, not
 * the field we lack.
 */

/**
 * Ordered by what the reader gains, not by how the input object is shaped.
 * Villain's cards come first everywhere because they are the single input that
 * moves an analysis from "here is the price" to "here is the answer".
 */
export function missingInformation(input: HandInput): MissingInformation[] {
  const missing: MissingInformation[] = [];

  if (input.heroCards.length < 2) {
    missing.push({
      field: "heroCards",
      label: "Add your hole cards",
      unlocks: "everything — there is no hand to analyse without them",
      severity: "blocking",
    });
  }

  if (input.villainCards?.length !== 2) {
    missing.push({
      field: "villainCards",
      label: "Add villain's cards",
      unlocks: "exact equity against that hand, and a verdict the maths can settle outright",
      severity: "improves",
    });
  }

  // Offered ONLY when a reviewed chart actually covers this spot. Never a
  // generic "pick a range" that leads to an empty list.
  if (
    input.villainCards?.length !== 2 &&
    !input.villainRangePresetId &&
    applicablePresets(input).length > 0
  ) {
    missing.push({
      field: "villainRange",
      label: "Pick a range for villain",
      unlocks: "a conditional answer — your exact equity against a published range for this spot",
      severity: "improves",
    });
  }

  const hasBet = input.actions.some((action) =>
    ["bet", "raise", "3bet", "4bet", "allin"].includes(action.type),
  );

  if (input.potBb === undefined) {
    missing.push({
      field: "potBb",
      label: "Add the pot size",
      unlocks: hasBet
        ? "the price you are being laid — pot odds, the equity you need, MDF and alpha"
        : "pot odds, minimum defense frequency and the stack-to-pot ratio",
      severity: "improves",
    });
  }

  if (input.actions.length === 0) {
    missing.push({
      field: "actions",
      label: "Add what happened",
      unlocks: "the decision itself — with no betting there is nothing to weigh up",
      severity: "improves",
    });
  }

  if (input.board.length === 0) {
    missing.push({
      field: "board",
      label: "Add the flop",
      unlocks: "board texture, the hand you actually made, and the postflop concepts that follow",
      severity: "improves",
    });
  } else if (input.board.length === 3) {
    missing.push({
      field: "board",
      label: "Add the turn",
      unlocks: "how the hand developed after the flop",
      severity: "improves",
    });
  } else if (input.board.length === 4) {
    missing.push({
      field: "board",
      label: "Add the river",
      unlocks: "the final hand, with no cards left to come",
      severity: "improves",
    });
  }

  if (input.effectiveStackBb === undefined) {
    missing.push({
      field: "effectiveStackBb",
      label: "Add the effective stack",
      unlocks: "the stack-to-pot ratio, which decides how committed the pot already is",
      severity: "improves",
    });
  }

  if (!input.villainPosition) {
    missing.push({
      field: "villainPosition",
      label: "Add villain's position",
      unlocks: "who acts first on later streets",
      severity: "improves",
    });
  }

  return missing;
}

/** What the analyser has actually been able to compute for this hand. */
export interface ComputedSoFar {
  /** Exact equity was available — both hands known. */
  equity: boolean;
  /** A price was available — a bet faced, into a known pot. */
  price: boolean;
  /** A board exists, so texture and made hand could be read. */
  board: boolean;
  /** Equity was computed against a chosen reviewed range instead. */
  range?: boolean;
  /** A reviewed range EXISTS for this spot, whether or not one was chosen. */
  rangeAvailable?: boolean;
}

/**
 * "What we cannot determine" (§1), as structure rather than an apology.
 *
 * Two kinds live here and they are not the same thing:
 *
 *   RESOLVABLE — the analyser could answer this if the user typed one more
 *                field. Those carry `resolvedBy`, and the UI turns them into
 *                a button.
 *   INHERENT   — nobody can answer it from this tool, because it would need a
 *                solver or a range model StackedPoker has no reviewed source
 *                for. Those carry no `resolvedBy`, and are stated plainly so
 *                the user knows not to go looking for a setting.
 */
export function unknownsFor(input: HandInput, computed: ComputedSoFar): Unknown[] {
  const unknowns: Unknown[] = [];

  if (!computed.equity && !computed.range) {
    unknowns.push({
      id: "equity",
      question: "Your exact equity in the hand",
      because: computed.rangeAvailable
        ? "Villain's cards are unknown, so equity against their actual hand cannot be counted. You can pick a reviewed range to stand in for it and get a conditional answer instead."
        : "Villain's cards are unknown, so equity cannot be counted. Equity against a RANGE would need a chart this spot has no reviewed source for, and the analyser will not invent one.",
      resolvedBy: computed.rangeAvailable ? "villainRange" : "villainCards",
    });
  }

  // The one thing a range can never settle. Stated whenever a range WAS used,
  // because it is precisely the assumption the conclusion now rests on.
  if (computed.range) {
    unknowns.push({
      id: "villain-actual-range",
      question: "Whether villain actually plays the range you selected",
      because:
        "The selected range is a model of equilibrium play, read from a published chart. A real opponent deviates from it, and the conclusion above moves with them. Treat the number as \"against this range\", never as \"against this opponent\".",
    });
  }

  if (!computed.price) {
    unknowns.push({
      id: "price",
      question: "Whether the price you were offered was good",
      because: input.potBb === undefined
        ? "No pot size was entered, so pot odds, MDF and alpha have nothing to divide."
        : "No bet was entered for you to face, so there is no price to compare anything against.",
      resolvedBy: input.potBb === undefined ? "potBb" : "actions",
    });
  }

  if (input.effectiveStackBb === undefined) {
    unknowns.push({
      id: "spr",
      question: "How committed the pot already is",
      because: "No effective stack was entered, so the stack-to-pot ratio could not be calculated.",
      resolvedBy: "effectiveStackBb",
    });
  }

  if (!computed.board && input.actions.length > 0) {
    unknowns.push({
      id: "texture",
      question: "How the board interacts with the hands",
      because: "The hand is still preflop, so there is no texture to read yet.",
      resolvedBy: "board",
    });
  }

  // Inherent — no field fixes these, and saying so is more useful than a
  // confident number nobody can stand behind.
  if (!computed.range) {
    unknowns.push({
      id: "villain-range",
      question: "What villain actually holds here",
      because:
        "Inferring an opponent's real range needs solver output or population data. This tool has neither, and will not guess at one. What it can do, where a published chart covers the spot, is calculate against that chart and label the answer conditional.",
    });
  }

  unknowns.push({
    id: "optimal-frequency",
    question: "The optimal frequency to take this line",
    because:
      "This is not a solver. Frequencies and ranges come from one; the analyser reports what happened, what the arithmetic says and which reviewed concepts apply.",
  });

  return unknowns;
}
