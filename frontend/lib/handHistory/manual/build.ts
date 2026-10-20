/**
 * Manual hand entry — pots, winners and the ParsedHand.
 *
 * The result is the same ParsedHand a site parser produces (site "manual"),
 * so the replayer, the preflop check, the equity and the pot odds treat it
 * exactly like an imported hand.
 */

import { evaluateHand } from "@/lib/tools/handEvaluator";
import type { HandEvent, ParsedHand, Street } from "../types";
import { assumedStacks, buildPlayers, HERO, ManualHandError, type ManualSetup, type ManualState } from "./engine";

export interface Pot {
  amount: number;
  /** Players still in who can win it. */
  eligible: string[];
}

/**
 * Main pot and side pots from what everyone put in. Antes are dead money:
 * they go into the main pot and don't decide who can win which pot.
 */
export function computePots(state: ManualState): Pot[] {
  const live = state.seats.filter((s) => !s.folded);
  const bet = (s: ManualState["seats"][number]) => s.committed - s.dead;
  const levels = [...new Set(live.map(bet).filter((c) => c > 0))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    const amount = state.seats.reduce((a, s) => a + Math.max(0, Math.min(bet(s), level) - Math.min(bet(s), prev)), 0);
    const eligible = live.filter((s) => s.committed >= level).map((s) => s.name);
    const last = pots.at(-1);
    if (last && last.eligible.join() === eligible.join()) last.amount += amount;
    else if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  // The antes (and any folded money above the last level) go into the main pot.
  const total = state.seats.reduce((a, s) => a + s.committed, 0);
  const counted = pots.reduce((a, p) => a + p.amount, 0);
  if (!pots.length && total > 0) pots.push({ amount: 0, eligible: live.map((s) => s.name) });
  if (pots.length && total > counted) pots[0].amount += total - counted;
  return pots;
}

/** Winners of a pot from the cards, when every eligible hand and the full board are known. */
export function evaluatePot(pot: Pot, board: string[], cardsOf: (player: string) => string[] | null): string[] | null {
  if (pot.eligible.length === 1) return pot.eligible;
  if (board.length !== 5) return null;
  const scores: [string, number][] = [];
  for (const p of pot.eligible) {
    const cards = cardsOf(p);
    if (!cards || cards.length !== 2) return null;
    scores.push([p, evaluateHand([...cards, ...board]).score]);
  }
  const best = Math.max(...scores.map(([, s]) => s));
  return scores.filter(([, s]) => s === best).map(([p]) => p);
}

export interface ShowdownInput {
  /** Opponents' shown cards (Hero's are always known). Missing = unknown. */
  shown: Record<string, string[]>;
  /** The user's pick per pot (index), when the cards can't decide it. */
  potWinners: Record<number, string[]>;
}

export interface Resolution {
  pots: Pot[];
  winners: string[][];
  /** Pot indexes that still need the user to pick a winner. */
  undecided: number[];
}

export function resolveShowdown(setup: ManualSetup, state: ManualState, input: ShowdownInput): Resolution {
  const pots = computePots(state);
  const cardsOf = (p: string) => (p === HERO ? setup.heroCards : input.shown[p] ?? null);
  const winners: string[][] = [];
  const undecided: number[] = [];
  pots.forEach((pot, i) => {
    const byCards = evaluatePot(pot, state.board, cardsOf);
    const picked = input.potWinners[i]?.filter((p) => pot.eligible.includes(p));
    const w = byCards ?? (picked?.length ? picked : null);
    if (w) winners.push(w);
    else {
      winners.push([]);
      undecided.push(i);
    }
  });
  return { pots, winners, undecided };
}

/** Lowercase-dash id for a manual tournament ("Holland Casino Main" → "holland-casino-main"). */
export function manualTournamentId(name: string): string | null {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");
  return slug || null;
}

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

/** The ParsedHand for a finished manual hand. */
export function buildManualHand(setup: ManualSetup, state: ManualState, input: ShowdownInput, handId: string): ParsedHand {
  if (!state.finished) throw new ManualHandError("Finish the hand first: there is still action or a card to enter.");
  const res = resolveShowdown(setup, state, input);
  if (res.undecided.length) throw new ManualHandError("Pick who won the pot.");

  const players = buildPlayers(setup);
  const events: HandEvent[] = [...state.events];
  const finalStreet = state.street;

  // Showdown: the cards are turned over when the betting ends (before an
  // all-in runout, like GGPoker prints it).
  if (state.showdown) {
    const shows: HandEvent[] = [];
    const live = state.seats.filter((s) => !s.folded).map((s) => s.name);
    for (const p of live) {
      const cards = p === HERO ? setup.heroCards : input.shown[p];
      if (cards?.length === 2) shows.push({ kind: "show", street: finalStreet, player: p, cards });
    }
    const lastBetting = events.reduce((idx, e, i) => (e.kind === "action" || e.kind === "uncalled" ? i : idx), -1);
    const runout = events.slice(lastBetting + 1).some((e) => e.kind === "deal");
    if (runout) {
      const street = (events[lastBetting] as { street: Street } | undefined)?.street ?? "preflop";
      events.splice(lastBetting + 1, 0, ...shows.map((s) => ({ ...s, street }) as HandEvent));
    } else events.push(...shows);
  }

  const winners = new Map<string, number>();
  res.pots.forEach((pot, i) => {
    const w = res.winners[i];
    const share = Math.floor(pot.amount / w.length);
    w.forEach((p, k) => {
      const amount = share + (k === 0 ? pot.amount - share * w.length : 0);
      winners.set(p, (winners.get(p) ?? 0) + amount);
    });
  });
  for (const [player, amount] of winners) events.push({ kind: "collect", street: finalStreet, player, amount });

  const shown: Record<string, string[]> = {};
  for (const e of events) if (e.kind === "show") shown[e.player] = e.cards;

  const board = state.board;
  const tournamentName = setup.tournamentName.trim() || null;
  return {
    site: "manual",
    handId,
    tournamentId: setup.format === "tournament" && tournamentName ? manualTournamentId(tournamentName) : null,
    tournamentName,
    game: "Hold'em No Limit",
    level: setup.level,
    smallBlind: setup.smallBlind,
    bigBlind: setup.bigBlind,
    // Per-player ante only: a big-blind ante is a single post by the big blind.
    ante: setup.anteType === "per_player" ? setup.ante : 0,
    playedAt: setup.playedAt,
    tableName: setup.venue.trim() || (setup.live ? "Live" : "Manual"),
    maxSeats: setup.playerCount,
    buttonSeat: setup.playerCount,
    players,
    heroName: HERO,
    heroCards: [...setup.heroCards],
    events,
    board: { flop: board.slice(0, 3), turn: board[3] ?? null, river: board[4] ?? null },
    shown,
    winners: [...winners].map(([player, amount]) => ({ player, amount })),
    totalPot: res.pots.reduce((a, p) => a + p.amount, 0),
    rake: 0,
    warnings: [],
    format: setup.format,
    manual: {
      assumedStacks: assumedStacks(setup),
      live: setup.live,
      venue: setup.venue.trim() || null,
      buyIn: setup.buyIn.trim() || null,
      streets: STREET_ORDER.indexOf(finalStreet) + 1,
      entry: { setup, steps: state.steps, shown: input.shown, potWinners: input.potWinners },
    },
  };
}
