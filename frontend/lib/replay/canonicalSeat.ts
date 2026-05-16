/**
 * canonicalSeat.ts — Canonical poker seat/position engine (frontend).
 *
 * SINGLE SOURCE OF TRUTH for all seat/position logic consumed by:
 *   - seatEngine.ts  (topology → SeatDescriptor[])
 *   - PokerTable.tsx (SEAT_COORDS lookup)
 *   - positionEngine.ts (puzzles — imports POSTFLOP_RANK independently)
 *   - coaching / IP-OOP logic
 *
 * THREE CONCEPTS, kept strictly separate:
 *   1. PHYSICAL SEAT    — raw table seat number from hand history (1-9)
 *   2. LOGICAL POSITION — canonical poker label (BTN / SB / BB / UTG / HJ / CO …)
 *   3. VISUAL INDEX     — render offset relative to hero (0 = hero / bottom-center)
 *
 * Consumers must NEVER re-derive position or order from raw seat numbers.
 * Import from here and use the provided helpers.
 */

// ── Re-export base constants from positions.ts ────────────────────────────────
// positions.ts holds the SEAT_COORDS pixel geometry.  canonicalSeat.ts adds the
// semantic layer (CanonicalSeat, validation, action-order helpers) on top.

export {
  POSITIONS_BY_SIZE,
  SEAT_COORDS,
  normalizePosition,
  clockwiseIndexOf,
  preflopToClockwise,
} from "./positions";

import {
  POSITIONS_BY_SIZE,
  clockwiseIndexOf,
  normalizePosition,
} from "./positions";

// ── Postflop action rank ───────────────────────────────────────────────────────
// SB = 0 (OOP / acts first postflop).  BTN = highest rank (IP / acts last).
// Must match backend seat_mapping.py _POSTFLOP_ORDER.

const _POSTFLOP_ORDER: readonly string[] = [
  "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN",
] as const;

export function postflopActionRank(position: string, n: number): number {
  const canonical = POSITIONS_BY_SIZE[n] ?? POSITIONS_BY_SIZE[6];
  const active = _POSTFLOP_ORDER.filter((p) => canonical.includes(p));
  const idx = active.indexOf(normalizePosition(position));
  return idx >= 0 ? idx : active.length - 1; // unknown → assume IP
}

/** Returns true if posA acts BEFORE posB postflop (posA is OOP relative to posB). */
export function isOopVs(posA: string, posB: string, n: number): boolean {
  return postflopActionRank(posA, n) < postflopActionRank(posB, n);
}

// ── Preflop action order ──────────────────────────────────────────────────────

/**
 * Returns the preflop action order index for a given position at table size n.
 * 0 = first to act (UTG in 3+-player; BTN/SB in HU).
 */
export function preflopActionRank(position: string, n: number): number {
  const canonical = POSITIONS_BY_SIZE[n] ?? POSITIONS_BY_SIZE[6];
  const pos = normalizePosition(position);
  if (n <= 2) {
    // HU: BTN acts first preflop
    return canonical.indexOf(pos);
  }
  const utg = canonical.indexOf("UTG");
  if (utg < 0) return canonical.indexOf(pos);
  const shifted = [...canonical.slice(utg), ...canonical.slice(0, utg)];
  const idx = shifted.indexOf(pos);
  return idx >= 0 ? idx : canonical.length - 1;
}

// ── CanonicalSeat interface ───────────────────────────────────────────────────

/**
 * Complete, authoritative description of one seat.
 *
 * This is the ONLY seat type that should cross system boundaries.
 * Renderer, coach, puzzle engine — all consume CanonicalSeat.
 */
export interface CanonicalSeat {
  // ── Physical ────────────────────────────────────────────────────────────
  /** Raw hand-history seat number (1-9).  null for vision/screenshot hands. */
  physicalSeat: number | null;

  // ── Logical position ────────────────────────────────────────────────────
  /** Canonical poker label: "BTN" | "SB" | "BB" | "UTG" | "HJ" | "CO" … */
  logicalPosition: string;
  isButton: boolean;
  isSb: boolean;
  isBb: boolean;

  // ── Action order ────────────────────────────────────────────────────────
  /** 0 = first to act preflop (UTG / BTN in HU).  Increases clockwise. */
  preflopOrder: number;
  /** 0 = first to act postflop (SB = OOP).  Increases clockwise. */
  postflopOrder: number;

  // ── Visual render ────────────────────────────────────────────────────────
  /**
   * Render index used to look up SEAT_COORDS[N][visualIndex].
   * 0 = hero (always bottom-center).
   * 1..N-1 = opponents in clockwise order from hero.
   */
  visualIndex: number;

  // ── Player state ─────────────────────────────────────────────────────────
  playerName: string | null;
  isHero: boolean;
  isSitting: boolean;
  cards: string[];
  cardsKnown: boolean;
  foldedAtStep: number | null;
  stackBb: number | undefined;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface CanonicalSeatInput {
  physicalSeat?: number | null;
  logicalPosition: string;
  playerName: string | null;
  isHero: boolean;
  isSitting: boolean;
  cards?: string[];
  cardsKnown?: boolean;
  foldedAtStep?: number | null;
  stackBb?: number;
}

/**
 * Build a fully-populated CanonicalSeat for one player.
 *
 * heroPosition: canonical position of the hero (e.g. "BTN").
 * n:            total number of seats at the table.
 */
export function buildCanonicalSeat(
  input: CanonicalSeatInput,
  heroPosition: string,
  n: number,
): CanonicalSeat {
  const pos = normalizePosition(input.logicalPosition);
  const heroPos = normalizePosition(heroPosition);
  const cwHero = clockwiseIndexOf(heroPos, n);
  const cwThis = clockwiseIndexOf(pos, n);
  const visualIndex = (cwThis - cwHero + n) % n;

  return {
    physicalSeat:    input.physicalSeat ?? null,
    logicalPosition: pos,
    isButton:        pos === "BTN",
    isSb:            pos === "SB",
    isBb:            pos === "BB",
    preflopOrder:    preflopActionRank(pos, n),
    postflopOrder:   postflopActionRank(pos, n),
    visualIndex,
    playerName:      input.playerName,
    isHero:          input.isHero,
    isSitting:       input.isSitting,
    cards:           input.cards ?? [],
    cardsKnown:      input.cardsKnown ?? false,
    foldedAtStep:    input.foldedAtStep ?? null,
    stackBb:         input.stackBb,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface SeatValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a complete seat array for poker-rule correctness.
 *
 * Checks:
 *   - Exactly 1 BTN
 *   - At most 1 SB, 1 BB
 *   - No duplicate logical positions
 *   - Exactly 1 hero (visualIndex === 0)
 *   - visualIndex values are unique and cover 0..N-1
 *   - preflopOrder values are unique and cover 0..N-1
 *   - postflopOrder values are unique and cover 0..N-1
 */
export function validateCanonicalSeats(seats: CanonicalSeat[]): SeatValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const n = seats.length;

  if (n < 2) {
    errors.push(`Table requires at least 2 seats; got ${n}`);
    return { valid: false, errors, warnings };
  }

  // 1. Exactly one BTN
  const btnCount = seats.filter((s) => s.isButton).length;
  if (btnCount !== 1) errors.push(`Expected exactly 1 BTN; found ${btnCount}`);

  // 2. At most one SB, one BB
  const sbCount = seats.filter((s) => s.isSb).length;
  const bbCount = seats.filter((s) => s.isBb).length;
  if (sbCount > 1) errors.push(`Duplicate SB: found ${sbCount}`);
  if (bbCount > 1) errors.push(`Duplicate BB: found ${bbCount}`);

  // 3. No duplicate logical positions
  const positions = seats.map((s) => s.logicalPosition);
  const posSet = new Set(positions);
  if (posSet.size !== n) {
    const dupes = positions.filter((p, i) => positions.indexOf(p) !== i);
    errors.push(`Duplicate logical positions: ${[...new Set(dupes)].join(", ")}`);
  }

  // 4. Exactly one hero
  const heroCount = seats.filter((s) => s.isHero).length;
  if (heroCount !== 1) errors.push(`Expected exactly 1 hero; found ${heroCount}`);

  // 5. Hero at visualIndex 0
  const heroSeats = seats.filter((s) => s.isHero);
  if (heroSeats.length === 1 && heroSeats[0].visualIndex !== 0) {
    errors.push(`Hero must have visualIndex=0; got ${heroSeats[0].visualIndex}`);
  }

  // 6. visualIndex covers 0..N-1 uniquely
  const vis = seats.map((s) => s.visualIndex).sort((a, b) => a - b);
  if (vis.join() !== Array.from({ length: n }, (_, i) => i).join()) {
    errors.push(`visualIndex values must be 0..${n - 1}; got [${vis.join(",")}]`);
  }

  // 7. preflopOrder covers 0..N-1 uniquely
  const pf = seats.map((s) => s.preflopOrder).sort((a, b) => a - b);
  if (pf.join() !== Array.from({ length: n }, (_, i) => i).join()) {
    warnings.push(`preflopOrder values should be 0..${n - 1}; got [${pf.join(",")}]`);
  }

  // 8. postflopOrder covers 0..N-1 uniquely
  const po = seats.map((s) => s.postflopOrder).sort((a, b) => a - b);
  if (po.join() !== Array.from({ length: n }, (_, i) => i).join()) {
    warnings.push(`postflopOrder values should be 0..${n - 1}; got [${po.join(",")}]`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
