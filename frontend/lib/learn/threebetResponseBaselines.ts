/**
 * Preflop Aggression (Module 4) — 3-bet RESPONSE data ("They Raised Back": facing a
 * 3-bet after Hero has opened, choosing 4-bet / call / fold).
 *
 * This is the opposite side of threebetBaselines.ts (which covers 3-BETTING, i.e.
 * being the aggressor). Unlike mttRfiBaselines.ts (pixel-extracted from real chart
 * images) or threebetBaselines.ts's DEEP tier (ported from the backend's own range
 * file), no hand-level chart or dataset exists anywhere in this codebase for the
 * RESPONSE side of a 3-bet. What IS available — and all this file is built from —
 * is Michael Acevedo's "Modern Poker Theory" AGGREGATE action frequencies for two
 * cash-game matchups:
 *
 *   BTN vs BB 3-bet (Hero IP postflop):  4-bet 8.6%  / call 47.3% / fold 44.5%
 *   HJ  vs CO 3-bet (Hero OOP postflop): 4-bet 22.2% / call 14.5% / fold 63.3%
 *
 * (The book also states BTN vs SB ≈ 8.1/48.9/43.1 and HJ vs BN ≈ 21.6/20.8/57.6 —
 * used only as mentioned aggregate figures in the lesson text, never expanded into
 * a fabricated hand-level chart below, per this module's data-discipline.)
 *
 * No hand-level breakdown of the two built charts is available (no chart image to
 * extract, no ported backend range file). Per this module's data-discipline (never
 * fabricate a false-precision hand-level chart from an aggregate % alone), the
 * `cells` below are an ILLUSTRATIVE CONSTRUCTION, not a solver-exact or
 * book-transcribed chart:
 *
 *   1. The universe of hands is Hero's REAL, already-established opening range for
 *      that position (`RFI_DEEP.BTN` / `RFI_DEEP.HJ` in preflopBaselines.ts) — the
 *      book's percentages are of "hands Hero opened", not of all 169 hand classes,
 *      so hands outside that opening range are never assigned anything here (they
 *      fall back to the sparse convention's implicit fold, same as never opening).
 *   2. Each hand in that universe gets ONE pure action (no fabricated mixed
 *      frequencies), chosen from the book's own qualitative rules for this exact
 *      module ("They Raised Back"): pairs/AK are 4-bet value; a couple of suited
 *      wheel-Ax hands are 4-bet as blocker bluffs where the opening range actually
 *      contains them; suited broadways/connectors/pocket pairs call; offsuit
 *      broadways and weak/marginal hands fold more, and fold even more once Hero
 *      loses position (OOP vs CO/BN removes calls that were fine IP vs the blinds).
 *   3. Each chart's combo-weighted action split is calibrated to land close to
 *      (not exactly on) its matchup's stated aggregate % — see the per-chart combo
 *      math in this file's PR history / commit message. This is a teaching
 *      construction; every lesson step using it says so on-screen.
 *
 * Combo weights: pair=6, suited=4, offsuit=12 (1326 total). Cells are SPARSE: a
 * hand absent from a chart's `cells` array is implicitly 100% fold.
 */

export type ThreebetResponseAction = '4bet' | 'call' | 'fold'

export interface ThreebetResponseActionFrequencies {
  '4bet'?: number
  call?: number
  fold?: number
}

export interface ThreebetResponseCell {
  hand: string
  actions: ThreebetResponseActionFrequencies
}

/** Book-stated aggregate %, source: Modern Poker Theory (see file header). Shown
 *  on-screen for comparison against the learner's own combo-weighted split —
 *  never itself the grading target (grading is always per-hand, vs `cells`). */
export interface ThreebetResponseAggregate {
  '4bet': number
  call: number
  fold: number
}

export interface ThreebetResponseChart {
  key: string
  heroPosition: string
  villainPosition: string
  /** Whether Hero is in position for the rest of the hand if this pot continues. */
  inPosition: boolean
  aggregate: ThreebetResponseAggregate
  cells: ThreebetResponseCell[]
}

function cells(entries: [string, ThreebetResponseAction][]): ThreebetResponseCell[] {
  return entries.map(([hand, action]) => ({ hand, actions: { [action]: 1 } }))
}

// ── BTN vs BB 3-bet — Hero IP postflop ────────────────────────────────────────
// Universe: RFI_DEEP.BTN's 78 hand classes / 506 combos (preflopBaselines.ts).
// 4-bet 42 combos (8.3%), call 236 combos (46.6%), fold 228 combos (45.1%) —
// close to the book's stated 8.6% / 47.3% / 44.5%.

const BTN_VS_BB_ENTRIES: [string, ThreebetResponseAction][] = [
  // 4-bet: value pairs + AK, plus the two classic suited wheel-Ax blocker bluffs
  ['AA', '4bet'], ['KK', '4bet'], ['QQ', '4bet'],
  ['AKs', '4bet'], ['AKo', '4bet'],
  ['A5s', '4bet'], ['A4s', '4bet'],
  // call: remaining pairs (position supports calling down to small pairs)
  ['JJ', 'call'], ['TT', 'call'], ['99', 'call'], ['88', 'call'], ['77', 'call'],
  ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  // call: remaining suited Ax
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'],
  ['A7s', 'call'], ['A6s', 'call'], ['A3s', 'call'], ['A2s', 'call'],
  // call: suited Kx / Qx / Jx / Tx broadways
  ['KQs', 'call'], ['KJs', 'call'], ['KTs', 'call'], ['K9s', 'call'], ['K8s', 'call'], ['K7s', 'call'], ['K6s', 'call'], ['K5s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['Q9s', 'call'], ['Q8s', 'call'], ['Q7s', 'call'],
  ['JTs', 'call'], ['J9s', 'call'], ['J8s', 'call'], ['J7s', 'call'],
  ['T9s', 'call'], ['T8s', 'call'], ['T7s', 'call'],
  // call: suited connectors/gappers — playable and IP
  ['98s', 'call'], ['97s', 'call'], ['96s', 'call'], ['87s', 'call'], ['86s', 'call'],
  ['76s', 'call'], ['75s', 'call'], ['65s', 'call'], ['64s', 'call'], ['54s', 'call'], ['53s', 'call'], ['43s', 'call'],
  // call: AQo is the one offsuit broadway strong enough to still call in position
  ['AQo', 'call'],
  // fold: the rest of offsuit Ax — reverse implied odds even in position
  ['AJo', 'fold'], ['ATo', 'fold'], ['A9o', 'fold'], ['A8o', 'fold'], ['A7o', 'fold'], ['A6o', 'fold'], ['A5o', 'fold'],
  // fold: offsuit Kx/Qx/Jx/Tx/9x broadways — dominated too often
  ['KQo', 'fold'], ['KJo', 'fold'], ['KTo', 'fold'], ['K9o', 'fold'], ['K8o', 'fold'],
  ['QJo', 'fold'], ['QTo', 'fold'], ['Q9o', 'fold'],
  ['JTo', 'fold'], ['J9o', 'fold'],
  ['T9o', 'fold'],
  ['98o', 'fold'],
]

// ── HJ vs CO 3-bet — Hero OOP postflop ────────────────────────────────────────
// Universe: RFI_DEEP.HJ's 30 hand classes / 192 combos (preflopBaselines.ts).
// 4-bet 44 combos (22.9%), call 28 combos (14.6%), fold 120 combos (62.5%) —
// close to the book's stated 22.2% / 14.5% / 63.3%.

const HJ_VS_CO_ENTRIES: [string, ThreebetResponseAction][] = [
  // 4-bet: OOP leans on more aggression — value pairs down through JJ, AK, and AQs
  ['AA', '4bet'], ['KK', '4bet'], ['QQ', '4bet'], ['JJ', '4bet'],
  ['AKs', '4bet'], ['AKo', '4bet'], ['AQs', '4bet'],
  // call: a thin remainder — OOP calling is far less attractive than IP
  ['TT', 'call'], ['99', 'call'],
  ['AJs', 'call'], ['ATs', 'call'],
  ['KQs', 'call'],
  ['JTs', 'call'],
  // fold: everything else — including hands that were calls in the BTN-vs-BB (IP) chart
  ['88', 'fold'], ['77', 'fold'],
  ['A9s', 'fold'], ['A8s', 'fold'],
  ['KJs', 'fold'], ['KTs', 'fold'],
  ['QJs', 'fold'], ['QTs', 'fold'],
  ['T9s', 'fold'], ['98s', 'fold'], ['87s', 'fold'],
  ['AQo', 'fold'], ['AJo', 'fold'], ['ATo', 'fold'],
  ['KQo', 'fold'], ['KJo', 'fold'],
  ['QJo', 'fold'],
]

/** Key convention: `${heroPosition}_vs_${villainPosition}_3bet_response`. */
export const THREEBET_RESPONSE_CHARTS: Record<string, ThreebetResponseChart> = {
  BTN_vs_BB_3bet_response: {
    key: 'BTN_vs_BB_3bet_response',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    inPosition: true,
    aggregate: { '4bet': 8.6, call: 47.3, fold: 44.5 },
    cells: cells(BTN_VS_BB_ENTRIES),
  },
  HJ_vs_CO_3bet_response: {
    key: 'HJ_vs_CO_3bet_response',
    heroPosition: 'HJ',
    villainPosition: 'CO',
    inPosition: false,
    aggregate: { '4bet': 22.2, call: 14.5, fold: 63.3 },
    cells: cells(HJ_VS_CO_ENTRIES),
  },
}

// ── Deliberately flawed example (Range Repair exercise) ──────────────────────
// A hand-authored mutation of BTN_vs_BB_3bet_response embodying four concrete,
// nameable leaks (never used for grading — only as a `range_build_multi_transform_
// from_chart` seed the learner repairs; the grading target stays the real chart):
//   1. Calls too many dominated offsuit broadways (KQo, KJo, QJo: fold -> call)
//   2. Folds suited connectors that actually call well (87s, 76s, 65s: call -> fold)
//   3. Its 4-bet range has no blocker-driven hands at all (A5s, A4s: 4bet -> call)
//   4. Turns medium pocket pairs into 4-bets instead of calls (JJ, TT: call -> 4bet)
// Every other hand is untouched, so the diff a learner finds IS exactly these four
// leaks — no incidental noise.

const BTN_VS_BB_FLAWED_ENTRIES: [string, ThreebetResponseAction][] = BTN_VS_BB_ENTRIES.map(([hand, action]) => {
  if (hand === 'KQo' || hand === 'KJo' || hand === 'QJo') return [hand, 'call']
  if (hand === '87s' || hand === '76s' || hand === '65s') return [hand, 'fold']
  if (hand === 'A5s' || hand === 'A4s') return [hand, 'call']
  if (hand === 'JJ' || hand === 'TT') return [hand, '4bet']
  return [hand, action]
})

export const THREEBET_RESPONSE_FLAWED_EXAMPLES: Record<string, ThreebetResponseChart> = {
  BTN_vs_BB_3bet_response_flawed_example: {
    key: 'BTN_vs_BB_3bet_response_flawed_example',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    inPosition: true,
    // Not a book-stated figure (this range is intentionally wrong) — recorded only
    // for on-screen display consistency with a real chart's aggregate field.
    aggregate: { '4bet': 9.1, call: 50.6, fold: 40.3 },
    cells: cells(BTN_VS_BB_FLAWED_ENTRIES),
  },
}

/** Book-stated aggregate-only reference points with no hand-level chart built
 *  (per this module's "don't fabricate what can't be recovered" rule) — used only
 *  for the lesson's Position Flip / final-challenge concept text, never as a
 *  gradeable range_build_multi target. */
export const THREEBET_RESPONSE_AGGREGATE_ONLY: Record<string, { heroPosition: string; villainPosition: string; aggregate: ThreebetResponseAggregate }> = {
  BTN_vs_SB: { heroPosition: 'BTN', villainPosition: 'SB', aggregate: { '4bet': 8.1, call: 48.9, fold: 43.1 } },
  HJ_vs_BN: { heroPosition: 'HJ', villainPosition: 'BTN', aggregate: { '4bet': 21.6, call: 20.8, fold: 57.6 } },
}

// ── Prefilled foundations — the obvious top-of-range core, same convention as
//    MTT_RFI_FOUNDATIONS (mttRfiRanges.ts) / RANGE_FOUNDATIONS (ranges.ts) ──

export interface ThreebetResponseFoundation {
  chartKey: string
  hands: Record<string, ThreebetResponseAction>
}

export const THREEBET_RESPONSE_FOUNDATIONS: Record<string, ThreebetResponseFoundation> = {
  BTN_vs_BB_3bet_response_foundation: {
    chartKey: 'BTN_vs_BB_3bet_response',
    hands: { AA: '4bet', KK: '4bet', QQ: '4bet' },
  },
  HJ_vs_CO_3bet_response_foundation: {
    chartKey: 'HJ_vs_CO_3bet_response',
    hands: { AA: '4bet', KK: '4bet', QQ: '4bet' },
  },
}
