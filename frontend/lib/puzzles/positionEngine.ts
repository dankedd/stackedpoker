/**
 * positionEngine.ts
 *
 * Canonical postflop position mechanics for two-player puzzle matchups.
 * Postflop action order: SB acts first (OOP), BTN acts last (IP).
 *
 * This module is the single source of truth for:
 *   - Who acts first on each postflop street
 *   - Which position is IP vs OOP
 *   - Whether hero needs to act before villain can
 */

// ── Canonical postflop rank ──────────────────────────────────────────────────
// Lower rank = acts FIRST postflop (OOP).
// Higher rank = acts LAST postflop (IP).
// SB(0) → BB(1) → UTG(2) → … → CO(7) → BTN(8)

export const POSTFLOP_RANK: Readonly<Record<string, number>> = {
  SB:      0,
  BB:      1,
  UTG:     2,
  'UTG+1': 3,
  'UTG+2': 4,
  LJ:      5,
  HJ:      6,
  CO:      7,
  BTN:     8,
  // Common aliases
  MP:      5,  // generic mid-position
  EP:      2,  // generic early position
};

/**
 * Get postflop action rank for a position string.
 * Unknown positions default to 5 (mid-table) so the validator
 * produces no false positives for unusual formats.
 */
export function postflopRank(position: string): number {
  const upper = position.toUpperCase();
  return POSTFLOP_RANK[upper] ?? POSTFLOP_RANK[position] ?? 5;
}

/**
 * Returns true if heroPos is OOP relative to villainPos
 * (i.e., hero acts FIRST on every postflop street).
 */
export function heroActsFirstPostflop(heroPos: string, villainPos: string): boolean {
  return postflopRank(heroPos) < postflopRank(villainPos);
}

/**
 * Returns the IP and OOP labels for a two-player matchup.
 * IP = acts last (higher rank). OOP = acts first (lower rank).
 */
export function classifyPositions(
  pos1: string,
  pos2: string,
): { ip: string; oop: string } {
  return postflopRank(pos1) > postflopRank(pos2)
    ? { ip: pos1, oop: pos2 }
    : { ip: pos2, oop: pos1 };
}

/**
 * Human-readable matchup description.
 * e.g. "CO (OOP) vs BTN (IP)" or "BTN (IP) vs BB (OOP)"
 */
export function describeMatchup(heroPos: string, villainPos: string): string {
  const heroOop = heroActsFirstPostflop(heroPos, villainPos);
  return heroOop
    ? `${heroPos} (OOP, acts first) vs ${villainPos} (IP)`
    : `${heroPos} (IP) vs ${villainPos} (OOP, acts first)`;
}
