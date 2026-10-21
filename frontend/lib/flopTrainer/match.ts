/**
 * Does a played hand match a Flop Equity Trainer spot?
 *
 * The spot catalog (spotCatalog.json, written by backend/app/flop_equity/
 * derive.py) holds every heads-up spot with book ranges: the postflop
 * chapters' own spots plus the single-raised pots derived from the book's
 * preflop charts. A hand matches when it reached the flop heads-up as
 *   - a single-raised pot: one open (not all-in), one caller, everyone else folded
 *   - a 3-bet pot: an open, one 3-bet (not all-in), the opener called
 * with positions translated to the book's 9-max naming (the preflop check's
 * mapping, preflop/positions.ts) and the effective stack within ±30% of a
 * catalog stack. Anything else gets a reason instead of a match.
 *
 * Whether a matched spot has been precomputed is only known to the database:
 * the panel shows "not analysed yet" when flop_equity has no row.
 */

import { handClass, NEAR_ALL_IN } from "@/lib/handHistory/preflop/spots";
import { position9 } from "@/lib/handHistory/preflop/positions";
import type { HandEvent, ParsedHand } from "@/lib/handHistory/types";
import CATALOG from "./spotCatalog.json";
import { canonicalFlop } from "./phase3";

type Action = Extract<HandEvent, { kind: "action" }>;

export interface CatalogSpot {
  spot_id: string;
  pot: "srp" | "3bp";
  ip: string;
  oop: string;
  /** 9-max position of the last preflop raiser. */
  pfr: string;
  stack_bb: number;
  /** Ranges derived from the preflop charts (not one of the postflop chapters' own spots). */
  derived: boolean;
  /** Its flops are in Supabase (set by backend/app/flop_equity/load.py); false → "coming soon". */
  precomputed: boolean;
}

export const SPOT_CATALOG = CATALOG as CatalogSpot[];

/** A stack bucket matches when the effective stack is within this share of it. */
export const STACK_TOLERANCE = 0.3;
/** Largest open (raise-to, in bb) still read as a standard open; the book's charts open 2–3.5x. */
export const MAX_OPEN_BB = 3.5;
/** Postflop order: the later player is in position. */
const POSTFLOP_ORDER = ["SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BN"];

export type NoMatchReason =
  | "no_flop"
  | "cash"
  | "multiway"
  | "limped"
  | "allin_preflop"
  | "four_bet"
  | "no_book_range"
  | "stack_too_deep"
  | "stack_too_short"
  | "unknown_position";

export const NO_MATCH_LABEL: Record<NoMatchReason, string> = {
  no_flop: "No flop",
  cash: "Cash game — the book's ranges are tournament ranges",
  multiway: "Multiway pot",
  limped: "Limped pot",
  allin_preflop: "All-in before the flop",
  four_bet: "4-bet pot — the book has no ranges for it",
  no_book_range: "No book range for this spot",
  stack_too_deep: "Stack too deep for the book's ranges",
  stack_too_short: "Stack too short for the book's ranges",
  unknown_position: "Position couldn't be read",
};

/** What happened before the flop, whether or not a spot matches. */
export interface FlopSituation {
  pot: "srp" | "3bp";
  /** 9-max positions. */
  ip: string;
  oop: string;
  pfr: string;
  opener: string;
  caller: string;
  /** Player names. */
  ipName: string;
  oopName: string;
  pfrName: string;
  openerName: string;
  callerName: string;
  effBb: number;
}

export interface FlopSpotMatch {
  spotId: string;
  spot: CatalogSpot;
  situation: FlopSituation;
  /** 9-max chart position of the opener (kept for older callers). */
  openerPosition: string;
  opener: string;
  caller: string;
  /** The flop as dealt, and its canonical key in flop_equity. */
  cards: string[];
  flop: string;
  effBb: number;
  /** Hero's side in the spot, or null when Hero is not one of the two players. */
  heroSide: "ip" | "oop" | null;
  /** Hero raised last preflop (c-bettor). */
  heroIsPfr: boolean;
  /** Hero's starting hand class (e.g. "AKo") when Hero is in the pot. */
  heroHand: string | null;
}

export type FlopMatchResult =
  | { ok: true; match: FlopSpotMatch }
  | { ok: false; reason: NoMatchReason; situation?: FlopSituation };

/** The preflop line to the flop: pot type, positions, effective stack. */
export function flopSituation(hand: ParsedHand): { ok: true; situation: FlopSituation } | { ok: false; reason: NoMatchReason } {
  if ("format" in hand && (hand as { format?: string }).format === "cash") return { ok: false, reason: "cash" };
  if (hand.board.flop.length !== 3 || hand.bigBlind <= 0) return { ok: false, reason: "no_flop" };

  const pre = hand.events.filter((e): e is Action => e.kind === "action" && e.street === "preflop");
  const acting = pre.filter((a) => a.action !== "fold");
  const folded = new Set(pre.filter((a) => a.action === "fold").map((a) => a.player));
  const inPot = hand.players.filter((p) => !folded.has(p.name));
  if (inPot.length > 2) return { ok: false, reason: "multiway" };
  if (pre.some((a) => a.allIn)) return { ok: false, reason: "allin_preflop" };

  const raises = acting.filter((a) => a.action === "raise" || a.action === "bet");
  if (!raises.length) return { ok: false, reason: "limped" };
  if (raises.length > 2) return { ok: false, reason: "four_bet" };
  // A limp before the open (limp, then raise) is not a spot the book covers.
  if (acting.indexOf(raises[0]) > 0) return { ok: false, reason: "limped" };

  const stackOf = (name: string) => hand.players.find((p) => p.name === name)?.stack ?? 0;
  const open = raises[0];
  const openTo = open.toAmount ?? open.amount;
  if (openTo >= NEAR_ALL_IN * (stackOf(open.player) - hand.ante)) return { ok: false, reason: "allin_preflop" };
  if (raises.length === 1 && openTo / hand.bigBlind > MAX_OPEN_BB) return { ok: false, reason: "no_book_range" };

  const players = inPot.map((p) => p.name);
  if (players.length !== 2) return { ok: false, reason: "multiway" };
  const pfrName = raises[raises.length - 1].player;
  const opener = open.player;
  const other = players.find((n) => n !== opener);
  if (!other || !players.includes(opener)) return { ok: false, reason: "no_book_range" };
  if (raises.length === 2) {
    const three = raises[1];
    const to = three.toAmount ?? three.amount;
    if (to >= NEAR_ALL_IN * (stackOf(three.player) - hand.ante)) return { ok: false, reason: "allin_preflop" };
    if (three.player === opener) return { ok: false, reason: "four_bet" };
  }

  const pos = (n: string) => position9(hand, n);
  const oPos = pos(opener);
  const cPos = pos(other);
  if (!oPos || !cPos) return { ok: false, reason: "unknown_position" };
  const [ipName, oopName] = POSTFLOP_ORDER.indexOf(oPos) > POSTFLOP_ORDER.indexOf(cPos) ? [opener, other] : [other, opener];
  const effBb = Math.min(stackOf(opener), stackOf(other)) / hand.bigBlind;
  return {
    ok: true,
    situation: {
      pot: raises.length === 2 ? "3bp" : "srp",
      ip: pos(ipName)!,
      oop: pos(oopName)!,
      pfr: pos(pfrName)!,
      opener: oPos,
      caller: cPos,
      ipName,
      oopName,
      pfrName,
      openerName: opener,
      callerName: other,
      effBb,
    },
  };
}

/** The catalog spot for a situation: same structure and positions, nearest stack within ±30%. */
export function spotFor(s: FlopSituation): { spot: CatalogSpot } | { reason: NoMatchReason } {
  const same = SPOT_CATALOG.filter((c) => c.pot === s.pot && c.ip === s.ip && c.oop === s.oop && c.pfr === s.pfr);
  if (!same.length) return { reason: "no_book_range" };
  const best = same.reduce((b, c) => (Math.abs(c.stack_bb - s.effBb) < Math.abs(b.stack_bb - s.effBb) ? c : b));
  if (Math.abs(best.stack_bb - s.effBb) > STACK_TOLERANCE * best.stack_bb) {
    return { reason: s.effBb > best.stack_bb ? "stack_too_deep" : "stack_too_short" };
  }
  return { spot: best };
}

export function matchFlop(hand: ParsedHand): FlopMatchResult {
  const sit = flopSituation(hand);
  if (!sit.ok) return { ok: false, reason: sit.reason };
  const s = sit.situation;
  const found = spotFor(s);
  if ("reason" in found) return { ok: false, reason: found.reason, situation: s };
  const hero = hand.heroName;
  const heroSide = hero === s.ipName ? "ip" : hero === s.oopName ? "oop" : null;
  return {
    ok: true,
    match: {
      spotId: found.spot.spot_id,
      spot: found.spot,
      situation: s,
      openerPosition: s.opener,
      opener: s.openerName,
      caller: s.callerName,
      cards: hand.board.flop,
      flop: canonicalFlop(hand.board.flop),
      effBb: Math.round(s.effBb * 10) / 10,
      heroSide,
      heroIsPfr: hero === s.pfrName,
      heroHand: heroSide && hand.heroCards ? handClass(hand.heroCards) : null,
    },
  };
}

/** Backwards-compatible: the match, or null. */
export function matchFlopSpot(hand: ParsedHand): FlopSpotMatch | null {
  const r = matchFlop(hand);
  return r.ok ? r.match : null;
}

/** "SRP · BTN vs BB · 25bb" (positions in the site's display naming). */
export function spotTitle(spot: CatalogSpot): string {
  const d = (p: string) => (p === "BN" ? "BTN" : p);
  const opener = spot.pot === "3bp" ? (spot.pfr === spot.ip ? spot.oop : spot.ip) : spot.pfr;
  const other = opener === spot.ip ? spot.oop : spot.ip;
  return `${spot.pot === "3bp" ? "3-bet pot" : "SRP"} · ${d(opener)} vs ${d(other)} · ${spot.stack_bb}bb`;
}
