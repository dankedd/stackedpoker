/**
 * Card parsing and formatting for the public tools.
 *
 * Uses the same notation the rest of the app already speaks (see
 * lib/learn/combos.ts): rank + lowercase suit, e.g. "As", "Th", "2c".
 * Nothing here is poker strategy — it is the alphabet the strategy is
 * written in.
 */

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
/** A concrete card, e.g. "As". */
export type Card = string;

export const SUIT_SYMBOL: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_NAME: Record<string, string> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

/** 2 for a deuce … 14 for an ace. */
export const RANK_VALUE: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export const FULL_DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));

export function isCard(value: string): boolean {
  if (value.length !== 2) return false;
  return RANK_VALUE[value[0]] !== undefined && SUIT_SYMBOL[value[1]] !== undefined;
}

/**
 * Parses free-typed card text into cards.
 *
 * Accepts the shapes people actually type: "AsKh", "As Kh", "as kh",
 * "As,Kh", "A♠ K♥". Returns what it understood plus what it could not, so
 * the UI can point at the problem instead of silently dropping a card.
 */
export function parseCards(input: string): { cards: Card[]; invalid: string[] } {
  const normalised = input
    .replace(/♠/gi, "s")
    .replace(/♥/gi, "h")
    .replace(/♦/gi, "d")
    .replace(/♣/gi, "c")
    .replace(/10/g, "T")
    .trim();

  if (!normalised) return { cards: [], invalid: [] };

  // Split on separators when present; otherwise walk the string in pairs.
  const tokens = /[\s,;/|]/.test(normalised)
    ? normalised.split(/[\s,;/|]+/).filter(Boolean)
    : normalised.match(/.{1,2}/g) ?? [];

  const cards: Card[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const candidate = `${token[0]?.toUpperCase() ?? ""}${token[1]?.toLowerCase() ?? ""}`;
    if (isCard(candidate)) cards.push(candidate);
    else invalid.push(token);
  }

  return { cards, invalid };
}

/** Cards appearing more than once across every supplied group. */
export function findDuplicates(...groups: Card[][]): Card[] {
  const seen = new Set<Card>();
  const duplicates = new Set<Card>();
  for (const card of groups.flat()) {
    if (seen.has(card)) duplicates.add(card);
    seen.add(card);
  }
  return [...duplicates];
}

/** "As" → "A♠", for display. */
export function formatCard(card: Card): string {
  return `${card[0]}${SUIT_SYMBOL[card[1]] ?? card[1]}`;
}

export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(" ");
}

/** "As" → "ace of spades", for screen readers. */
export function describeCard(card: Card): string {
  const names: Record<string, string> = {
    A: "ace", K: "king", Q: "queen", J: "jack", T: "ten",
    "9": "nine", "8": "eight", "7": "seven", "6": "six",
    "5": "five", "4": "four", "3": "three", "2": "two",
  };
  return `${names[card[0]] ?? card[0]} of ${SUIT_NAME[card[1]] ?? card[1]}`;
}

/** The deck minus every card already in play. */
export function remainingDeck(used: Card[]): Card[] {
  const dead = new Set(used);
  return FULL_DECK.filter((card) => !dead.has(card));
}
