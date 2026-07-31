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

// ── C-bet frequency category bands — pedagogical model, not solver data ──────
//
// Module 7 (and `cbet_frequency_size`/`FrequencySizeLab.tsx` specifically)
// describes aggregate c-bet frequency in five named categories rather than a
// memorized percentage — matching the book's own qualitative framing (Ch.12:
// "High c-bet frequency flops (80%+) / Mid (60%-80%) / Low (less than 60%)",
// simplified to 5 bands here for a finer-grained "Near-Range Bet" top tier and
// a "Check-Heavy" bottom tier the book doesn't name separately). The ranges
// below are an indicative learning aid for what each label roughly MEANS, not
// a claimed solver frequency for any specific spot — deliberately never used
// to grade an answer, only to label one. Single source of truth: every place
// in `curriculum.ts` that shows one of these five category names as a UI
// label should build it from here so the wording can never drift out of sync.
export interface CbetFrequencyBand {
  id: 'near_range' | 'high' | 'medium' | 'low' | 'check_heavy'
  label: string
  pctRange: string
  displayLabel: string
}

export const CBET_FREQUENCY_BANDS: CbetFrequencyBand[] = (
  [
    ['near_range', 'Near-Range Bet', '≈85–100%'],
    ['high', 'High', '≈65–85%'],
    ['medium', 'Medium', '≈40–65%'],
    ['low', 'Low', '≈15–40%'],
    ['check_heavy', 'Check-Heavy', '≈0–15%'],
  ] as const
).map(([id, label, pctRange]) => ({ id, label, pctRange, displayLabel: `${label} (${pctRange})` }))

const CBET_FREQUENCY_BAND_BY_ID: Record<string, CbetFrequencyBand> = Object.fromEntries(
  CBET_FREQUENCY_BANDS.map((b) => [b.id, b]),
)

/** Ready-to-use `{id, label}` options for `cbet_frequency_size_frequency_options`,
 *  in the book's low-to-high reading order. Steps set in a 3-bet pot (where
 *  a literal 100%-of-range near-range-bet ceiling isn't the point being taught)
 *  should use `CBET_FREQUENCY_OPTIONS.filter(o => o.id !== 'near_range')`
 *  rather than a hand-copied 4-item array. */
export const CBET_FREQUENCY_OPTIONS: { id: string; label: string }[] = CBET_FREQUENCY_BANDS
  .slice()
  .reverse()
  .map((b) => ({ id: b.id, label: b.displayLabel }))

/** The "Category (≈low–high%)" display string for a band id, e.g. for building
 *  a composite `options[].label` like `${cbetFrequencyDisplayLabel('near_range')} + Small`,
 *  or splicing the percentage into a longer sentence that names the category. */
export function cbetFrequencyDisplayLabel(id: string): string {
  return CBET_FREQUENCY_BAND_BY_ID[id]?.displayLabel ?? id
}
