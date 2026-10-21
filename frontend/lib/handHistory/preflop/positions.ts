/**
 * Seat → the trainer's 9-max chart position, by how many players act after
 * the seat preflop (see lookup.ts for the reasoning, MPT p.17–18). Shared by
 * the preflop check and the villain range (villain/index.ts), so both read a
 * hand the same way.
 */

import type { ParsedHand } from "../types";
import { rangePosition } from "./lookup";

/** Players acting after `name` preflop (0 for the big blind). */
export function playersAfter(hand: ParsedHand, name: string): number {
  const bySeat = [...hand.players].sort((a, b) => a.seat - b.seat);
  const bbPost = hand.events.find((e) => e.kind === "post" && e.post === "big_blind");
  const bbName = bbPost && "player" in bbPost ? bbPost.player : hand.players.find((p) => p.position === "BB")?.name;
  const bb = bySeat.findIndex((p) => p.name === bbName);
  const me = bySeat.findIndex((p) => p.name === name);
  if (bb < 0 || me < 0) return -1;
  return (bb - me + bySeat.length) % bySeat.length;
}

export function position9(hand: ParsedHand, name: string): string | null {
  const after = playersAfter(hand, name);
  if (after === 0) return "BB";
  return after > 0 ? rangePosition(after) : null;
}
