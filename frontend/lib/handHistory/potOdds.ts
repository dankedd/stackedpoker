/**
 * Pot odds at every decision where Hero faces a bet or shove.
 *
 * Chip EV only: needed equity = what Hero must add / the pot Hero can win
 * after adding it. Bets bigger than Hero's remaining stack only count up to
 * what Hero can match (the rest is returned), and every player's chips are
 * capped the same way — the main pot Hero is actually playing for. ICM is not
 * taken into account.
 */

import type { HandEvent, ParsedHand, Street } from "./types";

export interface PotOddsDecision {
  /** The event where Hero made the decision (identity-equal to the timeline's event). */
  event: HandEvent;
  street: Street;
  /** Chips Hero has to add to continue (capped at Hero's stack). */
  toCall: number;
  /** The pot Hero can win before calling: everything in the middle, capped at Hero's match. */
  pot: number;
  /** toCall / (pot + toCall), 0–1. */
  required: number;
  /** Players still in and able to act after Hero — the odds assume heads-up. */
  stillToAct: number;
  /** What Hero did. */
  action: "call" | "fold" | "raise";
}

export function potOddsDecisions(hand: ParsedHand): PotOddsDecision[] {
  const hero = hand.heroName;
  if (!hero) return [];
  const startStack = new Map(hand.players.map((p) => [p.name, p.stack]));
  const total = new Map<string, number>(); // chips put in this hand (antes included)
  let street = new Map<string, number>(); // chips put in on this street (antes excluded)
  const folded = new Set<string>();
  const allIn = new Set<string>();
  const out: PotOddsDecision[] = [];
  // Only a real bet or raise counts as "facing a bet"; the blinds alone do not.
  let facingAggression = false;

  const add = (p: string, n: number, toStreet: boolean) => {
    total.set(p, (total.get(p) ?? 0) + n);
    if (toStreet) street.set(p, (street.get(p) ?? 0) + n);
    if ((total.get(p) ?? 0) >= (startStack.get(p) ?? 0)) allIn.add(p);
  };

  hand.events.forEach((e, idx) => {
    if (e.kind === "deal") {
      street = new Map();
      facingAggression = false;
      return;
    }
    if (e.kind === "post") return add(e.player, e.amount, e.post !== "ante");
    if (e.kind === "uncalled") {
      total.set(e.player, (total.get(e.player) ?? 0) - e.amount);
      street.set(e.player, (street.get(e.player) ?? 0) - e.amount);
      return;
    }
    if (e.kind !== "action") return;

    if (e.player === hero && facingAggression && e.action !== "check" && e.action !== "bet") {
      const maxBet = Math.max(0, ...street.values());
      const owed = maxBet - (street.get(hero) ?? 0);
      const heroIn = total.get(hero) ?? 0;
      const remaining = (startStack.get(hero) ?? 0) - heroIn;
      const toCall = Math.min(owed, remaining);
      if (toCall > 0) {
        const cap = heroIn + toCall;
        let winnable = 0;
        for (const [p, n] of total) winnable += p === hero ? cap : Math.min(n, cap);
        const later = hand.events.slice(idx + 1);
        const stillToAct = hand.players.filter(
          (p) =>
            p.name !== hero &&
            !folded.has(p.name) &&
            !allIn.has(p.name) &&
            (street.get(p.name) ?? 0) < maxBet &&
            later.some((x) => x.kind === "action" && x.player === p.name && x.street === e.street),
        ).length;
        out.push({
          event: e,
          street: e.street,
          toCall,
          pot: winnable - toCall,
          required: toCall / winnable,
          stillToAct,
          action: e.action === "fold" ? "fold" : e.action === "call" ? "call" : "raise",
        });
      }
    }
    if (e.action === "fold") folded.add(e.player);
    if ((e.action === "bet" || e.action === "raise") && e.player !== hero) facingAggression = true;
    if ((e.action === "bet" || e.action === "raise") && e.player === hero) facingAggression = false;
    add(e.player, e.amount, true);
  });
  return out;
}
