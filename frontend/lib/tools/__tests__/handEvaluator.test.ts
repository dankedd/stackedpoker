import { describe, expect, it } from "vitest";
import { FULL_DECK, type Card } from "../cards";
import { evaluateHand, type HandCategory } from "../handEvaluator";

/**
 * The evaluator is the foundation the equity calculator stands on, so it is
 * verified against facts that exist independently of this code:
 *
 *  1. the textbook frequencies of every five-card category across all
 *     2,598,960 hands — if any comparison is wrong, at least one count moves;
 *  2. a brute-force best-of-21-subsets reference for seven-card hands.
 */

describe("five-card category frequencies", () => {
  // The standard counts for a 52-card deck. Any evaluator that reproduces all
  // nine simultaneously is classifying every hand correctly.
  const EXPECTED: Record<HandCategory, number> = {
    "High card": 1302540,
    Pair: 1098240,
    "Two pair": 123552,
    "Three of a kind": 54912,
    Straight: 10200,
    Flush: 5108,
    "Full house": 3744,
    "Four of a kind": 624,
    "Straight flush": 40, // includes the 4 royal flushes
  };

  it("matches the known distribution across all 2,598,960 hands", () => {
    const counts = new Map<HandCategory, number>();
    let total = 0;

    const hand: Card[] = new Array(5);
    for (let a = 0; a < 48; a += 1) {
      hand[0] = FULL_DECK[a];
      for (let b = a + 1; b < 49; b += 1) {
        hand[1] = FULL_DECK[b];
        for (let c = b + 1; c < 50; c += 1) {
          hand[2] = FULL_DECK[c];
          for (let d = c + 1; d < 51; d += 1) {
            hand[3] = FULL_DECK[d];
            for (let e = d + 1; e < 52; e += 1) {
              hand[4] = FULL_DECK[e];
              const { category } = evaluateHand(hand);
              counts.set(category, (counts.get(category) ?? 0) + 1);
              total += 1;
            }
          }
        }
      }
    }

    expect(total).toBe(2598960);
    expect(Object.fromEntries(counts)).toEqual(EXPECTED);
  });
});

describe("hand comparison", () => {
  const better = (winner: Card[], loser: Card[]) => {
    expect(
      evaluateHand(winner).score,
      `${winner.join("")} should beat ${loser.join("")}`,
    ).toBeGreaterThan(evaluateHand(loser).score);
  };

  it("orders the categories correctly", () => {
    const ladder: Card[][] = [
      ["As", "Ks", "Qs", "Js", "Ts"], // royal / straight flush
      ["Ac", "Ad", "Ah", "As", "Kd"], // quads
      ["Ac", "Ad", "Ah", "Kc", "Kd"], // full house
      ["As", "Js", "9s", "5s", "3s"], // flush
      ["Ac", "Kd", "Qh", "Js", "Tc"], // straight
      ["Ac", "Ad", "Ah", "Kc", "Qd"], // trips
      ["Ac", "Ad", "Kh", "Kc", "Qd"], // two pair
      ["Ac", "Ad", "Kh", "Qc", "Jd"], // pair
      ["Ac", "Kd", "Qh", "Jc", "9d"], // high card
    ];
    for (let i = 0; i < ladder.length - 1; i += 1) better(ladder[i], ladder[i + 1]);
  });

  it("reads the wheel as a five-high straight, not an ace-high one", () => {
    const wheel = evaluateHand(["5c", "4d", "3h", "2s", "Ac"]);
    const sixHigh = evaluateHand(["6c", "5d", "4h", "3s", "2c"]);
    expect(wheel.category).toBe("Straight");
    expect(sixHigh.score).toBeGreaterThan(wheel.score);
  });

  it("reads the steel wheel as a straight flush", () => {
    expect(evaluateHand(["5s", "4s", "3s", "2s", "As"]).category).toBe("Straight flush");
  });

  it("separates hands by kicker", () => {
    better(["Ac", "Ad", "Kh", "Qc", "Jd"], ["Ac", "Ad", "Kh", "Qc", "Td"]);
    better(["Ac", "Ad", "Ah", "Kc", "Qd"], ["Ac", "Ad", "Ah", "Kc", "Jd"]);
  });

  it("ties when both hands play the same five cards", () => {
    const board = ["As", "Ks", "Qs", "Js", "Ts"];
    expect(evaluateHand([...board, "2c", "3d"]).score).toBe(
      evaluateHand([...board, "7h", "8h"]).score,
    );
  });
});

describe("seven-card selection", () => {
  /** The obvious implementation: try all 21 five-card subsets, keep the best. */
  function bruteForce(cards: Card[]): number {
    let best = -1;
    for (let a = 0; a < cards.length - 4; a += 1) {
      for (let b = a + 1; b < cards.length - 3; b += 1) {
        for (let c = b + 1; c < cards.length - 2; c += 1) {
          for (let d = c + 1; d < cards.length - 1; d += 1) {
            for (let e = d + 1; e < cards.length; e += 1) {
              const score = evaluateHand([cards[a], cards[b], cards[c], cards[d], cards[e]]).score;
              if (score > best) best = score;
            }
          }
        }
      }
    }
    return best;
  }

  it("picks the same best five as an exhaustive subset search", () => {
    // Deterministic pseudo-random deals — no Math.random, so a failure is
    // reproducible rather than a one-off.
    let seed = 987654321;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let trial = 0; trial < 400; trial += 1) {
      const deck = [...FULL_DECK];
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const seven = deck.slice(0, 7);
      expect(evaluateHand(seven).score, seven.join(" ")).toBe(bruteForce(seven));
    }
  });

  it("rejects fewer than five cards", () => {
    expect(() => evaluateHand(["As", "Ks", "Qs", "Js"])).toThrow(/at least 5/);
  });
});
