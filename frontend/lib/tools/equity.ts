import { remainingDeck, type Card } from "./cards";
import { encodeCards, scoreCodes, type CardCode } from "./handEvaluator";

/**
 * Exact hand-vs-hand equity by exhaustive enumeration.
 *
 * Every possible completion of the board is dealt and evaluated, then the
 * results are counted. There is no sampling, no approximation and no solver
 * output involved — with both hands known, equity is a counting problem, and
 * counting it is the whole algorithm. That is why this can ship without a
 * theory citation while a range-vs-range or multiway number could not:
 * those need modelling assumptions this codebase has no reviewed source for.
 *
 * Cost:
 *   preflop   C(48,5) = 1,712,304 boards
 *   flop      C(45,2) =       990
 *   turn                        44
 *   river                        1
 *
 * The preflop case is the only heavy one. Both hands are packed into
 * preallocated buffers whose board slots are overwritten in place, so the
 * 3.4 million evaluations allocate nothing at all.
 */

export interface EquityResult {
  /** Fraction 0–1, split pots counted as half. */
  heroEquity: number;
  villainEquity: number;
  heroWinPct: number;
  villainWinPct: number;
  tiePct: number;
  /** Boards enumerated — the sample size, which is the whole population here. */
  boardsEvaluated: number;
  exact: true;
}

export type EquityError =
  | { kind: "hero-incomplete" }
  | { kind: "villain-incomplete" }
  | { kind: "board-too-long"; count: number }
  | { kind: "duplicate-cards"; cards: Card[] };

export function validateEquityInput(
  hero: Card[],
  villain: Card[],
  board: Card[],
): EquityError | null {
  if (hero.length !== 2) return { kind: "hero-incomplete" };
  if (villain.length !== 2) return { kind: "villain-incomplete" };
  if (board.length > 5) return { kind: "board-too-long", count: board.length };

  const seen = new Set<Card>();
  const duplicates = new Set<Card>();
  for (const card of [...hero, ...villain, ...board]) {
    if (seen.has(card)) duplicates.add(card);
    seen.add(card);
  }
  if (duplicates.size) return { kind: "duplicate-cards", cards: [...duplicates] };

  return null;
}

/**
 * Runs the enumeration.
 *
 * Throws on invalid input rather than returning a partial result — call
 * `validateEquityInput` first; the UI does, so it can show a message instead
 * of an exception.
 */
export function calculateEquity(hero: Card[], villain: Card[], board: Card[]): EquityResult {
  const invalid = validateEquityInput(hero, villain, board);
  if (invalid) throw new Error(`Invalid equity input: ${invalid.kind}`);

  const deck = encodeCards(remainingDeck([...hero, ...villain, ...board]));
  const needed = 5 - board.length;

  // Layout: [hole, hole, board…, runout…]. Only the runout slots change, and
  // they are written in place as the enumeration walks.
  const heroCards = new Int32Array(7);
  const villainCards = new Int32Array(7);
  const heroCodes = encodeCards(hero);
  const villainCodes = encodeCards(villain);
  const boardCodes = encodeCards(board);

  heroCards[0] = heroCodes[0];
  heroCards[1] = heroCodes[1];
  villainCards[0] = villainCodes[0];
  villainCards[1] = villainCodes[1];
  for (let i = 0; i < boardCodes.length; i += 1) {
    heroCards[2 + i] = boardCodes[i];
    villainCards[2 + i] = boardCodes[i];
  }

  const runoutStart = 2 + board.length;

  let heroWins = 0;
  let villainWins = 0;
  let ties = 0;
  let boards = 0;

  const settle = () => {
    const heroScore = scoreCodes(heroCards, 7);
    const villainScore = scoreCodes(villainCards, 7);
    if (heroScore > villainScore) heroWins += 1;
    else if (villainScore > heroScore) villainWins += 1;
    else ties += 1;
    boards += 1;
  };

  // Iterative combination walk over the remaining deck. Indices only ever
  // increase, so each board is generated exactly once.
  const deal = (start: number, depth: number) => {
    if (depth === needed) {
      settle();
      return;
    }
    const slot = runoutStart + depth;
    const last = deck.length - (needed - depth);
    for (let i = start; i <= last; i += 1) {
      const code: CardCode = deck[i];
      heroCards[slot] = code;
      villainCards[slot] = code;
      deal(i + 1, depth + 1);
    }
  };

  deal(0, 0);

  const total = boards || 1;

  return {
    // A chopped pot is half a pot won, which is what "equity" measures.
    heroEquity: (heroWins + ties / 2) / total,
    villainEquity: (villainWins + ties / 2) / total,
    heroWinPct: (heroWins / total) * 100,
    villainWinPct: (villainWins / total) * 100,
    tiePct: (ties / total) * 100,
    boardsEvaluated: boards,
    exact: true,
  };
}

/**
 * How many boards a given input will enumerate — used to tell the user what
 * they are asking for before the one heavy case runs.
 */
export function boardCount(boardLength: number): number {
  const remaining = 52 - 4 - boardLength;
  const needed = 5 - boardLength;
  let result = 1;
  for (let i = 0; i < needed; i += 1) result = (result * (remaining - i)) / (i + 1);
  return Math.round(result);
}

/**
 * What this calculator does NOT do.
 *
 * Stated in code and rendered on the page: an honest limit is worth more than
 * a number nobody can stand behind. Ranges and multiway pots need modelling
 * assumptions StackedPoker has no reviewed source for, so they are refused
 * rather than approximated.
 */
export const EQUITY_LIMITATIONS = [
  "Two known hands only — range-versus-range equity is not supported.",
  "Heads-up only — multiway pots are not supported.",
  "No dead cards beyond the board you enter.",
] as const;
