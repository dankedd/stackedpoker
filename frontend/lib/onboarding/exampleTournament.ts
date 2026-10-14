/**
 * The "Example tournament" for the Hand Review tour.
 *
 * Made-up hands, written in GGPoker's export format and run through the real
 * parser, deriveHand and preflop check — so the example shows exactly what an
 * upload would. It lives in the browser only: never saved to Supabase, never
 * counted toward the Free upload limit.
 *
 * Table: 8-handed, Level 10 (500/1,000, ante 125), everyone 25,000 (25 bb).
 * Seat 8 is the button, seat 1 the small blind, seat 2 the big blind.
 */

import { deriveHand } from "@/lib/handHistory/derive";
import { checkPreflop, type PreflopCheck } from "@/lib/handHistory/preflop";
import { parseGGHand } from "@/lib/handHistory/parsers/ggpoker";
import { boardCards } from "@/lib/handHistory/rows";
import { DEFAULT_MIN_POT_BB } from "@/lib/handHistory/filters";
import type { HandDerived, ParsedHand } from "@/lib/handHistory/types";

export const EXAMPLE_TOURNAMENT_NAME = "Example Tournament $10";

const NAMES: Record<number, string> = {
  1: "d41c09a7",
  2: "8f3e2b61",
  3: "5a90c3e2",
  4: "b27d4f18",
  5: "e6012ac9",
  6: "3c8b7d55",
  7: "91fa06be",
  8: "4d6e2c03",
};

function header(n: number, time: string, heroSeat: number, cards: string): string[] {
  const name = (s: number) => (s === heroSeat ? "Hero" : NAMES[s]);
  const seats = [1, 2, 3, 4, 5, 6, 7, 8];
  return [
    `Poker Hand #TM99000000${String(n).padStart(2, "0")}: Tournament #900000001, ${EXAMPLE_TOURNAMENT_NAME} Hold'em No Limit - Level10(500/1,000(125)) - 2026/10/08 ${time}`,
    `Table '7' 8-max Seat #8 is the button`,
    ...seats.map((s) => `Seat ${s}: ${name(s)} (25,000 in chips)`),
    ...seats.map((s) => `${name(s)}: posts the ante 125`),
    `${name(1)}: posts small blind 500`,
    `${name(2)}: posts big blind 1,000`,
    `*** HOLE CARDS ***`,
    `Dealt to Hero [${cards}]`,
  ];
}

const folds = (seats: number[]) => seats.map((s) => `${NAMES[s]}: folds`);

/** The raw hand histories, oldest first. */
export const EXAMPLE_HAND_TEXTS: string[] = [
  // 1. UTG open, value bets, wins a 26.5 bb pot at showdown.
  [
    ...header(1, "19:02:10", 3, "Ac Kd"),
    "Hero: raises 1,000 to 2,000",
    ...folds([4, 5, 6, 7, 8, 1]),
    `${NAMES[2]}: calls 1,000`,
    "*** FLOP *** [Kh 7c 2d]",
    `${NAMES[2]}: checks`,
    "Hero: bets 2,500",
    `${NAMES[2]}: calls 2,500`,
    "*** TURN *** [Kh 7c 2d] [4s]",
    `${NAMES[2]}: checks`,
    "Hero: checks",
    "*** RIVER *** [Kh 7c 2d 4s] [9h]",
    `${NAMES[2]}: checks`,
    "Hero: bets 8,000",
    `${NAMES[2]}: calls 8,000`,
    "*** SHOWDOWN ***",
    "Hero: shows [Ac Kd]",
    `${NAMES[2]}: shows [Qc Qs]`,
    "Hero collected 26,500 from pot",
    "*** SUMMARY ***",
    "Total pot 26,500 | Rake 0",
  ].join("\n"),

  // 2. Folds 7-2 offsuit under the gun: correct, and hidden by the default filters.
  [
    ...header(2, "19:05:41", 3, "7c 2d"),
    "Hero: folds",
    `${NAMES[4]}: raises 1,000 to 2,000`,
    ...folds([5, 6, 7, 8, 1, 2]),
    `Uncalled bet (1,000) returned to ${NAMES[4]}`,
    "*** SHOWDOWN ***",
    `${NAMES[4]} collected 3,500 from pot`,
    "*** SUMMARY ***",
    "Total pot 3,500 | Rake 0",
  ].join("\n"),

  // 3. Folds AQ suited under the gun: the preflop check flags it.
  [
    ...header(3, "19:09:03", 3, "Ah Qh"),
    "Hero: folds",
    ...folds([4, 5, 6, 7, 8, 1]),
    `Uncalled bet (500) returned to ${NAMES[2]}`,
    "*** SHOWDOWN ***",
    `${NAMES[2]} collected 2,000 from pot`,
    "*** SUMMARY ***",
    "Total pot 2,000 | Rake 0",
  ].join("\n"),

  // 4. Opens 9-4 offsuit under the gun and loses a 22.5 bb pot: the preflop check flags it.
  [
    ...header(4, "19:13:27", 3, "9s 4d"),
    "Hero: raises 1,000 to 2,000",
    ...folds([4, 5, 6, 7, 8, 1]),
    `${NAMES[2]}: calls 1,000`,
    "*** FLOP *** [9c 6h 2s]",
    `${NAMES[2]}: checks`,
    "Hero: bets 2,500",
    `${NAMES[2]}: calls 2,500`,
    "*** TURN *** [9c 6h 2s] [Jd]",
    `${NAMES[2]}: checks`,
    "Hero: bets 6,000",
    `${NAMES[2]}: calls 6,000`,
    "*** RIVER *** [9c 6h 2s Jd] [3c]",
    `${NAMES[2]}: checks`,
    "Hero: checks",
    "*** SHOWDOWN ***",
    "Hero: shows [9s 4d]",
    `${NAMES[2]}: shows [Jc Td]`,
    `${NAMES[2]} collected 22,500 from pot`,
    "*** SUMMARY ***",
    "Total pot 22,500 | Rake 0",
  ].join("\n"),

  // 5. Steals from the button, everyone folds: Hero played it, but the pot is small.
  [
    ...header(5, "19:16:50", 8, "Kc 9s"),
    ...folds([3, 4, 5, 6, 7]),
    "Hero: raises 1,000 to 2,000",
    ...folds([1, 2]),
    "Uncalled bet (1,000) returned to Hero",
    "*** SHOWDOWN ***",
    "Hero collected 3,500 from pot",
    "*** SUMMARY ***",
    "Total pot 3,500 | Rake 0",
  ].join("\n"),

  // 6. Opens tens from the cutoff, calls the big blind's shove and wins a 51 bb pot.
  [
    ...header(6, "19:21:14", 7, "Td Th"),
    ...folds([3, 4, 5, 6]),
    "Hero: raises 1,000 to 2,000",
    ...folds([8, 1]),
    `${NAMES[2]}: raises 22,875 to 24,875 and is all-in`,
    "Hero: calls 22,875 and is all-in",
    "Hero: shows [Td Th]",
    `${NAMES[2]}: shows [Ac Qd]`,
    "*** FLOP *** [8c 5d 2h]",
    "*** TURN *** [8c 5d 2h] [Kc]",
    "*** RIVER *** [8c 5d 2h Kc] [4s]",
    "*** SHOWDOWN ***",
    "Hero collected 51,250 from pot",
    "*** SUMMARY ***",
    "Total pot 51,250 | Rake 0",
  ].join("\n"),
];

export interface ExampleHand {
  id: string;
  hand: ParsedHand;
  derived: HandDerived;
  check: PreflopCheck | null;
  board: string[];
  /** Would the overview show it with its default filters (played it, pot ≥ 20 bb)? */
  matters: boolean;
}

let cache: ExampleHand[] | null = null;

/** The parsed example hands, newest first (like the overview). */
export function exampleHands(): ExampleHand[] {
  if (cache) return cache;
  cache = EXAMPLE_HAND_TEXTS.map((text) => {
    const r = parseGGHand(text);
    if (!r.ok) throw new Error(`example hand does not parse: ${r.failure.error}`);
    const derived = deriveHand(r.hand);
    return {
      id: r.hand.handId,
      hand: r.hand,
      derived,
      check: checkPreflop(r.hand),
      board: boardCards(r.hand),
      matters: derived.heroInvolved && derived.potBb >= DEFAULT_MIN_POT_BB,
    };
  }).reverse();
  return cache;
}
