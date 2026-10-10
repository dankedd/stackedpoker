/**
 * Values computed from a ParsedHand. Kept out of the parsers so every site
 * gets the same definitions — and so they can be recomputed from stored data
 * if a definition ever changes.
 */

import type { HandDerived, ParsedHand, Street } from "./types";

/** Chips each player put in, net of any uncalled bet returned to them. */
export function investedByPlayer(hand: ParsedHand): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of hand.events) {
    if (e.kind === "post" || e.kind === "action") out.set(e.player, (out.get(e.player) ?? 0) + e.amount);
    else if (e.kind === "uncalled") out.set(e.player, (out.get(e.player) ?? 0) - e.amount);
  }
  return out;
}

/** Players still holding cards when the hand ended. */
export function playersAtEnd(hand: ParsedHand): string[] {
  const folded = new Set<string>();
  for (const e of hand.events) if (e.kind === "action" && e.action === "fold") folded.add(e.player);
  return hand.players.map((p) => p.name).filter((n) => !folded.has(n));
}

export function deriveHand(hand: ParsedHand): HandDerived {
  const hero = hand.heroName;
  const heroInvested = hero ? investedByPlayer(hand).get(hero) ?? 0 : 0;
  const heroCollected = hero ? hand.winners.find((w) => w.player === hero)?.amount ?? 0 : 0;
  const heroNetChips = heroCollected - heroInvested;
  const bb = hand.bigBlind;

  let lastStreet: Street = "preflop";
  for (const e of hand.events) if (e.kind === "deal") lastStreet = e.street;

  return {
    potBb: round2(hand.totalPot / bb),
    heroPosition: hand.players.find((p) => p.isHero)?.position ?? null,
    heroInvested,
    heroCollected,
    heroNetChips,
    heroNetBb: round2(heroNetChips / bb),
    heroWon: heroCollected > 0,
    // `*** SHOWDOWN ***` is printed in every GG hand, so the only reliable
    // signal is two or more players still in at the end.
    wentToShowdown: playersAtEnd(hand).length >= 2,
    heroInvolved: isHeroInvolved(hand),
    heroInvestedBb: round2(heroInvested / bb),
    heroAllIn: hand.events.some(
      (e) => (e.kind === "action" || e.kind === "post") && e.player === hero && e.allIn,
    ),
    lastStreet,
  };
}

/**
 * Hero really played the hand: put chips in voluntarily (a call, bet or raise
 * on any street, all-ins included) or reached showdown. Posting the ante or a
 * blind and then folding — or checking the big blind and folding the flop, or
 * getting a walk — is not involved.
 */
export function isHeroInvolved(hand: ParsedHand): boolean {
  const hero = hand.heroName;
  if (!hero) return false;
  const voluntary = hand.events.some(
    (e) => e.kind === "action" && e.player === hero && (e.action === "call" || e.action === "bet" || e.action === "raise"),
  );
  return voluntary || hero in hand.shown;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
