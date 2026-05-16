/**
 * pokerState.ts
 *
 * Canonical PokerState for puzzle rendering.
 * Single source of truth for who acts next, IP/OOP labels,
 * legal actions, and validation state at any puzzle step.
 */

import {
  heroActsFirstPostflop,
  classifyPositions,
  describeMatchup,
} from "./positionEngine";
import { validateContextActorOrder } from "./puzzleValidator";

// ── Types ────────────────────────────────────────────────────────────────────

export type Street = "preflop" | "flop" | "turn" | "river";
export type LegalAction = "fold" | "check" | "call" | "bet" | "raise";

export interface PokerState {
  // Identifiers
  puzzleId: string;
  stepIdx: number;

  // Street + board
  street: Street;

  // Positions
  heroPosition: string;
  villainPosition: string;
  heroIsOop: boolean;       // hero acts first postflop
  ipPosition: string;       // position label for IP player
  oopPosition: string;      // position label for OOP player
  firstToActPostflop: string; // same as oopPosition
  currentActor: string;     // who should act next ("hero" | "villain")

  // Inferred legal actions from context
  legalActions: LegalAction[];

  // Stack / pot state
  pot: number;              // in BB
  heroStack: number;        // in BB
  villainStack: number;     // in BB

  // Validation
  contextIsValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];

  // Debug
  debugMatchup: string;     // e.g. "CO (OOP, acts first) vs BTN (IP)"
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer which legal actions are available to hero based on the context string.
 * Looks for keywords that describe what villain did to determine hero's options.
 */
export function inferLegalActions(
  context: string,
  heroIsOop: boolean,
): LegalAction[] {
  const c = context.toLowerCase();

  // Villain bet/raised → hero can fold, call, raise
  if (/\b(?:bets?|raises?|fires?|leads?|3-?bets?|4-?bets?|jams?|shoves?|double.?barrels?)\b/.test(c)) {
    return ["fold", "call", "raise"];
  }

  // Villain checked → hero can check or bet
  if (/\b(?:checks?|checked)\s+(?:back|the\b|again\b)/.test(c)) {
    return ["check", "bet"];
  }

  // Context ends with a check or no bet yet → hero acts first or facing a check
  if (/\b(?:checks?|checked)\b/.test(c)) {
    // If hero is OOP and checks, villain can bet/check — but here we want what hero does next
    return ["check", "bet"];
  }

  // Preflop: open/limp scenarios
  if (/\b(?:folds?\s+to|action\s+on)\b/.test(c)) {
    return ["fold", "call", "raise"];
  }

  // Default: allow all actions (conservative fallback)
  return ["fold", "check", "call", "bet", "raise"];
}

/**
 * Determine who the current actor is at this step.
 * Based on the context: if context describes villain acting last,
 * hero is next; if context sets up a blank slate, use OOP-first rule.
 */
function inferCurrentActor(
  context: string,
  heroIsOop: boolean,
  street: Street,
): "hero" | "villain" {
  const c = context.toLowerCase();

  // If villain is described betting/raising, hero responds
  if (/\b(?:bets?|raises?|fires?|leads?|jams?|shoves?)\b/.test(c)) {
    return "hero";
  }

  // If villain checked, hero responds
  if (/\b(?:checks?\s+(?:back|the|again)|checked\s+(?:back|the|again))\b/.test(c)) {
    return "hero";
  }

  // If no clear villain action described yet, OOP acts first postflop
  if (street !== "preflop") {
    return heroIsOop ? "hero" : "hero"; // hero always responds to presented context
  }

  return "hero";
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function buildPokerState(
  puzzle: {
    id: string;
    heroPosition: string;
    villainPosition: string;
    steps: Array<{ street?: string; context: string }>;
  },
  stepIdx: number,
  pot: number = 10,
  heroStack: number = 100,
  villainStack: number = 100,
): PokerState {
  const step = puzzle.steps[stepIdx];
  const street = (step?.street ?? "flop") as Street;
  const context = step?.context ?? "";

  const heroPos = puzzle.heroPosition;
  const villainPos = puzzle.villainPosition;

  const heroIsOop = heroActsFirstPostflop(heroPos, villainPos);
  const { ip, oop } = classifyPositions(heroPos, villainPos);

  const validation = validateContextActorOrder(context, street, heroPos, villainPos);
  const legalActions = inferLegalActions(context, heroIsOop);
  const currentActor = inferCurrentActor(context, heroIsOop, street);

  return {
    puzzleId: puzzle.id,
    stepIdx,
    street,
    heroPosition: heroPos,
    villainPosition: villainPos,
    heroIsOop,
    ipPosition: ip,
    oopPosition: oop,
    firstToActPostflop: oop,
    currentActor,
    legalActions,
    pot,
    heroStack,
    villainStack,
    contextIsValid: validation.valid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    debugMatchup: describeMatchup(heroPos, villainPos),
  };
}
