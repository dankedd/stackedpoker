"use client";

/**
 * seatEngine.ts — Converts a ReplayAnalysis into a canonical SeatDescriptor[]
 * ready for PokerTable.tsx rendering.
 *
 * Two paths — always prefer the topology path:
 *
 *   PATH A (topology):      hand_summary.players[] is populated (new backend).
 *                           Deterministic: uses pre-computed seat_index values.
 *
 *   PATH B (action-order):  Legacy / fallback when players[] is empty.
 *                           Infers topology from preflop action sequence.
 *                           N is taken from hand_summary.player_count when
 *                           available, preventing the "early folder = wrong N"
 *                           bug that caused mismatched table layouts.
 *
 * SeatDescriptor is a type alias for CanonicalSeat so all consumers share
 * one canonical interface. Import CanonicalSeat from canonicalSeat.ts directly
 * for new code; SeatDescriptor is kept for backward compatibility.
 */

import type { ReplayAnalysis, SeatedPlayer } from "@/lib/types";
import {
  POSITIONS_BY_SIZE,
  normalizePosition,
  clockwiseIndexOf,
  preflopToClockwise,
} from "./positions";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * SeatDescriptor — canonical seat type used by PokerTable.tsx.
 * Alias of CanonicalSeat for backward compatibility with existing components.
 */
export interface SeatDescriptor {
  seatIndex: number;         // 0 = hero (bottom-center), 1..N-1 clockwise
  playerName: string | null;
  position: string;          // canonical: "BTN" | "SB" | "BB" | "UTG" | "HJ" | "CO" …
  isHero: boolean;
  isSitting: boolean;
  cards: string[];
  cardsKnown: boolean;
  foldedAtStep: number | null;
  stack_bb?: number;
  // ── Extended canonical fields ──────────────────────────────────────────
  isButton: boolean;
  isSb: boolean;
  isBb: boolean;
  preflopOrder: number;      // 0 = first to act preflop
  postflopOrder: number;     // 0 = first to act postflop (OOP)
}

// ── Postflop order (mirrors canonicalSeat.ts and backend seat_mapping.py) ─────
const _POSTFLOP_ORDER: readonly string[] = [
  "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN",
] as const;

function postflopOrderOf(pos: string, n: number): number {
  const canonical = POSITIONS_BY_SIZE[n] ?? POSITIONS_BY_SIZE[6];
  const active = _POSTFLOP_ORDER.filter((p) => canonical.includes(p));
  const idx = active.indexOf(normalizePosition(pos));
  return idx >= 0 ? idx : active.length - 1;
}

function preflopOrderOf(pos: string, n: number): number {
  const canonical = POSITIONS_BY_SIZE[n] ?? POSITIONS_BY_SIZE[6];
  const p = normalizePosition(pos);
  if (n <= 2) return canonical.indexOf(p);
  const utg = canonical.indexOf("UTG");
  if (utg < 0) return canonical.indexOf(p);
  const shifted = [...canonical.slice(utg), ...canonical.slice(0, utg)];
  const idx = shifted.indexOf(p);
  return idx >= 0 ? idx : canonical.length - 1;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function buildSeatMap(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary } = analysis;
  if (
    hand_summary.players &&
    hand_summary.players.length > 0 &&
    hand_summary.player_count &&
    hand_summary.player_count >= 2
  ) {
    return buildFromTopology(analysis);
  }
  return buildFromActionOrder(analysis);
}

// ── Path A: Topology (preferred, new backend) ─────────────────────────────────
//
// hand_summary.players[] contains SeatedPlayer objects with pre-computed
// seat_index values (0 = hero, 1..N-1 clockwise).  No inference needed.

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
  const heroNorm  = normalizePosition(hand_summary.hero_position);
  const heroCW    = clockwiseIndexOf(heroNorm, N);

  return Array.from({ length: N }, (_, i): SeatDescriptor => {
    const p = byIndex.get(i);

    if (!p) {
      // Ghost seat — position exists but no player occupies it
      const cw  = (heroCW + i) % N;
      const pos = positions[cw] ?? "—";
      return {
        seatIndex:     i,
        playerName:    null,
        position:      pos,
        isHero:        false,
        isSitting:     false,
        cards:         [],
        cardsKnown:    false,
        foldedAtStep:  null,
        isButton:      pos === "BTN",
        isSb:          pos === "SB",
        isBb:          pos === "BB",
        preflopOrder:  preflopOrderOf(pos, N),
        postflopOrder: postflopOrderOf(pos, N),
      };
    }

    const isVillain =
      hand_summary.villain_position != null &&
      normalizePosition(p.position) === normalizePosition(hand_summary.villain_position);
    const pos = normalizePosition(p.position);

    return {
      seatIndex:     i,
      playerName:    p.name,
      position:      pos,
      isHero:        p.is_hero,
      isSitting:     true,
      cards:         p.is_hero
                       ? (hand_summary.hero_cards ?? [])
                       : isVillain
                       ? (hand_summary.villain_cards ?? [])
                       : [],
      cardsKnown:    p.is_hero || (isVillain && !!(hand_summary.villain_cards?.length)),
      foldedAtStep:  foldedAtStep.get(p.name) ?? null,
      stack_bb:      p.stack_bb ?? undefined,
      isButton:      pos === "BTN",
      isSb:          pos === "SB",
      isBb:          pos === "BB",
      preflopOrder:  preflopOrderOf(pos, N),
      postflopOrder: postflopOrderOf(pos, N),
    };
  });
}

// ── Path B: Action-order fallback (legacy / vision without topology) ───────────
//
// Reconstructs topology from the preflop action sequence.
//
// Critical fix: N is taken from hand_summary.player_count when available.
// Without this, an early fold that isn't captured in the action list causes N
// to be under-counted (e.g. 6-max read as 4-max → completely wrong SEAT_COORDS).

function buildFromActionOrder(analysis: ReplayAnalysis): SeatDescriptor[] {
  const { hand_summary, actions } = analysis;

  // ── Collect unique player names in order of first appearance ─────────────
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

  // ── Determine N ───────────────────────────────────────────────────────────
  // CRITICAL: prefer hand_summary.player_count when set (>2 default sentinel),
  // so that a 6-max game where UTG folds silently doesn't appear as 5-max.
  const countFromSummary = hand_summary.player_count ?? 2;
  const countFromActions = orderedPlayers.length;
  // Use the larger of the two; never less than 2, never more than 9.
  const N = Math.min(Math.max(countFromSummary, countFromActions, 2), 9);

  const positions = POSITIONS_BY_SIZE[N] ?? POSITIONS_BY_SIZE[6];

  const heroEntry = orderedPlayers.find((p) => p.isHero);
  const heroName  =
    heroEntry?.name ?? actions.find((a) => a.is_hero)?.player ?? "Hero";
  const heroOrderIdx = orderedPlayers.findIndex((p) => p.isHero);

  const heroKnownPos = normalizePosition(hand_summary.hero_position);
  const heroKnownCW  = clockwiseIndexOf(heroKnownPos, N);

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

  const villainRawPos  = hand_summary.villain_position;
  const villainNormPos = villainRawPos ? normalizePosition(villainRawPos) : null;
  const villainKnownCW = villainNormPos ? clockwiseIndexOf(villainNormPos, N) : null;
  const villainVisualSeat =
    villainKnownCW !== null ? (villainKnownCW - heroKnownCW + N) % N : null;

  const seatOf = new Map<number, SeatDescriptor>();

  // Hero always at seatIndex 0
  seatOf.set(0, buildDescriptor(0, heroName, heroKnownPos, true, true,
    hand_summary.hero_cards ?? [], true,
    foldedAtStep.get(heroName) ?? null,
    hand_summary.effective_stack_bb > 0 ? hand_summary.effective_stack_bb : undefined,
    N,
  ));

  for (const { name, isHero } of orderedPlayers) {
    if (isHero) continue;
    const cw = cwOf.get(name) ?? 1;
    const visualSeat = (cw - heroKnownCW + N) % N;
    const isKnownVillain =
      villainVisualSeat !== null && visualSeat === villainVisualSeat;
    const knownCards = isKnownVillain ? (hand_summary.villain_cards ?? []) : [];
    if (!seatOf.has(visualSeat)) {
      seatOf.set(visualSeat, buildDescriptor(
        visualSeat, name, positions[cw] ?? "?", false, true,
        knownCards, knownCards.length > 0,
        foldedAtStep.get(name) ?? null,
        undefined,
        N,
      ));
    }
  }

  // Fill ghost seats for any unoccupied visual positions
  for (let i = 0; i < N; i++) {
    if (!seatOf.has(i)) {
      const cw  = (heroKnownCW + i) % N;
      const pos = positions[cw] ?? "—";
      seatOf.set(i, buildDescriptor(
        i, null, pos, false, false, [], false, null, undefined, N,
      ));
    }
  }

  return Array.from({ length: N }, (_, i) => seatOf.get(i)!);
}

// ── Helper: build a SeatDescriptor with all canonical fields ─────────────────

function buildDescriptor(
  seatIndex: number,
  playerName: string | null,
  position: string,
  isHero: boolean,
  isSitting: boolean,
  cards: string[],
  cardsKnown: boolean,
  foldedAtStep: number | null,
  stack_bb: number | undefined,
  n: number,
): SeatDescriptor {
  const pos = normalizePosition(position);
  return {
    seatIndex,
    playerName,
    position: pos,
    isHero,
    isSitting,
    cards,
    cardsKnown,
    foldedAtStep,
    stack_bb,
    isButton:      pos === "BTN",
    isSb:          pos === "SB",
    isBb:          pos === "BB",
    preflopOrder:  preflopOrderOf(pos, n),
    postflopOrder: postflopOrderOf(pos, n),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a ReplayAnalysis into UI-ready SeatDescriptor[] with hero always at
 * seatIndex 0 (bottom-center) and opponents distributed clockwise.
 */
export function normalizeSeatsRelativeToHero(
  analysis: ReplayAnalysis,
): SeatDescriptor[] {
  return buildSeatMap(analysis);
}
