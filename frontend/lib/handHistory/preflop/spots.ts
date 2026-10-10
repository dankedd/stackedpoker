/**
 * Step 1 — recognise the preflop spot Hero was in.
 *
 * Only "raise first in" for now: every player before Hero folded and Hero is
 * not the big blind. Returns null for any other spot (Hero facing a limp or
 * raise, Hero in the BB, Hero all-in from the blinds), so those hands get no
 * check at all.
 */

import type { HandEvent, ParsedHand } from "../types";
import type { HeroPreflopAction, PreflopSpot } from "./types";

/** A raise that puts at least this share of the stack (after the ante) in counts as all-in. */
export const NEAR_ALL_IN = 0.9;

const RANKS = "AKQJT98765432";

/** ["Qd","Ah"] → "AQo"; ["Js","Jd"] → "JJ". */
export function handClass(cards: string[]): string | null {
  if (cards.length !== 2) return null;
  const rank = (c: string) => RANKS.indexOf(c[0].toUpperCase());
  if (rank(cards[0]) < 0 || rank(cards[1]) < 0) return null;
  const [a, b] = [...cards].sort((x, y) => rank(x) - rank(y));
  const r1 = a[0].toUpperCase();
  const r2 = b[0].toUpperCase();
  if (r1 === r2) return r1 + r2;
  return r1 + r2 + (a[1].toLowerCase() === b[1].toLowerCase() ? "s" : "o");
}

type Action = Extract<HandEvent, { kind: "action" }>;

export function findRfiSpot(hand: ParsedHand): PreflopSpot | null {
  const hero = hand.players.find((p) => p.isHero);
  if (!hero || !hand.heroCards) return null;
  if (hero.position === "BB") return null;

  const pre = hand.events.filter((e): e is Action => e.kind === "action" && e.street === "preflop");
  const idx = pre.findIndex((e) => e.player === hero.name);
  if (idx < 0) return null;
  const before = pre.slice(0, idx);
  if (before.some((e) => e.action !== "fold")) return null;

  const hc = handClass(hand.heroCards);
  if (!hc) return null;

  const acted = new Set(before.map((e) => e.player));
  const behind = hand.players.filter((p) => !p.isHero && !acted.has(p.name));
  const biggestBehind = Math.max(0, ...behind.map((p) => p.stack));
  const a = pre[idx];

  const spot: PreflopSpot = {
    kind: "rfi",
    tablePosition: hero.position,
    playersBehind: behind.length,
    effStackBb: Math.min(hero.stack, biggestBehind) / hand.bigBlind,
    hand: hc,
    action: heroAction(a, hero.stack - hand.ante),
  };
  if (a.action === "raise") spot.sizeBb = (a.toAmount ?? a.amount) / hand.bigBlind;
  return spot;
}

function heroAction(a: Action, stackAfterAnte: number): HeroPreflopAction {
  if (a.action === "fold" || a.action === "check") return "fold";
  // First in, a call is a limp (the SB completing).
  if (a.action === "call") return a.allIn ? "allin" : "limp";
  const committed = a.toAmount ?? a.amount;
  if (a.allIn || (stackAfterAnte > 0 && committed >= NEAR_ALL_IN * stackAfterAnte)) return "allin";
  return "raise";
}
