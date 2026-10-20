/**
 * Manual hand entry — the betting engine.
 *
 * A manual hand is a setup (table, blinds, stacks, Hero's cards) plus a list
 * of steps (actions and dealt cards). `replay` turns that into the current
 * state: whose turn it is, which actions are legal, the pot, and the
 * HandEvents a site parser would have produced. Everything is replayed from
 * scratch, so Undo is "drop the last step".
 *
 * No-limit hold'em rules:
 *  - antes (per player or one big-blind ante) and blinds are posted first;
 *    a short stack posts what it has and is all-in;
 *  - preflop starts left of the big blind, later streets left of the button
 *    (heads-up: the button is the small blind and acts first preflop);
 *  - minimum bet is one big blind, minimum raise is the size of the last
 *    full bet or raise;
 *  - an all-in raise smaller than a full raise does not reopen the betting
 *    for players who already acted;
 *  - a bet nobody matched comes back as an "uncalled bet";
 *  - when at most one player can still bet, the rest of the board is dealt
 *    without actions.
 *
 * Amounts are chips. All validation errors are thrown as ManualHandError with
 * a message for the user.
 */

import { assignPositions } from "../parsers/shared";
import type { BetAction, HandEvent, HandPlayer, Street } from "../types";

export type GameFormat = "tournament" | "cash";
export type AnteType = "none" | "per_player" | "bb_ante";
export type DealStreet = Exclude<Street, "preflop">;

export interface ManualSetup {
  format: GameFormat;
  /** 2–10. */
  playerCount: number;
  smallBlind: number;
  bigBlind: number;
  /** Per player for "per_player", the big blind's total for "bb_ante". */
  ante: number;
  anteType: AnteType;
  level: number | null;
  heroPosition: string;
  heroStack: number;
  /** Other players' stacks by position; null or missing = same as Hero (assumed). */
  stacks: Record<string, number | null>;
  heroCards: string[];
  tournamentName: string;
  /** "2026-10-19T21:30" (local, no zone), like imported hands. */
  playedAt: string;
  buyIn: string;
  live: boolean;
  venue: string;
}

export type PlayerAction = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export type ManualStep =
  | { kind: "action"; player: string; action: PlayerAction; /** Street total for bet/raise. */ to?: number }
  | { kind: "deal"; street: DealStreet; cards: string[] };

export class ManualHandError extends Error {}

export const HERO = "Hero";

interface Seat {
  seat: number;
  name: string;
  position: string;
  start: number;
  behind: number;
  /** All chips put in this hand, antes included. */
  committed: number;
  /** The part of `committed` that is ante: dead money, it goes into the main pot. */
  dead: number;
  streetBet: number;
  folded: boolean;
  allIn: boolean;
}

export interface Legal {
  player: string;
  toCall: number;
  /** Chips a call adds (less than toCall when it puts the player all-in). */
  callAmount: number;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  /** Smallest legal street total for a bet/raise (below it only all-in). */
  minTo: number;
  /** Street total when going all-in. */
  maxTo: number;
  pot: number;
}

export interface ManualState {
  seats: Seat[];
  street: Street;
  board: string[];
  currentBet: number;
  minRaise: number;
  pending: Set<string>;
  /** Acted since the last full bet/raise: an incomplete all-in does not reopen their action. */
  actedSinceFull: Set<string>;
  lastActor: string | null;
  events: HandEvent[];
  /** Whose turn it is, or null. */
  toAct: string | null;
  /** Betting is done and these cards are next. */
  needsDeal: DealStreet | null;
  /** The hand is over (everyone folded, or the river was dealt/played). */
  finished: boolean;
  /** Betting ended with two or more players in (showdown). */
  showdown: boolean;
  /** Steps that were applied (for streets_entered and drafts). */
  steps: ManualStep[];
}

// ── Table ────────────────────────────────────────────────────────────────────

/** Position labels for a table of `n`, BTN first (same names as imports). */
export function positionsFor(n: number): string[] {
  const players: HandPlayer[] = Array.from({ length: n }, (_, i) => ({
    seat: i + 1,
    name: `S${i + 1}`,
    stack: 0,
    isHero: false,
    position: "",
  }));
  assignPositions(players, n);
  // Order: button first, then clockwise.
  return [players[n - 1], ...players.slice(0, n - 1)].map((p) => p.position);
}

/** Seats 1..n with the button on seat n; positions as the importers assign them. */
export function buildPlayers(setup: ManualSetup): HandPlayer[] {
  const n = setup.playerCount;
  const players: HandPlayer[] = Array.from({ length: n }, (_, i) => ({ seat: i + 1, name: "", stack: 0, isHero: false, position: "" }));
  assignPositions(players, n);
  if (!players.some((p) => p.position === setup.heroPosition)) throw new ManualHandError("Pick Hero's position.");
  for (const p of players) {
    p.isHero = p.position === setup.heroPosition;
    p.name = p.isHero ? HERO : p.position;
    p.stack = p.isHero ? setup.heroStack : stackFor(setup, p.position);
  }
  return players;
}

export function stackFor(setup: ManualSetup, position: string): number {
  const s = setup.stacks[position];
  return s != null && s > 0 ? s : setup.heroStack;
}

/** Positions whose stack was not entered (assumed equal to Hero's). */
export function assumedStacks(setup: ManualSetup): string[] {
  return positionsFor(setup.playerCount).filter((p) => p !== setup.heroPosition && !(setup.stacks[p] != null && setup.stacks[p]! > 0));
}

// ── Setup validation ─────────────────────────────────────────────────────────

const RANKS = "AKQJT98765432";
const SUITS = "shdc";
export const ALL_CARDS: string[] = [...RANKS].flatMap((r) => [...SUITS].map((s) => r + s));

export function isCard(c: string): boolean {
  return c.length === 2 && RANKS.includes(c[0]) && SUITS.includes(c[1]);
}

/** Problems with the setup, as messages; empty = ready to enter actions. */
export function validateSetup(s: ManualSetup): string[] {
  const out: string[] = [];
  if (!Number.isInteger(s.playerCount) || s.playerCount < 2 || s.playerCount > 10) out.push("A table has 2 to 10 players.");
  if (!(s.bigBlind > 0)) out.push("Enter the big blind.");
  if (!(s.smallBlind > 0)) out.push("Enter the small blind.");
  if (s.smallBlind > s.bigBlind) out.push("The small blind can't be bigger than the big blind.");
  if (s.anteType !== "none" && !(s.ante > 0)) out.push("Enter the ante, or choose no ante.");
  if (!(s.heroStack > 0)) out.push("Enter Hero's stack.");
  for (const [pos, v] of Object.entries(s.stacks)) if (v != null && v < 0) out.push(`${pos}'s stack can't be negative.`);
  if (s.heroCards.length !== 2 || !s.heroCards.every(isCard)) out.push("Pick Hero's two cards.");
  else if (s.heroCards[0] === s.heroCards[1]) out.push("Hero's two cards must be different.");
  if (!positionsFor(Math.min(Math.max(s.playerCount, 2), 10)).includes(s.heroPosition)) out.push("Pick Hero's position.");
  return out;
}

// ── Replay ───────────────────────────────────────────────────────────────────

function order(state: ManualState, from: number): Seat[] {
  const n = state.seats.length;
  return Array.from({ length: n }, (_, k) => state.seats[(from + k) % n]);
}

const canAct = (s: Seat) => !s.folded && !s.allIn;
const inHand = (st: ManualState) => st.seats.filter((s) => !s.folded);

function seatIndex(state: ManualState, name: string): number {
  return state.seats.findIndex((s) => s.name === name);
}

function buttonIndex(state: ManualState): number {
  return state.seats.length - 1; // seat n
}

function blindIndices(state: ManualState): { sb: number; bb: number } {
  const n = state.seats.length;
  // Heads-up the button posts the small blind.
  return n === 2 ? { sb: n - 1, bb: 0 } : { sb: 0, bb: 1 };
}

function post(state: ManualState, s: Seat, kind: "ante" | "small_blind" | "big_blind", amount: number) {
  const paid = Math.min(amount, s.behind);
  if (paid <= 0) return;
  s.behind -= paid;
  s.committed += paid;
  if (kind === "ante") s.dead += paid;
  else s.streetBet += paid;
  if (s.behind === 0) s.allIn = true;
  state.events.push({ kind: "post", street: "preflop", player: s.name, post: kind, amount: paid, allIn: s.behind === 0 });
}

export function initialState(setup: ManualSetup): ManualState {
  const players = buildPlayers(setup);
  const state: ManualState = {
    seats: players.map((p) => ({
      seat: p.seat,
      name: p.name,
      position: p.position,
      start: p.stack,
      behind: p.stack,
      committed: 0,
      dead: 0,
      streetBet: 0,
      folded: false,
      allIn: false,
    })),
    street: "preflop",
    board: [],
    currentBet: 0,
    minRaise: setup.bigBlind,
    pending: new Set(),
    actedSinceFull: new Set(),
    lastActor: null,
    events: [],
    toAct: null,
    needsDeal: null,
    finished: false,
    showdown: false,
    steps: [],
  };
  const { sb, bb } = blindIndices(state);
  if (setup.anteType === "per_player") for (const s of state.seats) post(state, s, "ante", setup.ante);
  if (setup.anteType === "bb_ante") post(state, state.seats[bb], "ante", setup.ante);
  post(state, state.seats[sb], "small_blind", setup.smallBlind);
  post(state, state.seats[bb], "big_blind", setup.bigBlind);
  state.currentBet = Math.max(...state.seats.map((s) => s.streetBet));
  state.minRaise = setup.bigBlind;
  state.pending = new Set(state.seats.filter(canAct).map((s) => s.name));
  state.lastActor = state.seats[bb].name;
  advance(state, bb);
  return state;
}

/** Moves the turn on, or closes the betting round. `fromIdx` = index of the last actor. */
function advance(state: ManualState, fromIdx: number) {
  if (inHand(state).length === 1) {
    closeRound(state);
    state.finished = true;
    state.toAct = null;
    return;
  }
  // Somebody still to act (and able to)?
  const next = order(state, fromIdx + 1).find((s) => state.pending.has(s.name) && canAct(s));
  const othersCanAct = inHand(state).filter(canAct);
  if (next && !(othersCanAct.length === 1 && state.pending.size === 1 && next.streetBet >= state.currentBet)) {
    state.toAct = next.name;
    return;
  }
  closeRound(state);
}

function closeRound(state: ManualState) {
  state.toAct = null;
  // A bet nobody matched comes back.
  const sorted = [...state.seats].sort((a, b) => b.streetBet - a.streetBet);
  const top = sorted[0];
  const second = sorted[1]?.streetBet ?? 0;
  if (top && top.streetBet > second) {
    const back = top.streetBet - second;
    top.streetBet -= back;
    top.committed -= back;
    top.behind += back;
    if (top.behind > 0) top.allIn = false;
    state.events.push({ kind: "uncalled", street: state.street, player: top.name, amount: back });
  }
  for (const s of state.seats) s.streetBet = 0;
  state.currentBet = 0;
  state.pending = new Set();
  state.actedSinceFull = new Set();

  const left = inHand(state);
  if (left.length <= 1) {
    state.finished = true;
    return;
  }
  if (state.street === "river") {
    state.finished = true;
    state.showdown = true;
    return;
  }
  state.needsDeal = state.street === "preflop" ? "flop" : state.street === "flop" ? "turn" : "river";
}

function startStreet(state: ManualState, street: DealStreet, bigBlind: number) {
  state.street = street;
  state.needsDeal = null;
  state.minRaise = bigBlind;
  const active = inHand(state).filter(canAct);
  if (active.length <= 1) {
    // All-in: no more betting, just the cards.
    state.showdown = true;
    if (street === "river") state.finished = true;
    else state.needsDeal = street === "flop" ? "turn" : "river";
    return;
  }
  state.pending = new Set(active.map((s) => s.name));
  state.lastActor = state.seats[buttonIndex(state)].name;
  advance(state, buttonIndex(state));
}

export function legalActions(state: ManualState, bigBlind: number): Legal | null {
  if (!state.toAct) return null;
  const s = state.seats[seatIndex(state, state.toAct)];
  const toCall = Math.max(0, state.currentBet - s.streetBet);
  const maxTo = s.streetBet + s.behind;
  const reopened = !state.actedSinceFull.has(s.name);
  const pot = state.seats.reduce((a, x) => a + x.committed, 0);
  return {
    player: s.name,
    toCall,
    callAmount: Math.min(toCall, s.behind),
    canCheck: toCall === 0,
    canCall: toCall > 0,
    canBet: state.currentBet === 0 && s.behind > 0,
    canRaise: state.currentBet > 0 && reopened && maxTo > state.currentBet && inHand(state).filter(canAct).length > 1,
    minTo: state.currentBet === 0 ? Math.min(bigBlind, maxTo) : Math.min(state.currentBet + state.minRaise, maxTo),
    maxTo,
    pot,
  };
}

function applyAction(state: ManualState, step: Extract<ManualStep, { kind: "action" }>, bigBlind: number) {
  if (state.toAct !== step.player) throw new ManualHandError(`It's ${state.toAct ?? "nobody"}'s turn, not ${step.player}'s.`);
  const legal = legalActions(state, bigBlind)!;
  const idx = seatIndex(state, step.player);
  const s = state.seats[idx];
  const push = (action: BetAction, amount: number, toAmount?: number) =>
    state.events.push({ kind: "action", street: state.street, player: s.name, action, amount, ...(toAmount != null ? { toAmount } : {}), allIn: s.behind === 0 && action !== "fold" && action !== "check" });

  let action = step.action;
  let to = step.to;
  if (action === "allin") {
    to = legal.maxTo;
    action = to <= state.currentBet ? "call" : state.currentBet === 0 ? "bet" : "raise";
  }

  switch (action) {
    case "fold":
      s.folded = true;
      push("fold", 0);
      break;
    case "check":
      if (!legal.canCheck) throw new ManualHandError(`${s.name} can't check: there is a bet of ${state.currentBet} to call.`);
      push("check", 0);
      break;
    case "call": {
      if (!legal.canCall) throw new ManualHandError(`${s.name} has nothing to call; check instead.`);
      const amount = Math.min(legal.toCall, s.behind);
      s.behind -= amount;
      s.streetBet += amount;
      s.committed += amount;
      if (s.behind === 0) s.allIn = true;
      push("call", amount);
      break;
    }
    case "bet":
    case "raise": {
      if (to == null || !Number.isFinite(to)) throw new ManualHandError("Enter an amount.");
      if (action === "bet" && !legal.canBet) throw new ManualHandError(state.currentBet > 0 ? "There is already a bet: raise instead." : `${s.name} can't bet.`);
      if (action === "raise" && !legal.canRaise) {
        throw new ManualHandError(
          state.actedSinceFull.has(s.name)
            ? `${s.name} can't raise: the all-in was smaller than a full raise, so the betting is not reopened. Call or fold.`
            : `${s.name} can't raise here.`,
        );
      }
      if (to > legal.maxTo) throw new ManualHandError(`${s.name} only has ${legal.maxTo} (street total). Use all-in for that.`);
      const allIn = to === legal.maxTo;
      if (to <= state.currentBet) throw new ManualHandError(`A ${action} must be more than the current bet of ${state.currentBet}.`);
      if (!allIn && to < legal.minTo) {
        throw new ManualHandError(action === "bet" ? `The minimum bet is ${legal.minTo}.` : `The minimum raise is to ${legal.minTo}.`);
      }
      const amount = to - s.streetBet;
      const increment = to - state.currentBet;
      const full = state.currentBet === 0 ? to >= Math.min(bigBlind, legal.maxTo) : increment >= state.minRaise;
      s.behind -= amount;
      s.streetBet = to;
      s.committed += amount;
      if (s.behind === 0) s.allIn = true;
      push(action, amount, action === "raise" ? to : undefined);
      if (full) {
        state.minRaise = Math.max(increment, state.minRaise);
        state.actedSinceFull = new Set();
      }
      state.currentBet = to;
      // Everybody else still in has to respond.
      state.pending = new Set(state.seats.filter((x) => canAct(x) && x.name !== s.name).map((x) => x.name));
      break;
    }
  }
  state.pending.delete(s.name);
  state.actedSinceFull.add(s.name);
  state.lastActor = s.name;
  advance(state, idx);
}

export function usedCards(setup: ManualSetup, state: ManualState, shown: Record<string, string[]> = {}): Set<string> {
  return new Set([...setup.heroCards, ...state.board, ...Object.values(shown).flat()]);
}

function applyDeal(state: ManualState, setup: ManualSetup, step: Extract<ManualStep, { kind: "deal" }>) {
  if (state.needsDeal !== step.street) {
    throw new ManualHandError(state.needsDeal ? `Deal the ${state.needsDeal} first.` : "The betting on this street isn't finished yet.");
  }
  const want = step.street === "flop" ? 3 : 1;
  if (step.cards.length !== want || !step.cards.every(isCard)) throw new ManualHandError(`Pick ${want === 3 ? "three cards for the flop" : `one card for the ${step.street}`}.`);
  const used = usedCards(setup, state);
  const dup = step.cards.find((c, i) => used.has(c) || step.cards.indexOf(c) !== i);
  if (dup) throw new ManualHandError(`${dup} is already in use.`);
  state.board.push(...step.cards);
  state.events.push({ kind: "deal", street: step.street, cards: step.cards });
  startStreet(state, step.street, setup.bigBlind);
}

/** The state after `steps`. Throws ManualHandError at the first invalid step. */
export function replay(setup: ManualSetup, steps: ManualStep[]): ManualState {
  const setupErrors = validateSetup(setup);
  if (setupErrors.length) throw new ManualHandError(setupErrors[0]);
  const state = initialState(setup);
  for (const step of steps) {
    if (state.finished) throw new ManualHandError("The hand is already over.");
    if (step.kind === "deal") applyDeal(state, setup, step);
    else {
      if (state.needsDeal) throw new ManualHandError(`Deal the ${state.needsDeal} first.`);
      applyAction(state, step, setup.bigBlind);
    }
    state.steps.push(step);
  }
  return state;
}

/** Steps that fold every player before Hero's next turn (or everyone left, if Hero is done). */
export function foldToHeroSteps(setup: ManualSetup, state: ManualState): ManualStep[] {
  const out: ManualStep[] = [];
  let st = state;
  while (st.toAct && st.toAct !== HERO && !st.finished) {
    const step: ManualStep = { kind: "action", player: st.toAct, action: "fold" };
    out.push(step);
    st = replay(setup, [...st.steps, step]);
  }
  return out;
}

/** Streets that saw cards or actions (1 = preflop only … 4 = river). */
export function streetsEntered(state: ManualState): number {
  return 1 + state.steps.filter((s) => s.kind === "deal").length;
}
