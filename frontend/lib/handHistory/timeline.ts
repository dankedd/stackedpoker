/**
 * Replayer timeline: turns a ParsedHand into a list of table states, one per
 * step. The replayer renders a step and nothing else, so stacks and pot are
 * correct by construction — and the same function is what the tests check.
 *
 * Antes are grouped into one step (eight "posts the ante" clicks teach
 * nothing). Bets are swept into the pot when the street ends, when cards are
 * shown, or when the pot is paid out — the moment a real dealer would.
 */

import { t } from "./strings";
import type { HandEvent, ParsedHand, Street } from "./types";

export type StepKind = "start" | "antes" | "post" | "action" | "uncalled" | "show" | "deal" | "collect";

export interface TimelineStep {
  kind: StepKind;
  street: Street;
  /** Event(s) this step applies; empty for the start step. */
  events: HandEvent[];
  /** Player this step is about (null for deals, antes and the start). */
  player: string | null;
  stacks: Record<string, number>;
  /** Chips in front of each player on the current street. */
  bets: Record<string, number>;
  /** Chips already in the middle (earlier streets and antes). */
  pot: number;
  board: string[];
  folded: string[];
  allIn: string[];
  /** Cards shown so far, by player. */
  shown: Record<string, string[]>;
  /** Short per-seat label for this street ("Call", "Raise", …). */
  seatLabels: Record<string, string>;
  /** Chips paid out to each player by this point. */
  won: Record<string, number>;
}

export function totalOnTable(step: TimelineStep): number {
  return step.pot + Object.values(step.bets).reduce((a, b) => a + b, 0);
}

export function buildTimeline(hand: ParsedHand): TimelineStep[] {
  const stacks: Record<string, number> = {};
  for (const p of hand.players) stacks[p.name] = p.stack;

  let state: TimelineStep = {
    kind: "start",
    street: "preflop",
    events: [],
    player: null,
    stacks: { ...stacks },
    bets: {},
    pot: 0,
    board: [],
    folded: [],
    allIn: [],
    shown: {},
    seatLabels: {},
    won: {},
  };
  const steps: TimelineStep[] = [state];

  const next = (kind: StepKind, events: HandEvent[], player: string | null, mutate: (s: TimelineStep) => void) => {
    const s: TimelineStep = {
      ...state,
      kind,
      events,
      player,
      stacks: { ...state.stacks },
      bets: { ...state.bets },
      board: [...state.board],
      folded: [...state.folded],
      allIn: [...state.allIn],
      shown: { ...state.shown },
      seatLabels: { ...state.seatLabels },
      won: { ...state.won },
    };
    mutate(s);
    steps.push(s);
    state = s;
  };

  const sweep = (s: TimelineStep) => {
    s.pot += Object.values(s.bets).reduce((a, b) => a + b, 0);
    s.bets = {};
  };
  const markAllIn = (s: TimelineStep, player: string, flagged: boolean) => {
    if ((flagged || s.stacks[player] <= 0) && !s.allIn.includes(player)) s.allIn.push(player);
  };

  const antes = hand.events.filter((e) => e.kind === "post" && e.post === "ante");
  if (antes.length) {
    next("antes", antes, null, (s) => {
      for (const e of antes) {
        if (e.kind !== "post") continue;
        s.stacks[e.player] -= e.amount;
        s.pot += e.amount;
        markAllIn(s, e.player, e.allIn);
      }
    });
  }

  for (const e of hand.events) {
    switch (e.kind) {
      case "post":
        if (e.post === "ante") break;
        next("post", [e], e.player, (s) => {
          s.stacks[e.player] -= e.amount;
          s.bets[e.player] = (s.bets[e.player] ?? 0) + e.amount;
          s.seatLabels[e.player] = t.step.seat[e.post];
          markAllIn(s, e.player, e.allIn);
        });
        break;
      case "action":
        next("action", [e], e.player, (s) => {
          s.street = e.street;
          if (e.action === "fold") s.folded.push(e.player);
          s.stacks[e.player] -= e.amount;
          if (e.amount) s.bets[e.player] = (s.bets[e.player] ?? 0) + e.amount;
          s.seatLabels[e.player] = e.allIn ? t.step.seat.allIn : t.step.seat[e.action];
          markAllIn(s, e.player, e.allIn);
        });
        break;
      case "uncalled":
        next("uncalled", [e], e.player, (s) => {
          s.stacks[e.player] += e.amount;
          s.bets[e.player] = (s.bets[e.player] ?? 0) - e.amount;
          if (s.bets[e.player] <= 0) delete s.bets[e.player];
          s.allIn = s.allIn.filter((p) => s.stacks[p] <= 0);
        });
        break;
      case "show":
        next("show", [e], e.player, (s) => {
          sweep(s);
          s.shown[e.player] = e.cards;
        });
        break;
      case "deal":
        next("deal", [e], null, (s) => {
          sweep(s);
          s.street = e.street;
          s.board.push(...e.cards);
          s.seatLabels = {};
        });
        break;
      case "collect":
        next("collect", [e], e.player, (s) => {
          sweep(s);
          s.pot -= e.amount;
          s.stacks[e.player] += e.amount;
          s.won[e.player] = (s.won[e.player] ?? 0) + e.amount;
          s.seatLabels[e.player] = t.step.seat.wins;
        });
        break;
    }
  }
  return steps;
}

/** Index of the first step of the next street after `from` (or the last step). */
export function nextStreetIndex(steps: TimelineStep[], from: number): number {
  for (let i = from + 1; i < steps.length; i++) if (steps[i].kind === "deal") return i;
  const firstCollect = steps.findIndex((s, i) => i > from && s.kind === "collect");
  return firstCollect >= 0 ? firstCollect : steps.length - 1;
}

/** Index of the deal step that started the current street (or 0). */
export function prevStreetIndex(steps: TimelineStep[], from: number): number {
  for (let i = from - 1; i > 0; i--) if (steps[i].kind === "deal") return i;
  return 0;
}

// ── Descriptions ─────────────────────────────────────────────────────────────

export type AmountFormatter = (chips: number) => string;

/** One-line description of what happened in a step. */
export function describeStep(step: TimelineStep, fmt: AmountFormatter): string {
  const e = step.events[0];
  if (step.kind === "start") return t.step.start;
  if (step.kind === "antes") return t.step.antes(fmt((e as { amount: number }).amount));
  if (!e) return "";
  switch (e.kind) {
    case "post":
      return t.step.post(e.player, t.step.postName[e.post] ?? e.post, fmt(e.amount), e.allIn);
    case "action": {
      if (e.action === "fold") return t.step.fold(e.player);
      if (e.action === "check") return t.step.check(e.player);
      if (e.action === "call") return t.step.call(e.player, fmt(e.amount), e.allIn);
      if (e.action === "bet") return t.step.bet(e.player, fmt(e.amount), e.allIn);
      return t.step.raise(e.player, fmt(e.toAmount ?? e.amount), e.allIn);
    }
    case "uncalled":
      return t.step.uncalled(fmt(e.amount), e.player);
    case "show":
      return t.step.show(e.player, e.cards.join(" "));
    case "deal":
      return `${t.street[e.street]}: ${e.cards.join(" ")}`;
    case "collect":
      return t.step.collect(e.player, fmt(e.amount));
  }
}
