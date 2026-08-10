import { RANK_VALUE, type Card } from "./cards";

/**
 * Texas Hold'em hand evaluator — the best five-card hand out of five, six or
 * seven cards.
 *
 * This is combinatorics, not poker strategy: which five cards beat which is
 * defined by the rules of the game, so nothing here needs a theory source
 * (the same standing as lib/theory/math.ts's "mathematical facts, not
 * copyrighted content"). Correctness is proved by enumerating all 2,598,960
 * five-card hands and matching the textbook category frequencies, and by
 * checking seven-card selection against a brute-force best-of-21-subsets
 * reference — see lib/tools/__tests__/handEvaluator.test.ts.
 *
 * Speed matters here because the equity calculator enumerates 1.7 million
 * boards for a preflop match-up, which is 3.4 million evaluations. So the
 * core works on integer card codes with preallocated scratch buffers and
 * bitmask lookups, and allocates nothing per evaluation. The string-based
 * `evaluateHand` is a thin adapter over it for callers that have `"As"`.
 *
 * Scores are a single integer, higher is better, so comparison is `>`:
 *
 *     category * 16^5  +  kicker ranks packed base-16, most significant first
 *
 * Five kickers fit because a rank value is at most 14 < 16. Two hands tie
 * exactly when their scores are equal, which is what makes split pots exact
 * rather than approximate.
 */

export const HAND_CATEGORIES = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

const CATEGORY_BY_INDEX: HandCategory[] = [...HAND_CATEGORIES];

const HIGH_CARD = 0;
const PAIR = 1;
const TWO_PAIR = 2;
const TRIPS = 3;
const STRAIGHT = 4;
const FLUSH = 5;
const FULL_HOUSE = 6;
const QUADS = 7;
const STRAIGHT_FLUSH = 8;

const BASE = 16;
const CATEGORY_WEIGHT = BASE ** 5;
const K1 = BASE ** 4;
const K2 = BASE ** 3;
const K3 = BASE ** 2;
const K4 = BASE;

/**
 * Card code = rankIndex * 4 + suitIndex, where rankIndex 0 is a deuce and 12
 * an ace. Encoded once per card, never re-parsed inside the hot loop.
 */
export type CardCode = number;

export function encodeCard(card: Card): CardCode {
  const rankIndex = RANK_VALUE[card[0]] - 2;
  const suitIndex = "shdc".indexOf(card[1]);
  if (rankIndex < 0 || suitIndex < 0) throw new Error(`Not a card: ${card}`);
  return rankIndex * 4 + suitIndex;
}

export function encodeCards(cards: Card[]): CardCode[] {
  return cards.map(encodeCard);
}

/**
 * rank-mask → the VALUE of the straight's high card (5–14), or 0 for none.
 *
 * Precomputed for all 8,192 masks so straight detection is one array read.
 * The wheel is in the table like any other straight, which is why the "ace
 * plays low" case needs no branch at evaluation time.
 */
const STRAIGHT_HIGH = (() => {
  const table = new Uint8Array(1 << 13);
  const WHEEL = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1; // A,5,4,3,2
  for (let mask = 0; mask < table.length; mask += 1) {
    let high = 0;
    for (let low = 8; low >= 0; low -= 1) {
      const run = 0b11111 << low;
      if ((mask & run) === run) {
        high = low + 4 + 2;
        break;
      }
    }
    if (!high && (mask & WHEEL) === WHEEL) high = 5;
    table[mask] = high;
  }
  return table;
})();

/** The five highest set bits of a 13-bit rank mask, as rank values (2–14). */
function topRanks(mask: number, count: number, out: Int8Array): void {
  let found = 0;
  for (let i = 12; i >= 0 && found < count; i -= 1) {
    if (mask & (1 << i)) {
      out[found] = i + 2;
      found += 1;
    }
  }
  while (found < count) {
    out[found] = 0;
    found += 1;
  }
}

// Scratch buffers. The evaluator is synchronous and single-threaded, so one
// set is reused for every call — this is what removes per-evaluation
// allocation from the 3.4-million-evaluation preflop enumeration.
const rankCounts = new Uint8Array(13);
const suitCounts = new Uint8Array(4);
const suitMasks = new Uint16Array(4);
const kickers = new Int8Array(5);

/**
 * The evaluator core: an integer score for 5–7 card codes.
 *
 * `cards` may be longer than `count`; only the first `count` entries are
 * read, so callers can reuse one buffer.
 */
export function scoreCodes(cards: ArrayLike<CardCode>, count: number): number {
  rankCounts.fill(0);
  suitCounts.fill(0);
  suitMasks.fill(0);

  let rankMask = 0;
  for (let i = 0; i < count; i += 1) {
    const code = cards[i];
    const rankIndex = code >> 2;
    const suitIndex = code & 3;
    rankCounts[rankIndex] += 1;
    suitCounts[suitIndex] += 1;
    suitMasks[suitIndex] |= 1 << rankIndex;
    rankMask |= 1 << rankIndex;
  }

  // A flush decides the hand outright: nothing outside the suit can improve
  // on it within its category, and a straight flush can only live inside it.
  for (let suit = 0; suit < 4; suit += 1) {
    if (suitCounts[suit] >= 5) {
      const mask = suitMasks[suit];
      const high = STRAIGHT_HIGH[mask];
      if (high) return STRAIGHT_FLUSH * CATEGORY_WEIGHT + high * K1;
      topRanks(mask, 5, kickers);
      return (
        FLUSH * CATEGORY_WEIGHT +
        kickers[0] * K1 + kickers[1] * K2 + kickers[2] * K3 + kickers[3] * K4 + kickers[4]
      );
    }
  }

  // One descending pass collects everything the remaining categories need.
  let quadRank = 0;
  let tripRank = 0;
  let pairHigh = 0;
  let pairLow = 0;
  for (let i = 12; i >= 0; i -= 1) {
    const count_ = rankCounts[i];
    if (count_ === 4) quadRank = i + 2;
    else if (count_ === 3) {
      if (tripRank) {
        // A second set plays as the pair of a full house.
        if (!pairHigh) pairHigh = i + 2;
      } else tripRank = i + 2;
    } else if (count_ === 2) {
      if (!pairHigh) pairHigh = i + 2;
      else if (!pairLow) pairLow = i + 2;
    }
  }

  if (quadRank) {
    topRanks(rankMask & ~(1 << (quadRank - 2)), 1, kickers);
    return QUADS * CATEGORY_WEIGHT + quadRank * K1 + kickers[0] * K2;
  }

  if (tripRank && pairHigh) {
    return FULL_HOUSE * CATEGORY_WEIGHT + tripRank * K1 + pairHigh * K2;
  }

  const straightHigh = STRAIGHT_HIGH[rankMask];
  if (straightHigh) return STRAIGHT * CATEGORY_WEIGHT + straightHigh * K1;

  if (tripRank) {
    topRanks(rankMask & ~(1 << (tripRank - 2)), 2, kickers);
    return TRIPS * CATEGORY_WEIGHT + tripRank * K1 + kickers[0] * K2 + kickers[1] * K3;
  }

  if (pairHigh && pairLow) {
    const used = (1 << (pairHigh - 2)) | (1 << (pairLow - 2));
    topRanks(rankMask & ~used, 1, kickers);
    return TWO_PAIR * CATEGORY_WEIGHT + pairHigh * K1 + pairLow * K2 + kickers[0] * K3;
  }

  if (pairHigh) {
    topRanks(rankMask & ~(1 << (pairHigh - 2)), 3, kickers);
    return (
      PAIR * CATEGORY_WEIGHT +
      pairHigh * K1 + kickers[0] * K2 + kickers[1] * K3 + kickers[2] * K4
    );
  }

  topRanks(rankMask, 5, kickers);
  return (
    HIGH_CARD * CATEGORY_WEIGHT +
    kickers[0] * K1 + kickers[1] * K2 + kickers[2] * K3 + kickers[3] * K4 + kickers[4]
  );
}

export function categoryOfScore(score: number): HandCategory {
  return CATEGORY_BY_INDEX[Math.floor(score / CATEGORY_WEIGHT)];
}

export interface EvaluatedHand {
  score: number;
  category: HandCategory;
}

/** String-card adapter over the core. Use `scoreCodes` in hot loops. */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`evaluateHand needs at least 5 cards, received ${cards.length}`);
  }
  const score = scoreCodes(encodeCards(cards), cards.length);
  return { score, category: categoryOfScore(score) };
}

export function categoryOf(cards: Card[]): HandCategory {
  return evaluateHand(cards).category;
}
