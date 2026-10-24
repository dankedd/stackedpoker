/**
 * Shared-hand snapshot: a ParsedHand with nothing that identifies a player.
 *
 * Every player is renamed to their position ("CO", "BB"), Hero to "Hero";
 * hand id, table, tournament, warnings and the manual-entry details are
 * dropped, and only the date of play is kept. The database checks the same
 * rules again (share_clean_snapshot() in
 * supabase/migrations/20261025_03_hand_shares.sql) and refuses a snapshot
 * with any other name, so a screen name can never be published.
 */

import { buildTimeline, totalOnTable } from "@/lib/handHistory/timeline";
import type { HandEvent, ParsedHand, Street } from "@/lib/handHistory/types";

export const HERO_LABEL = "Hero";

/** Labels the database accepts (share_name_allowed()). */
const ALLOWED = new Set(["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "UTG+3", "LJ", "HJ", "CO"]);

/** Old name → anonymous name, for every seat. */
export function anonymousNames(hand: ParsedHand): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  // Hero first, so no villain can take "Hero".
  for (const p of [...hand.players].sort((a, b) => Number(b.isHero) - Number(a.isHero))) {
    let label = p.isHero ? HERO_LABEL : ALLOWED.has(p.position) ? p.position : `S${p.seat}`;
    if (used.has(label)) label = `S${p.seat}`;
    used.add(label);
    map.set(p.name, label);
  }
  return map;
}

/** A shared hand as stored and served: identifying fields are absent. */
export type SharedHand = Omit<ParsedHand, "handId" | "tableName" | "tournamentId" | "tournamentName" | "warnings"> & {
  handId?: string;
  tableName?: string;
  tournamentId?: string | null;
  tournamentName?: string | null;
  warnings?: string[];
  /** Set by the server: cut off before Hero's decision (guess mode). */
  truncated?: boolean;
  /** Set by the server: winners and showdown cards removed. */
  resultHidden?: boolean;
};

export function anonymizeHand(hand: ParsedHand): SharedHand {
  const names = anonymousNames(hand);
  const rename = (n: string) => names.get(n) ?? n;
  const events: HandEvent[] = hand.events.map((e) => ("player" in e ? { ...e, player: rename(e.player) } : { ...e }));
  const { handId: _h, tableName: _t, tournamentId: _ti, tournamentName: _tn, warnings: _w, manual, ...rest } = hand;
  return {
    ...rest,
    playedAt: hand.playedAt.slice(0, 10),
    players: hand.players.map((p) => ({ ...p, name: rename(p.name) })),
    heroName: HERO_LABEL,
    events,
    shown: Object.fromEntries(Object.entries(hand.shown).map(([k, v]) => [rename(k), v])),
    winners: hand.winners.map((w) => ({ ...w, player: rename(w.player) })),
    ...(manual ? { manual: { assumedStacks: manual.assumedStacks, live: manual.live, venue: null, buyIn: null, streets: manual.streets } } : {}),
  };
}

// ── Guess mode ────────────────────────────────────────────────────────────

export type GuessChoice = "fold" | "check" | "call" | "bet" | "raise";

export interface DecisionPoint {
  /** Index in hand.events of Hero's action. */
  eventIndex: number;
  street: Street;
  options: GuessChoice[];
  actual: GuessChoice;
  /** Chips Hero had to call (0 = could check). */
  toCall: number;
  /** Pot (incl. all bets on the table) when Hero decided, in chips. */
  pot: number;
}

/**
 * Every spot where Hero acted voluntarily, with the choices Hero had: facing
 * a bet → fold / call / raise (no raise when calling puts Hero all in);
 * nothing to call → check / bet, or check / raise preflop (the blinds count
 * as a bet). Works on a named or an anonymised hand.
 */
export function decisionPoints(hand: Pick<ParsedHand, "events" | "players" | "heroName">): DecisionPoint[] {
  const hero = hand.heroName;
  if (!hero) return [];
  const steps = buildTimeline(hand as ParsedHand);
  const out: DecisionPoint[] = [];
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const e = step.events[0];
    if (step.kind !== "action" || !e || e.kind !== "action" || e.player !== hero) continue;
    const before = steps[i - 1];
    const maxBet = Math.max(0, ...Object.values(before.bets));
    const mine = before.bets[hero] ?? 0;
    const toCall = Math.max(0, maxBet - mine);
    const stack = before.stacks[hero] ?? 0;
    let options: GuessChoice[];
    if (toCall > 0) options = stack > toCall ? ["fold", "call", "raise"] : ["fold", "call"];
    else options = maxBet > 0 ? ["check", "raise"] : ["check", "bet"];
    let actual: GuessChoice = e.action;
    if (!options.includes(actual)) actual = actual === "bet" || actual === "raise" ? (options.includes("raise") ? "raise" : "bet") : actual;
    if (!options.includes(actual)) continue;
    out.push({ eventIndex: hand.events.indexOf(e), street: e.street, options, actual, toCall, pot: totalOnTable(before) });
  }
  return out;
}

/** The default spot to quiz: Hero's last decision that wasn't a check-through. */
export function defaultDecision(points: DecisionPoint[]): DecisionPoint | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (!(points[i].actual === "check" && points[i].toCall === 0)) return points[i];
  }
  return points[points.length - 1] ?? null;
}
