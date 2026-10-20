/**
 * Does a played hand match a Flop Equity Trainer spot?
 *
 * Only the spots with book ranges qualify (data/mpt/spots.json, MVP): a
 * single-raised pot where the 9-max BN or UTG opens, everyone else folds and
 * the big blind calls, heads-up to the flop, with stacks near the 40bb the
 * charts were made for. Multiway pots, limps, 3-bets, all-ins, cash hands and
 * other positions get no panel — the precomputed ranges would not describe
 * them.
 */

import { handClass, NEAR_ALL_IN } from "@/lib/handHistory/preflop/spots";
import type { HandEvent, ParsedHand } from "@/lib/handHistory/types";
import { position9 } from "@/lib/handHistory/villain";
import { MVP_SPOTS } from "./data";
import { canonicalFlop } from "./phase3";

type Action = Extract<HandEvent, { kind: "action" }>;

/** Effective stacks (bb) that count as "the 40bb charts" — an implementation choice, labelled in the UI. */
export const STACK_RANGE: [number, number] = [30, 50];
/** Largest open (raise-to, in bb) still read as a standard open; the book's charts open 2.3x. */
export const MAX_OPEN_BB = 3.5;

const SPOT_BY_OPENER: Record<string, string> = { BN: MVP_SPOTS[0], UTG: MVP_SPOTS[1] };

export interface FlopSpotMatch {
  spotId: string;
  /** 9-max chart position of the opener ("BN" | "UTG"). */
  openerPosition: string;
  opener: string;
  caller: string;
  /** The flop as dealt, and its canonical key in flop_equity. */
  cards: string[];
  flop: string;
  effBb: number;
  /** Hero's side in the spot, or null when Hero is not one of the two players. */
  heroSide: "ip" | "oop" | null;
  /** Hero's starting hand class (e.g. "AKo") when Hero is in the pot. */
  heroHand: string | null;
}

export function matchFlopSpot(hand: ParsedHand): FlopSpotMatch | null {
  // Book charts are tournament charts (a manually entered cash hand has format "cash").
  if ("format" in hand && (hand as { format?: string }).format === "cash") return null;
  if (hand.board.flop.length !== 3 || hand.bigBlind <= 0) return null;

  const pre = hand.events.filter((e): e is Action => e.kind === "action" && e.street === "preflop");
  const first = pre.findIndex((a) => a.action !== "fold");
  if (first < 0) return null;
  const open = pre[first];
  if (open.action !== "raise" || open.allIn) return null;

  const stackOf = (name: string) => hand.players.find((p) => p.name === name)?.stack ?? 0;
  const raiseTo = open.toAmount ?? open.amount;
  if (raiseTo / hand.bigBlind > MAX_OPEN_BB) return null;
  if (raiseTo >= NEAR_ALL_IN * (stackOf(open.player) - hand.ante)) return null;

  const openerPosition = position9(hand, open.player);
  const spotId = openerPosition ? SPOT_BY_OPENER[openerPosition] : undefined;
  if (!spotId || !openerPosition) return null;

  // After the open: folds, and exactly one call — by the big blind.
  const rest = pre.slice(first + 1).filter((a) => a.action !== "fold");
  if (rest.length !== 1) return null;
  const call = rest[0];
  if (call.action !== "call" || call.allIn || position9(hand, call.player) !== "BB") return null;

  const effBb = Math.min(stackOf(open.player), stackOf(call.player)) / hand.bigBlind;
  if (effBb < STACK_RANGE[0] || effBb > STACK_RANGE[1]) return null;

  const hero = hand.heroName;
  const heroSide = hero === open.player ? "ip" : hero === call.player ? "oop" : null;
  return {
    spotId,
    openerPosition,
    opener: open.player,
    caller: call.player,
    cards: hand.board.flop,
    flop: canonicalFlop(hand.board.flop),
    effBb: Math.round(effBb * 10) / 10,
    heroSide,
    heroHand: heroSide && hand.heroCards ? handClass(hand.heroCards) : null,
  };
}
