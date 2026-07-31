/**
 * Precomputed opening range targets for 6-max cash (100bb, GTO-approximate).
 * Used by the local deterministic evaluator for range_build step assessment.
 *
 * Hand notation: 'AA' (pair), 'AKs' (suited), 'AKo' (offsuit)
 * Combo counts: pair=6, suited=4, offsuit=12
 */

import { entriesToHandList } from './preflopBaselines'
import { THREEBET_MEDIUM } from './threebetBaselines'
import { CASH_100BB_OPEN_RESPONSE_CHARTS } from './cash100bbOpenResponseBaselines'

// ── BTN open (~40%) ──────────────────────────────────────────────────────────

const BTN_OPEN_100BB: string[] = [
  // All pairs
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  // Suited aces (all)
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  // Offsuit aces (A7o+)
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
  // Suited kings (K5s+)
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
  // Offsuit kings (K9o+)
  'KQo', 'KJo', 'KTo', 'K9o',
  // Suited queens (Q7s+)
  'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s',
  // Offsuit queens (Q9o+)
  'QJo', 'QTo', 'Q9o',
  // Suited jacks (J7s+)
  'JTs', 'J9s', 'J8s', 'J7s',
  // Offsuit jacks (JTo)
  'JTo',
  // Suited tens (T7s+)
  'T9s', 'T8s', 'T7s',
  // Suited mid-connectors / one-gappers
  '98s', '97s', '96s',
  '87s', '86s', '85s',
  '76s', '75s',
  '65s', '64s',
  '54s', '53s',
]

// ── CO open (~25%) ───────────────────────────────────────────────────────────

const CO_OPEN_100BB: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
  'KQo', 'KJo', 'KTo', 'K9o',
  'QJs', 'QTs', 'Q9s', 'Q8s',
  'QJo', 'QTo',
  'JTs', 'J9s', 'J8s',
  'JTo',
  'T9s', 'T8s',
  '98s', '97s',
  '87s', '86s',
  '76s', '75s',
  '65s', '64s',
  '54s',
]

// ── HJ open (~20%) ───────────────────────────────────────────────────────────

const HJ_OPEN_100BB: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s',
  'KQo', 'KJo', 'KTo',
  'QJs', 'QTs', 'Q9s',
  'QJo',
  'JTs', 'J9s',
  'JTo',
  'T9s', 'T8s',
  '98s', '97s',
  '87s',
  '76s',
  '65s',
  '54s',
]

// ── UTG open (~15%) ──────────────────────────────────────────────────────────

const UTG_OPEN_100BB: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A5s', 'A4s',
  'AKo', 'AQo', 'AJo',
  'KQs', 'KJs', 'KTs',
  'KQo', 'KJo',
  'QJs', 'QTs',
  'QJo',
  'JTs', 'J9s',
  'T9s', 'T8s',
  '98s',
  '87s',
  '76s',
  '65s',
  '54s',
]

// ── SB open vs fold (~35%) ───────────────────────────────────────────────────

const SB_OPEN_100BB: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
  'KQo', 'KJo', 'KTo', 'K9o',
  'QJs', 'QTs', 'Q9s', 'Q8s',
  'QJo', 'QTo',
  'JTs', 'J9s', 'J8s',
  'JTo',
  'T9s', 'T8s', 'T7s',
  '98s', '97s',
  '87s', '86s',
  '76s', '75s',
  '65s',
  '54s',
]

// ── BTN continuing (3-bet or call) vs CO open, 100bb — derived from the real
//    book strategy chart (CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb, see
//    cash100bbOpenResponseBaselines.ts) so this membership list can never drift
//    from the canonical per-hand strategy data — one source of truth, not a
//    hand-picked parallel array. ────────────────────────────────────────────

const BTN_CALL_VS_CO_100BB: string[] = CASH_100BB_OPEN_RESPONSE_CHARTS.BN_vs_CO_100bb.cells
  .filter((c) => (c.actions['3bet'] ?? 0) + (c.actions.call ?? 0) > 0)
  .map((c) => c.hand)

// ── BB defend vs BTN open (~55%) ─────────────────────────────────────────────

const BB_DEFEND_VS_BTN_100BB: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
  'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o',
  'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s',
  'QJo', 'QTo', 'Q9o', 'Q8o',
  'JTs', 'J9s', 'J8s', 'J7s', 'J6s',
  'JTo', 'J9o', 'J8o',
  'T9s', 'T8s', 'T7s', 'T6s',
  'T9o', 'T8o',
  '98s', '97s', '96s', '95s',
  '98o',
  '87s', '86s', '85s', '84s',
  '76s', '75s', '74s',
  '65s', '64s', '63s',
  '54s', '53s', '52s',
  '43s', '42s',
  '32s',
]

// ── Public lookup map ────────────────────────────────────────────────────────

export const RANGE_TARGETS: Record<string, string[]> = {
  BTN_open_100bb:          BTN_OPEN_100BB,
  CO_open_100bb:           CO_OPEN_100BB,
  HJ_open_100bb:           HJ_OPEN_100BB,
  UTG_open_100bb:          UTG_OPEN_100BB,
  SB_open_100bb:           SB_OPEN_100BB,
  BTN_call_vs_CO_100bb:    BTN_CALL_VS_CO_100BB,
  BB_defend_vs_BTN_100bb:  BB_DEFEND_VS_BTN_100BB,
}

// ── Prefilled "foundation" ranges ────────────────────────────────────────────
//
// A foundation is the subset of a range_build target so universally obvious
// (premium pairs, premium suited/offsuit broadways) that clicking each one by
// hand teaches nothing — it's pure mechanical overhead. Sized to land each
// foundation at roughly 60% of its target range's combos (a Module 3-wide
// pass — see UTG_RFI_60BB_foundation/etc. in mttRfiRanges.ts for the parallel
// change to the frequency-chart-backed foundations), so the learner mainly
// reasons about the genuinely marginal 40%: everything left out here (the
// weak suited-connector/gapper tail, marginal offsuit broadways, and — for
// CO specifically — the small-pair tier its own narrative calls out) is
// exactly the boundary judgment the exercise exists to teach. See
// RangeBuild.tsx and rangePrefill.ts for how these get merged into a step.
//
// Do not add a foundation here for a range that is a graded target of a LATER
// lesson unless you have re-audited that later step's exact answer isn't
// exposed by it — see the leak-regression tests in
// frontend/lib/learn/__tests__/rangePrefilledFoundation.test.ts.

const BTN_OPEN_FOUNDATION: string[] = [
  // All pairs — BTN opens every pair at 100bb, never a live question.
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  // Every suited ace — none of these are a genuine question this wide.
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  // Offsuit aces down to the target range's own A7o floor.
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
  // Suited/offsuit kings down through the nine.
  'KQs', 'KJs', 'KTs', 'K9s', 'KQo', 'KJo', 'KTo',
]

// CO opens a hair tighter than BTN — same premium spine, but the pair floor
// stays at 77 (unchanged from before) and every offsuit king above K9o is
// held back: mtc-s9's own narrative asks the learner to "focus especially on
// the marginal bottom — the suited connectors, small pairs, and blocker-heavy
// hands", so 66-and-under and the whole suited-connector/broadway-queen-down
// tail stay deliberately unfilled even though the ace/king spine widens to
// hit the same ~60% target as every other Module 3 range-build exercise.
const CO_OPEN_FOUNDATION: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o',
  'KQs', 'KJs', 'KTs', 'K9s',
  'KQo', 'KJo', 'KTo', 'K9o',
]

// HJ tightens further still — pair floor rises again, suited-king tail
// shrinks to just the top two, and the suited-queen/jack broadways are left
// out entirely so the learner decides where HJ's broadway floor sits.
const HJ_OPEN_FOUNDATION: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88',
  'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo',
  'KQs', 'KJs',
  'QJs',
]

// UTG is the tightest open in the ladder (target is only ~35 hands to begin
// with), so the foundation stays deliberately minimal — top pairs and the
// cleanest two suited/one offsuit combo. Everything else (77-99, the Ax
// wheel/blocker tail, every suited king/queen/jack, every suited connector)
// is left for the learner, which is nearly the entire UTG range.
const UTG_OPEN_FOUNDATION: string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT',
  'AKs', 'AQs',
  'AKo',
]

// BB vs BTN 3-bet (bar-s7): NOT hand-invented. THREEBET_MEDIUM is already the
// codebase's own mechanically-derived "always 3-bet" cut of THREEBET_DEEP
// (frequency >= 1 — see threebetBaselines.ts). Reusing it here is the same
// "derive, never invent" discipline applied to a foundation: it leaves every
// mixed-frequency hand (JJ, TT, AQs, AJs, A2s, K5s, 65s, 54s, 76s) — the
// exact "board coverage" bluffs/extensions bar-s6a/bar-s6b just taught about
// — for the learner to place.
const BB_VS_BTN_3BET_FOUNDATION: string[] = entriesToHandList(THREEBET_MEDIUM.BB_vs_BTN)

export const RANGE_FOUNDATIONS: Record<string, string[]> = {
  BTN_open_foundation: BTN_OPEN_FOUNDATION,
  CO_open_foundation: CO_OPEN_FOUNDATION,
  HJ_open_foundation: HJ_OPEN_FOUNDATION,
  UTG_open_foundation: UTG_OPEN_FOUNDATION,
  BB_vs_BTN_3bet_foundation: BB_VS_BTN_3BET_FOUNDATION,
}
