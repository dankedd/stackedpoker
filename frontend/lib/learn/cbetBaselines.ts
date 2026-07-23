/**
 * C-Betting Fundamentals (Module 7) — centralized range-distribution data.
 *
 * Ported directly from the backend's existing
 * `backend/app/engines/theory/equity_buckets.py` (`REFERENCE_EQB`), which is
 * itself explicitly documented as "illustrative reference values, not
 * solver-exact outputs" — aggregated across the backend's simplified flop
 * model, not a claimed per-solve number. Same data-honesty discipline as
 * `preflopBaselines.ts`: port what already exists in the project rather than
 * inventing new percentages, and keep the "illustrative, not solver-exact"
 * label visible wherever this data is shown on screen.
 *
 * Bucket thresholds match `flopClassifier.ts`'s `equityBucket()` exactly:
 * Strong ≥75%, Good 50-74%, Weak 33-49%, Trash <33%.
 */

export interface EqbDistribution {
  label: string
  strong: number
  good: number
  weak: number
  trash: number
}

function dist(label: string, strong: number, good: number, weak: number, trash: number): EqbDistribution {
  const total = strong + good + weak + trash
  if (Math.abs(total - 100) > 1) {
    throw new Error(`EqbDistribution "${label}" must sum to ~100, got ${total}`)
  }
  return { label, strong, good, weak, trash }
}

/** How polarized a distribution is: strong+trash as a fraction of the whole.
 *  High score = lots of nuts and air (polarized); low score = concentrated
 *  in good/weak (condensed/merged). Mirrors `EQBDistribution.polarization_score`
 *  in the backend file exactly. */
export function polarizationScore(d: EqbDistribution): number {
  return (d.strong + d.trash) / 100
}

export function isPolarized(d: EqbDistribution): boolean {
  return polarizationScore(d) > 0.6
}

// ── Reference distributions, ported verbatim from REFERENCE_EQB ──────────────

/** IP (BTN-UTG opener range) vs BB, averaged across the backend's flop model. */
export const IP_VS_BB_AVERAGE = dist('IP (opener)', 22, 43, 29, 6)

/** BB calling range vs IP, averaged across the backend's flop model. */
export const BB_VS_IP_AVERAGE = dist('BB (caller)', 7, 25, 23, 45)

/** Low, connected boards (the 654r family) — BB's calling range here. */
export const BB_LOW_CONNECTED_BOARDS = dist('BB on low connected boards', 18, 32, 24, 26)

/** High-card boards (the A76r / A-high family) — BB's calling range here. */
export const BB_HIGH_CARD_BOARDS = dist('BB on high-card boards', 4, 18, 20, 58)
