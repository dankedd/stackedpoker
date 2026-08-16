import { findDuplicates, isCard, type Card } from "../cards";
import type { HandInput, InputState, Street } from "./types";

/**
 * Input validation.
 *
 * Two jobs, and keeping them apart is the point (§4). An IMPOSSIBLE hand — a
 * card dealt twice, a six-card board, a river action on a flop — is never
 * accepted, and the build gate enforces that. But a hand that is merely
 * UNFINISHED — one hole card typed so far, a flop half entered — is not an
 * error at all; it is somebody mid-way through, and telling them they made a
 * mistake would be both wrong and discouraging.
 *
 * So every issue carries a `severity`, and the whole UI distinction between
 * "fix this" and "keep going" derives from it rather than from a second
 * classification that could drift out of step with this one.
 */

export type HandIssueKind =
  | "hero-cards"
  | "villain-cards"
  | "board-length"
  | "duplicate-cards"
  | "bad-card"
  | "action-street"
  | "negative-amount"
  | "stack";

export interface HandIssue {
  kind: HandIssueKind;
  /**
   * `impossible` — no real hand looks like this; the input must change.
   * `insufficient` — a real hand, just not enough of it entered yet.
   */
  severity: "impossible" | "insufficient";
  message: string;
  /** Only set on duplicate-cards, naming the offending cards. */
  cards?: Card[];
}

/** Cards dealt by the street that has been reached. */
const BOARD_LENGTH_BY_STREET: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

export function streetForBoard(board: Card[]): Street {
  if (board.length >= 5) return "river";
  if (board.length === 4) return "turn";
  if (board.length === 3) return "flop";
  return "preflop";
}

export function validateHand(input: HandInput): HandIssue[] {
  const issues: HandIssue[] = [];

  // Fewer than two hole cards is somebody still typing. More than two is a
  // hand that cannot be dealt.
  if (input.heroCards.length < 2) {
    issues.push({
      kind: "hero-cards",
      severity: "insufficient",
      message:
        input.heroCards.length === 0
          ? "Enter your two hole cards to start — for example \"As Kh\"."
          : "That is one card. Add the second to make a hand.",
    });
  } else if (input.heroCards.length > 2) {
    issues.push({
      kind: "hero-cards",
      severity: "impossible",
      message: `Hold'em deals two hole cards — you entered ${input.heroCards.length}.`,
    });
  }

  if (input.villainCards && input.villainCards.length === 1) {
    issues.push({
      kind: "villain-cards",
      severity: "insufficient",
      message: "Villain has one card entered. Add the second, or clear the field to leave their hand unknown.",
    });
  } else if (input.villainCards && input.villainCards.length > 2) {
    issues.push({
      kind: "villain-cards",
      severity: "impossible",
      message: `Villain holds two cards — you entered ${input.villainCards.length}.`,
    });
  }

  if (input.board.length > 5) {
    issues.push({
      kind: "board-length",
      severity: "impossible",
      message: `A board has at most five cards — you entered ${input.board.length}.`,
    });
  } else if (input.board.length === 1 || input.board.length === 2) {
    // A four-card board is a turn; there is no street with only one or two
    // community cards. Mid-typing, though — not a mistake to scold about.
    issues.push({
      kind: "board-length",
      severity: "insufficient",
      message: `A flop is three cards — you have ${input.board.length}. Add the rest, or clear the board for a preflop hand.`,
    });
  }

  const everyCard = [...input.heroCards, ...(input.villainCards ?? []), ...input.board];
  for (const card of everyCard) {
    if (!isCard(card)) {
      issues.push({
        kind: "bad-card",
        severity: "impossible",
        message: `"${card}" is not a card. Use ranks A K Q J T 9–2 and suits s h d c.`,
      });
    }
  }

  const duplicates = findDuplicates(everyCard);
  if (duplicates.length) {
    issues.push({
      kind: "duplicate-cards",
      severity: "impossible",
      cards: duplicates,
      message: `${duplicates.join(", ")} appears more than once. Every card exists once in a deck.`,
    });
  }

  const reached = streetForBoard(input.board);
  const reachedIndex = Object.keys(BOARD_LENGTH_BY_STREET).indexOf(reached);
  for (const action of input.actions) {
    const actionIndex = Object.keys(BOARD_LENGTH_BY_STREET).indexOf(action.street);
    if (actionIndex > reachedIndex) {
      issues.push({
        kind: "action-street",
        severity: "impossible",
        message: `There is a ${action.street} action but the board only reaches the ${reached}. Add the missing cards or remove the action.`,
      });
      break;
    }
    if (action.amountBb !== undefined && action.amountBb < 0) {
      issues.push({
        kind: "negative-amount",
        severity: "impossible",
        message: `A ${action.type} cannot be a negative amount.`,
      });
      break;
    }
  }

  if (input.effectiveStackBb !== undefined && input.effectiveStackBb <= 0) {
    issues.push({
      kind: "stack",
      severity: "impossible",
      message: "Effective stack must be greater than zero.",
    });
  }
  if (input.potBb !== undefined && input.potBb < 0) {
    issues.push({ kind: "stack", severity: "impossible", message: "Pot size cannot be negative." });
  }

  return issues;
}

/**
 * Which of the three states the input is in (§4).
 *
 * Impossible beats insufficient: if a hand contains a duplicated card AND only
 * one hole card, the duplicate is what has to be fixed first, and calling it
 * "incomplete" would send the user off adding cards that will still collide.
 */
export function classifyInput(input: HandInput): InputState {
  const issues = validateHand(input);
  if (issues.some((issue) => issue.severity === "impossible")) return "invalid";
  if (issues.length) return "incomplete";
  return "analyzable";
}

export function isAnalysable(input: HandInput): boolean {
  return classifyInput(input) === "analyzable";
}

/** The issues the user has to act on, most important first. */
export function blockingIssues(input: HandInput): HandIssue[] {
  const issues = validateHand(input);
  const impossible = issues.filter((issue) => issue.severity === "impossible");
  return impossible.length ? impossible : issues;
}
