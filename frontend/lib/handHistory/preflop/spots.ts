/**
 * Step 1 — recognise the preflop spots Hero was in (findSpots):
 *
 *   Hero's first decision
 *     everyone before Hero folded            → rfi (not in the BB: a walk has no decision)
 *     one limper, nothing else               → vs_limp
 *     one raise, no callers                  → vs_open, or vs_push when the raise is all-in
 *     anything else (squeeze, cold 4-bet,
 *     several limpers, limp + raise)         → other (graded not_evaluated)
 *   Hero's second decision, only where the trainer has a chart for it
 *     Hero 3-bet an open, the opener 4-bets  → vs_4bet
 *     Hero raised a limp, the limper raises  → vs_limp_raise
 *   (Hero opened and faced a 3-bet: the trainer has no chart → only the open is checked.)
 *
 * Positions here are table labels; lookup.ts maps them to the 9-max charts.
 */

import type { HandEvent, ParsedHand } from "../types";
import { position9 } from "./positions";
import type { HeroPreflopAction, PreflopSpot, SpotVillain, UnmatchedWhy } from "./types";

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

// ── Defense spots ────────────────────────────────────────────────────────────

/** Every spot Hero was in preflop, in order (at most two decisions). */
export function findSpots(hand: ParsedHand): PreflopSpot[] {
  const hero = hand.players.find((p) => p.isHero);
  if (!hero || !hand.heroCards) return [];
  const hc = handClass(hand.heroCards);
  if (!hc) return [];
  const pre = hand.events.filter((e): e is Action => e.kind === "action" && e.street === "preflop");
  const mine = pre.map((a, i) => ({ a, i })).filter((x) => x.a.player === hero.name);
  if (!mine.length) return [];

  const first = facingSpot(hand, pre, mine[0].i, hc);
  if (!first) return [];
  const out = [first];

  // A second decision with a chart: vs 4-bet (after Hero's 3-bet) or vs limp-raise (after Hero's iso-raise).
  const second = mine[1];
  if (second && first.action === "raise" && first.villain && (first.kind === "vs_open" || first.kind === "vs_limp")) {
    const between = pre.slice(mine[0].i + 1, second.i).filter((a) => a.action !== "fold");
    const reraise = between.length === 1 && between[0].player === first.villain.name && between[0].action === "raise" ? between[0] : null;
    if (reraise) {
      const villain = spotVillain(hand, reraise, committedBefore(hand, pre, second.i));
      const effStackBb = Math.min(hero.stack, playerStack(hand, villain.name)) / hand.bigBlind;
      out.push({
        kind: first.kind === "vs_open" ? "vs_4bet" : "vs_limp_raise",
        tablePosition: hero.position,
        playersBehind: first.playersBehind,
        effStackBb,
        hand: hc,
        position: first.position,
        villain,
        ...heroDefense(hand, second.a, effStackBb),
      });
    }
  }
  return out;
}

/** Hero's first decision: rfi, a defense spot, or "other". */
function facingSpot(hand: ParsedHand, pre: Action[], idx: number, hc: string): PreflopSpot | null {
  const hero = hand.players.find((p) => p.isHero)!;
  const before = pre.slice(0, idx);
  const acting = before.filter((a) => a.action !== "fold");
  if (!acting.length) return findRfiSpot(hand);

  const acted = new Set(before.map((e) => e.player));
  const behind = hand.players.filter((p) => !p.isHero && !acted.has(p.name)).length;
  const base = { tablePosition: hero.position, playersBehind: behind, hand: hc, position: position9(hand, hero.name) };
  const committed = committedBefore(hand, pre, idx);

  const raises = acting.filter((a) => a.action === "raise" || a.action === "bet");
  const firstRaise = raises.length ? acting.indexOf(raises[0]) : acting.length;
  const limps = acting.slice(0, firstRaise).filter((a) => a.action === "call");
  const callers = acting.slice(firstRaise + 1).filter((a) => a.action === "call");

  const spot = (kind: PreflopSpot["kind"], villainAct: Action, unmatched?: UnmatchedWhy): PreflopSpot => {
    const villain = spotVillain(hand, villainAct, committed);
    const effStackBb = Math.min(hero.stack, playerStack(hand, villain.name)) / hand.bigBlind;
    return { kind, ...base, effStackBb, villain, ...(unmatched ? { unmatched } : {}), ...heroDefense(hand, pre[idx], effStackBb) };
  };

  if (raises.length > 1) return spot("other", raises[0], "cold_4bet");
  if (raises.length === 1) {
    if (limps.length) return spot("other", raises[0], "limp_then_raise");
    const allIn = spotVillain(hand, raises[0], committed).allIn;
    if (callers.length) return spot("other", raises[0], allIn && callers.some((c) => c.allIn) ? "multi_allin" : "squeeze");
    return spot(allIn ? "vs_push" : "vs_open", raises[0]);
  }
  if (limps.length > 1) return spot("other", limps[0], "multi_limp");
  return spot("vs_limp", limps[0]);
}

function playerStack(hand: ParsedHand, name: string): number {
  return hand.players.find((p) => p.name === name)?.stack ?? 0;
}

/** Chips each player has in front of them (blinds + preflop actions, no antes) before action `upto`. */
function committedBefore(hand: ParsedHand, pre: Action[], upto: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of hand.events) {
    if (e.kind === "post" && e.post !== "ante") m.set(e.player, (m.get(e.player) ?? 0) + e.amount);
  }
  for (const a of pre.slice(0, upto)) {
    if (a.action === "raise" || a.action === "bet") m.set(a.player, a.toAmount ?? (m.get(a.player) ?? 0) + a.amount);
    else if (a.action === "call") m.set(a.player, (m.get(a.player) ?? 0) + a.amount);
  }
  return m;
}

/** The opponent behind action `a`: position, raise-to (or limp) in BB, all-in (90%+ of the stack after the ante). */
function spotVillain(hand: ParsedHand, a: Action, committed: Map<string, number>): SpotVillain {
  const p = hand.players.find((x) => x.name === a.player);
  const total = committed.get(a.player) ?? a.toAmount ?? a.amount;
  const stack = (p?.stack ?? 0) - hand.ante;
  const allIn = a.allIn || (a.action !== "call" && stack > 0 && total >= NEAR_ALL_IN * stack);
  return { name: a.player, tablePosition: p?.position ?? "", position: position9(hand, a.player), sizeBb: total / hand.bigBlind, allIn };
}

/** Hero's action facing a bet. A raise of 90%+ of the effective stack (after the ante) is all-in. */
function heroDefense(hand: ParsedHand, a: Action, effStackBb: number): { action: HeroPreflopAction; sizeBb?: number } {
  if (a.action === "fold") return { action: "fold" };
  // Checking the BB behind a limp is the chart's "call" (the trainer labels it "Check").
  if (a.action === "check" || a.action === "call") return { action: "call" };
  const to = a.toAmount ?? a.amount;
  const effAfterAnte = effStackBb * hand.bigBlind - hand.ante;
  const allIn = a.allIn || (effAfterAnte > 0 && to >= NEAR_ALL_IN * effAfterAnte);
  return { action: allIn ? "allin" : "raise", sizeBb: to / hand.bigBlind };
}
