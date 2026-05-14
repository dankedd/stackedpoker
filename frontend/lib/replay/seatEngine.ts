"use client";

import type { ReplayAnalysis, SeatedPlayer } from "@/lib/types";
import {
  POSITIONS_BY_SIZE,
  normalizePosition,
  clockwiseIndexOf,
  preflopToClockwise,
} from "./positions";

export interface SeatDescriptor {
  seatIndex: number;         // 0 = hero (bottom), clockwise
  playerName: string | null; // null = empty seat (no one sat here)
  position: string;          // "BTN", "SB", "BB", "UTG", …
  isHero: boolean;
  isSitting: boolean;        // false → ghost seat (position exists but no player)
  cards: string[];           // known face-up cards; empty → show card backs
  cardsKnown: boolean;       // true → render face-up PlayingCard
  foldedAtStep: number | null; // the step index at which this player folded
  stack_bb?: number;         // starting stack in BB; undefined if not available
}

export function buildSeatMap(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary } = analysis;
  if (
    hand_summary.players &&
    hand_summary.players.length > 0 &&
    hand_summary.player_count
  ) {
    return buildFromTopology(analysis);
  }
  return buildFromActionOrder(analysis);
}

// ── Topology path (new backend) ──────────────────────────────────────────────
// Uses SeatedPlayer[] from hand_summary — fully correct for partial tables.

function buildFromTopology(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary, actions } = analysis;
  const N = hand_summary.player_count!;
  const players = hand_summary.players!;

  const foldedAtStep = new Map<string, number>();
  actions.forEach((a, step) => {
    if (a.action === "fold" && !foldedAtStep.has(a.player)) {
      foldedAtStep.set(a.player, step);
    }
  });

  const byIndex = new Map<number, SeatedPlayer>(players.map((p) => [p.seat_index, p]));

  const positions = POSITIONS_BY_SIZE[N] ?? POSITIONS_BY_SIZE[6];
  const heroCW = clockwiseIndexOf(normalizePosition(hand_summary.hero_position), N);

  return Array.from({ length: N }, (_, i) => {
    const p = byIndex.get(i);

    if (!p) {
      const cw = (heroCW + i) % N;
      return {
        seatIndex: i,
        playerName: null,
        position: positions[cw] ?? "—",
        isHero: false,
        isSitting: false,
        cards: [],
        cardsKnown: false,
        foldedAtStep: null,
      };
    }

    const isVillain =
      hand_summary.villain_position != null &&
      normalizePosition(p.position) === normalizePosition(hand_summary.villain_position);

    return {
      seatIndex: i,
      playerName: p.name,
      position: p.position,
      isHero: p.is_hero,
      isSitting: true,
      cards: p.is_hero
        ? (hand_summary.hero_cards ?? [])
        : isVillain
        ? (hand_summary.villain_cards ?? [])
        : [],
      cardsKnown: p.is_hero || (isVillain && !!(hand_summary.villain_cards?.length)),
      foldedAtStep: foldedAtStep.get(p.name) ?? null,
      stack_bb: p.stack_bb ?? undefined,
    };
  });
}

// ── Action-order fallback (legacy / vision path) ─────────────────────────────
// Infers seat count and topology from preflop action order.

function buildFromActionOrder(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary, actions } = analysis;

  const preflopActions = actions.filter((a) => a.street === "preflop");
  const source = preflopActions.length > 0 ? preflopActions : actions;

  const seenNames = new Set<string>();
  const orderedPlayers: Array<{ name: string; isHero: boolean }> = [];
  for (const a of source) {
    if (!seenNames.has(a.player)) {
      seenNames.add(a.player);
      orderedPlayers.push({ name: a.player, isHero: !!a.is_hero });
    }
  }
  for (const a of actions) {
    if (!seenNames.has(a.player)) {
      seenNames.add(a.player);
      orderedPlayers.push({ name: a.player, isHero: !!a.is_hero });
    }
  }

  const N = Math.min(Math.max(orderedPlayers.length, 2), 9);
  const positions = POSITIONS_BY_SIZE[N] ?? POSITIONS_BY_SIZE[6];

  const heroEntry = orderedPlayers.find((p) => p.isHero);
  const heroName =
    heroEntry?.name ?? actions.find((a) => a.is_hero)?.player ?? "Hero";
  const heroOrderIdx = orderedPlayers.findIndex((p) => p.isHero);

  const heroKnownPos = normalizePosition(hand_summary.hero_position);
  const heroKnownCW = clockwiseIndexOf(heroKnownPos, N);

  const heroRawCW =
    heroOrderIdx >= 0 ? preflopToClockwise(heroOrderIdx, N) : heroKnownCW;
  const calibration = (heroKnownCW - heroRawCW + N) % N;

  const cwOf = new Map<string, number>();
  for (let i = 0; i < orderedPlayers.length; i++) {
    const raw = preflopToClockwise(i, N);
    cwOf.set(orderedPlayers[i].name, (raw + calibration) % N);
  }

  const foldedAtStep = new Map<string, number>();
  actions.forEach((a, step) => {
    if (a.action === "fold" && !foldedAtStep.has(a.player)) {
      foldedAtStep.set(a.player, step);
    }
  });

  const villainRawPos = hand_summary.villain_position;
  const villainNormPos = villainRawPos ? normalizePosition(villainRawPos) : null;
  const villainKnownCW =
    villainNormPos ? clockwiseIndexOf(villainNormPos, N) : null;
  const villainVisualSeat =
    villainKnownCW !== null
      ? (villainKnownCW - heroKnownCW + N) % N
      : null;

  const seatOf = new Map<number, SeatDescriptor>();

  seatOf.set(0, {
    seatIndex: 0,
    playerName: heroName,
    position: heroKnownPos,
    isHero: true,
    isSitting: true,
    cards: hand_summary.hero_cards ?? [],
    cardsKnown: true,
    foldedAtStep: foldedAtStep.get(heroName) ?? null,
    stack_bb: hand_summary.effective_stack_bb > 0 ? hand_summary.effective_stack_bb : undefined,
  });

  for (const { name, isHero } of orderedPlayers) {
    if (isHero) continue;
    const cw = cwOf.get(name) ?? 1;
    const visualSeat = (cw - heroKnownCW + N) % N;
    const isKnownVillain =
      villainVisualSeat !== null && visualSeat === villainVisualSeat;
    const knownCards = isKnownVillain
      ? (hand_summary.villain_cards ?? [])
      : [];
    if (!seatOf.has(visualSeat)) {
      seatOf.set(visualSeat, {
        seatIndex: visualSeat,
        playerName: name,
        position: positions[cw] ?? "?",
        isHero: false,
        isSitting: true,
        cards: knownCards,
        cardsKnown: knownCards.length > 0,
        foldedAtStep: foldedAtStep.get(name) ?? null,
      });
    }
  }

  for (let i = 0; i < N; i++) {
    if (!seatOf.has(i)) {
      const cw = (heroKnownCW + i) % N;
      seatOf.set(i, {
        seatIndex: i,
        playerName: null,
        position: positions[cw] ?? "—",
        isHero: false,
        isSitting: false,
        cards: [],
        cardsKnown: false,
        foldedAtStep: null,
      });
    }
  }

  return Array.from({ length: N }, (_, i) => seatOf.get(i)!);
}
