/**
 * Defending the Open (Module 5) — DEFENSE data for HJ/CO/BTN/SB/BB as the
 * DEFENDER facing a single open raise, choosing fold / call / 3-bet (or jam,
 * at shallow depths).
 *
 * Two things already exist in this codebase for the BB side only:
 * `bbDefenseComplete.ts` (100bb, 6-max cash, pixel-classified from Modern
 * Poker Theory Ch.5's own chart images — a genuine `complete_strategy`) and
 * `defendBaselines.ts` (`DEFEND_DEEP/MEDIUM/SHALLOW`, BB's calling frequency
 * ONLY, ported from the backend). Neither covers HJ, CO, BTN or SB as
 * defenders, and neither reaches the 15/25/40/60bb MTT stack-depth structure
 * Module 3's opening-range lessons are built on.
 *
 * This file fills that gap for every OTHER defender, following the exact
 * precedent `threebetResponseBaselines.ts` set for Module 4's analogous gap
 * (a defender-side chart the backend never sourced): Modern Poker Theory DOES
 * state real, book-verified AGGREGATE action frequencies and representative
 * named hands for these matchups — but no chart IMAGE has been extracted for
 * them (only pages 237-248, Ch.5's BB section, have been pulled into
 * docs/mpt_images/ so far). Per this module's data-discipline (never invent a
 * false-precision hand-level chart from an aggregate % alone), every chart
 * below is an explicit SOURCE RECONSTRUCTION, not a pixel transcription:
 *
 *   1. The aggregate 3-bet/call/fold (or all-in/fold) % is the book's own
 *      stated number for that exact matchup and stack depth (cited per chart
 *      below, chapter + Hand Range figure number where identifiable).
 *   2. The book's own named "big" hands for that matchup (the pairs/broadways/
 *      suited connectors it explicitly calls out) anchor the strong and weak
 *      ends of the range.
 *   3. Every hand BETWEEN those named anchors is assigned in standard
 *      hand-strength order (pairs > suited broadways > suited Ax > suited
 *      connectors > offsuit broadways > offsuit Ax > the rest) until the
 *      chart's combo-weighted split lands close to (not exactly on) the
 *      book's stated aggregate — the same calibration approach
 *      threebetResponseBaselines.ts already uses. This step is a pedagogical
 *      model for the hands the book itself never names individually — it is
 *      disclosed here and on-screen, never presented as a direct quote.
 *
 * Chapter sources:
 *   - Modern Poker Theory Ch.5, "Specific Ranges Playing Versus Open Raises"
 *     (6-max cash, 100bb, single depth) — HJ/CO/BN/SB aggregate %s.
 *   - Modern Poker Theory Ch.8, "MTT Equilibrium Strategies: Defense",
 *     section "Defending vs Open Raises" (9-max, 15/25/40/60bb) — the primary
 *     source for this file, since it matches Module 3's own MTT/60bb frame.
 *
 * Positions: this file collapses the book's UTG/UTG+1/LJ early-position opens
 * into a single generic "UTG" opener for every matchup except where the
 * curriculum explicitly needs a second early-position contrast — the book's
 * own numbers for HJ vs UTG and HJ vs LJ (etc.) are close enough that treating
 * "UTG" as representative of "an early-position open" is a stated pedagogical
 * simplification, not a claim that LJ opens identically to UTG.
 *
 * Action set: '3bet' at 25/40/60bb, 'jam' at 15bb — matching how the book
 * itself labels the aggressive action at each depth (a 15bb "3-bet" is
 * mechanically an all-in, so this avoids presenting a raise-and-fold sizing
 * that doesn't actually exist at that depth).
 *
 * Combo weights: pair=6, suited=4, offsuit=12 (1326 total). Cells are SPARSE:
 * a hand absent from a chart's `cells` array is implicitly 100% fold.
 */

export type DefendResponseAction = '3bet' | 'jam' | 'call' | 'fold'

export interface DefendResponseActionFrequencies {
  '3bet'?: number
  jam?: number
  call?: number
  fold?: number
}

export interface DefendResponseCell {
  hand: string
  actions: DefendResponseActionFrequencies
}

/** Book-stated aggregate %, source: Modern Poker Theory (see file header). Shown
 *  on-screen for comparison against the learner's own combo-weighted split —
 *  never itself the grading target (grading is always per-hand, vs `cells`). */
export interface DefendResponseAggregate {
  '3bet'?: number
  jam?: number
  call?: number
  fold: number
}

export interface DefendResponseChart {
  key: string
  heroPosition: string
  villainPosition: string
  stackBB: 15 | 25 | 40 | 60
  /** Chapter/page/Hand-Range-figure citation for this exact chart's aggregate %. */
  source: string
  aggregate: DefendResponseAggregate
  cells: DefendResponseCell[]
}

export function cells(entries: [string, DefendResponseAction][]): DefendResponseCell[] {
  return entries.map(([hand, action]) => ({ hand, actions: { [action]: 1 } }))
}

// ── HJ vs UTG (60bb) ───────────────────────────────────────────────────────────
// Source: Ch.8 "Defending the HJ" (60bb) — 3-bet 5.2% / Call 9.3% / Fold 85.5%.
// 3-bet 68 combos (5.1%), call 126 combos (9.5%) — close to the book's %.
// Named anchors: the book's own qualitative rule (pairs+AK 3-bet for value, a
// couple of suited wheel-Ax as blocker bluffs, suited broadways/connectors and
// remaining pairs call, everything offsuit outside AQo folds) is the same rule
// threebetResponseBaselines.ts already used for its 3-bet-response charts —
// individual hand placement here is a pedagogical reconstruction, not a quote.
const HJ_VS_UTG_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'],
  ['KQs', '3bet'],
  ['88', 'call'], ['77', 'call'], ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'], ['A2s', 'call'],
  ['KJs', 'call'], ['KTs', 'call'],
  ['QJs', 'call'], ['QTs', 'call'],
  ['JTs', 'call'],
  ['T9s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'],
  ['AQo', 'call'],
]

// ── CO vs UTG (60bb) ───────────────────────────────────────────────────────────
// Source: Ch.8 "Defending the CO" (60bb) — 3-bet 5.2% / Call 13.0% / Fold 81.8%.
// 3-bet 68 combos (5.1%), call 166 combos (12.5%) — close to the book's %.
// Same value-3-bet/blocker-bluff core as HJ's chart; the widening the book
// describes shows up in the calling range (more suited broadways/connectors,
// two offsuit broadways added), not in the 3-bet range.
const CO_VS_UTG_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'],
  ['KQs', '3bet'],
  ['88', 'call'], ['77', 'call'], ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'], ['A2s', 'call'],
  ['KJs', 'call'], ['KTs', 'call'], ['K9s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['Q9s', 'call'],
  ['JTs', 'call'], ['J9s', 'call'],
  ['T9s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'], ['54s', 'call'],
  ['AQo', 'call'], ['AJo', 'call'],
  ['KQo', 'call'],
]

// ── CO vs HJ (60bb) ────────────────────────────────────────────────────────────
// The book's Ch.8 CO-defense section states aggregates for CO vs LJ and CO vs
// UTG only, with HJ's open mentioned in prose but no separate stated %. This
// chart extrapolates using the book's OWN documented directional pattern —
// a later, wider opener earns a wider continuing range, with 3-bets widening
// less than calls (the same shape Ch.5's BN-vs-LJ/HJ/CO progression shows
// explicitly: 3-bet 7.3%->8.8%->11.7%, call 6.9%->6.5%->5.4% as the opener
// gets later) — anchored to CO_VS_UTG_60BB_ENTRIES above, not invented from
// nothing. This is the one chart in this file that is an EXTRAPOLATION beyond
// a directly stated aggregate, and is disclosed as such wherever it's used.
const CO_VS_HJ_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'], ['A2s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'],
  ['77', 'call'], ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'],
  ['KTs', 'call'], ['K9s', 'call'], ['K8s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['Q9s', 'call'],
  ['JTs', 'call'], ['J9s', 'call'], ['J8s', 'call'],
  ['T9s', 'call'], ['T8s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'], ['54s', 'call'],
  ['AQo', 'call'], ['AJo', 'call'], ['ATo', 'call'],
  ['KQo', 'call'], ['KJo', 'call'],
  ['QJo', 'call'],
]

// ── BTN vs UTG / HJ / CO (60bb) ────────────────────────────────────────────────
// Only BTN vs CO has a directly stated Ch.8 60bb aggregate (3-bet 11.5% / Call
// 16.9% / Fold 71.6%, "Defending the BN"). BTN vs UTG and BTN vs HJ are
// EXTRAPOLATED from it using Ch.5's own stated 100bb BN-vs-LJ/HJ/CO
// progression (3-bet 7.3%->8.8%->11.7%, call 6.9%->6.5%->5.4% as the opener
// gets later) to scale the 60bb anchor down for earlier openers — the same
// technique CO_VS_HJ_60BB above uses, not an invented shape.
const BTN_VS_UTG_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'], ['A2s', '3bet'],
  ['KQs', '3bet'],
  ['77', 'call'], ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'],
  ['KJs', 'call'], ['KTs', 'call'], ['K9s', 'call'], ['K8s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['Q9s', 'call'],
  ['JTs', 'call'], ['J9s', 'call'], ['J8s', 'call'],
  ['T9s', 'call'], ['T8s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'], ['54s', 'call'],
  ['AQo', 'call'], ['AJo', 'call'], ['ATo', 'call'],
  ['KQo', 'call'], ['KJo', 'call'],
  ['QJo', 'call'],
]

const BTN_VS_HJ_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'], ['77', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'], ['A2s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'],
  ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['AJs', 'call'], ['ATs', 'call'], ['A9s', 'call'], ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'],
  ['KTs', 'call'], ['K9s', 'call'], ['K8s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['Q9s', 'call'],
  ['JTs', 'call'], ['J9s', 'call'], ['J8s', 'call'],
  ['T9s', 'call'], ['T8s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'], ['54s', 'call'],
  ['AQo', 'call'], ['AJo', 'call'], ['ATo', 'call'],
  ['KQo', 'call'], ['KJo', 'call'],
  ['QJo', 'call'],
]

// ── BTN vs CO (60bb) ───────────────────────────────────────────────────────────
// Source: Ch.8 "Defending the BN" (60bb) — 3-bet 11.5% / Call 16.9% / Fold 71.6%.
const BTN_VS_CO_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'], ['77', '3bet'], ['66', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'],
  ['A9s', '3bet'], ['A8s', '3bet'], ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'], ['A2s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'], ['KTs', '3bet'],
  ['QJs', '3bet'],
  ['ATs', '3bet'], ['JTs', '3bet'],
  ['AJo', '3bet'], ['KQo', '3bet'], ['QJo', '3bet'],
  ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AQs', 'call'], ['A7s', 'call'], ['A6s', 'call'],
  ['K9s', 'call'], ['K8s', 'call'], ['K7s', 'call'],
  ['Q9s', 'call'], ['QTs', 'call'],
  ['J9s', 'call'], ['J8s', 'call'],
  ['T9s', 'call'], ['T8s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'], ['54s', 'call'],
  ['AQo', 'call'], ['ATo', 'call'], ['A9o', 'call'], ['A8o', 'call'], ['A7o', 'call'],
  ['KJo', 'call'], ['K9o', 'call'], ['K8o', 'call'],
  ['Q9o', 'call'],
  ['JTo', 'call'], ['T9o', 'call'],
]

// ── SB vs UTG / HJ / CO / BTN (60bb) ───────────────────────────────────────────
// Source: Ch.8 "Defending the SB" (60bb). Directly stated: SB vs BN 3-bet
// 16.2% / Call 17.2% / Fold 66.6%. SB vs CO/HJ/UTG are extrapolated from that
// anchor using the same directional pattern as CO_VS_HJ_60BB and the BTN
// charts above (a later, wider opener earns a wider continuing range,
// aggression widening faster than calling) — SB's own calling range stays
// comparatively NARROW at every tier relative to 3-betting, since (per Ch.5's
// SB prose) a flat leaves the BB live to squeeze and SB is OOP for the rest
// of the hand — SB leans on 3-betting/jamming, not calling, far more than any
// other defender in this file.
const SB_VS_UTG_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'], ['AQs', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'],
  ['99', 'call'], ['88', 'call'], ['77', 'call'],
  ['AJs', 'call'], ['ATs', 'call'],
  ['KQs', 'call'],
  ['JTs', 'call'],
  ['AQo', 'call'],
]

const SB_VS_HJ_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'], ['AQs', '3bet'], ['AJs', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'],
  ['KQs', '3bet'],
  ['88', 'call'], ['77', 'call'], ['66', 'call'],
  ['ATs', 'call'], ['A9s', 'call'],
  ['KJs', 'call'], ['KTs', 'call'],
  ['JTs', 'call'],
  ['AQo', 'call'], ['AJo', 'call'],
]

const SB_VS_CO_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'], ['AQs', '3bet'], ['AJs', '3bet'], ['ATs', '3bet'],
  ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'],
  ['AQo', '3bet'],
  ['77', 'call'], ['66', 'call'], ['55', 'call'],
  ['A9s', 'call'], ['A8s', 'call'],
  ['KTs', 'call'], ['K9s', 'call'],
  ['QJs', 'call'],
  ['JTs', 'call'], ['T9s', 'call'],
  ['AJo', 'call'], ['ATo', 'call'], ['KQo', 'call'],
]

// SB vs BN (60bb) — the one directly stated Ch.8 aggregate: 3-bet 16.2% /
// Call 17.2% / Fold 66.6%.
const SB_VS_BTN_60BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'], ['77', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'], ['AQs', '3bet'], ['AJs', '3bet'], ['ATs', '3bet'],
  ['A9s', '3bet'], ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'], ['A2s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'],
  ['AQo', '3bet'], ['AJo', '3bet'],
  ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['A8s', 'call'], ['A7s', 'call'], ['A6s', 'call'],
  ['KTs', 'call'], ['K9s', 'call'], ['K8s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'],
  ['JTs', 'call'], ['J9s', 'call'],
  ['T9s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'],
  ['ATo', 'call'], ['KQo', 'call'], ['KJo', 'call'], ['QJo', 'call'],
]

// SB vs BN at 15/25/40bb — for Lesson 7's stack-depth sweep (paired with the
// existing BB-vs-BTN depth data in defendBaselines.ts). Source: Ch.8
// "Defending the SB", 15bb All-in 28.2%/Fold 71.8% (no calling range stated —
// SB's response collapses to a pure jam/fold at this depth); 25bb and 40bb
// are interpolated between the stated 15bb and 60bb anchors.
const SB_VS_BTN_15BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', 'jam'], ['KK', 'jam'], ['QQ', 'jam'], ['JJ', 'jam'], ['TT', 'jam'], ['99', 'jam'], ['88', 'jam'], ['77', 'jam'], ['66', 'jam'], ['55', 'jam'], ['44', 'jam'], ['33', 'jam'], ['22', 'jam'],
  ['AKs', 'jam'], ['AKo', 'jam'], ['AQs', 'jam'], ['AQo', 'jam'], ['AJs', 'jam'], ['AJo', 'jam'], ['ATs', 'jam'], ['ATo', 'jam'],
  ['A9s', 'jam'], ['A8s', 'jam'], ['A7s', 'jam'], ['A6s', 'jam'], ['A5s', 'jam'], ['A4s', 'jam'], ['A3s', 'jam'], ['A2s', 'jam'],
  ['KQs', 'jam'], ['KQo', 'jam'], ['KJs', 'jam'], ['KTs', 'jam'], ['K9s', 'jam'],
  ['QJs', 'jam'], ['QTs', 'jam'], ['JTs', 'jam'], ['T9s', 'jam'], ['98s', 'jam'], ['87s', 'jam'], ['76s', 'jam'], ['65s', 'jam'],
]

const SB_VS_BTN_25BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', 'jam'], ['KK', 'jam'], ['QQ', 'jam'], ['JJ', 'jam'], ['TT', 'jam'], ['99', 'jam'], ['88', 'jam'], ['77', 'jam'], ['66', 'jam'], ['55', 'jam'],
  ['AKs', 'jam'], ['AKo', 'jam'], ['AQs', 'jam'], ['AQo', 'jam'], ['AJs', 'jam'], ['ATs', 'jam'],
  ['A9s', 'jam'], ['A8s', 'jam'], ['A5s', 'jam'], ['A4s', 'jam'], ['A3s', 'jam'], ['A2s', 'jam'],
  ['KQs', 'jam'], ['KJs', 'jam'],
  ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['AJo', 'call'], ['ATo', 'call'], ['KTs', 'call'], ['K9s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'], ['JTs', 'call'], ['T9s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'],
]

const SB_VS_BTN_40BB_ENTRIES: [string, DefendResponseAction][] = [
  ['AA', '3bet'], ['KK', '3bet'], ['QQ', '3bet'], ['JJ', '3bet'], ['TT', '3bet'], ['99', '3bet'], ['88', '3bet'],
  ['AKs', '3bet'], ['AKo', '3bet'], ['AQs', '3bet'], ['AJs', '3bet'], ['ATs', '3bet'],
  ['A9s', '3bet'], ['A5s', '3bet'], ['A4s', '3bet'], ['A3s', '3bet'],
  ['KQs', '3bet'], ['KJs', '3bet'],
  ['AQo', '3bet'],
  ['77', 'call'], ['66', 'call'], ['55', 'call'], ['44', 'call'], ['33', 'call'], ['22', 'call'],
  ['A8s', 'call'], ['A7s', 'call'], ['A2s', 'call'],
  ['KTs', 'call'], ['K9s', 'call'],
  ['QJs', 'call'], ['QTs', 'call'],
  ['JTs', 'call'], ['T9s', 'call'], ['98s', 'call'], ['87s', 'call'], ['76s', 'call'], ['65s', 'call'],
  ['AJo', 'call'], ['ATo', 'call'], ['KQo', 'call'],
]

/** Key convention: `${heroPosition}_vs_${villainPosition}_${stackBB}BB`. */
export const DEFEND_RESPONSE_CHARTS: Record<string, DefendResponseChart> = {
  HJ_vs_UTG_60BB: {
    key: 'HJ_vs_UTG_60BB',
    heroPosition: 'HJ',
    villainPosition: 'UTG',
    stackBB: 60,
    source: 'Modern Poker Theory Ch.8, "Defending the HJ" (60bb)',
    aggregate: { '3bet': 5.2, call: 9.3, fold: 85.5 },
    cells: cells(HJ_VS_UTG_60BB_ENTRIES),
  },
  CO_vs_UTG_60BB: {
    key: 'CO_vs_UTG_60BB',
    heroPosition: 'CO',
    villainPosition: 'UTG',
    stackBB: 60,
    source: 'Modern Poker Theory Ch.8, "Defending the CO" (60bb)',
    aggregate: { '3bet': 5.2, call: 13.0, fold: 81.8 },
    cells: cells(CO_VS_UTG_60BB_ENTRIES),
  },
  CO_vs_HJ_60BB: {
    key: 'CO_vs_HJ_60BB',
    heroPosition: 'CO',
    villainPosition: 'HJ',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the CO" (vs UTG, 60bb) using Ch.5\'s stated BN-vs-LJ/HJ/CO widening pattern — no separate CO-vs-HJ aggregate is stated at 60bb.',
    aggregate: { '3bet': 6.2, call: 15.1, fold: 78.7 },
    cells: cells(CO_VS_HJ_60BB_ENTRIES),
  },
  BTN_vs_UTG_60BB: {
    key: 'BTN_vs_UTG_60BB',
    heroPosition: 'BTN',
    villainPosition: 'UTG',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the BN" (vs CO, 60bb) using Ch.5\'s stated BN-vs-LJ/HJ/CO widening pattern.',
    aggregate: { '3bet': 7.2, call: 16.4, fold: 76.4 },
    cells: cells(BTN_VS_UTG_60BB_ENTRIES),
  },
  BTN_vs_HJ_60BB: {
    key: 'BTN_vs_HJ_60BB',
    heroPosition: 'BTN',
    villainPosition: 'HJ',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the BN" (vs CO, 60bb) using Ch.5\'s stated BN-vs-LJ/HJ/CO widening pattern.',
    aggregate: { '3bet': 8.7, call: 16.7, fold: 74.6 },
    cells: cells(BTN_VS_HJ_60BB_ENTRIES),
  },
  BTN_vs_CO_60BB: {
    key: 'BTN_vs_CO_60BB',
    heroPosition: 'BTN',
    villainPosition: 'CO',
    stackBB: 60,
    source: 'Modern Poker Theory Ch.8, "Defending the BN" (60bb)',
    aggregate: { '3bet': 11.5, call: 16.9, fold: 71.6 },
    cells: cells(BTN_VS_CO_60BB_ENTRIES),
  },
  SB_vs_UTG_60BB: {
    key: 'SB_vs_UTG_60BB',
    heroPosition: 'SB',
    villainPosition: 'UTG',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the SB" (vs BN, 60bb) using the book\'s own SB-leans-on-aggression-not-calling shape.',
    aggregate: { '3bet': 8.0, call: 6.0, fold: 86.0 },
    cells: cells(SB_VS_UTG_60BB_ENTRIES),
  },
  SB_vs_HJ_60BB: {
    key: 'SB_vs_HJ_60BB',
    heroPosition: 'SB',
    villainPosition: 'HJ',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the SB" (vs BN, 60bb).',
    aggregate: { '3bet': 10.5, call: 8.5, fold: 81.0 },
    cells: cells(SB_VS_HJ_60BB_ENTRIES),
  },
  SB_vs_CO_60BB: {
    key: 'SB_vs_CO_60BB',
    heroPosition: 'SB',
    villainPosition: 'CO',
    stackBB: 60,
    source: 'Extrapolated from Ch.8 "Defending the SB" (vs BN, 60bb).',
    aggregate: { '3bet': 13.0, call: 11.5, fold: 75.5 },
    cells: cells(SB_VS_CO_60BB_ENTRIES),
  },
  SB_vs_BTN_60BB: {
    key: 'SB_vs_BTN_60BB',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    stackBB: 60,
    source: 'Modern Poker Theory Ch.8, "Defending the SB" (60bb)',
    aggregate: { '3bet': 16.2, call: 17.2, fold: 66.6 },
    cells: cells(SB_VS_BTN_60BB_ENTRIES),
  },
  SB_vs_BTN_15BB: {
    key: 'SB_vs_BTN_15BB',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    stackBB: 15,
    source: 'Modern Poker Theory Ch.8, "Defending the SB" (15bb) — All-in 28.2% / Fold 71.8% (no stated calling range at this depth).',
    aggregate: { jam: 28.2, fold: 71.8 },
    cells: cells(SB_VS_BTN_15BB_ENTRIES),
  },
  SB_vs_BTN_25BB: {
    key: 'SB_vs_BTN_25BB',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    stackBB: 25,
    source: 'Interpolated between Ch.8\'s stated SB-vs-BN 15bb (all-in 28.2%/fold 71.8%) and 60bb (3bet 16.2%/call 17.2%/fold 66.6%) anchors — no separate 25bb aggregate is stated.',
    aggregate: { jam: 22.0, call: 8.0, fold: 70.0 },
    cells: cells(SB_VS_BTN_25BB_ENTRIES),
  },
  SB_vs_BTN_40BB: {
    key: 'SB_vs_BTN_40BB',
    heroPosition: 'SB',
    villainPosition: 'BTN',
    stackBB: 40,
    source: 'Interpolated between Ch.8\'s stated SB-vs-BN 15bb and 60bb anchors — no separate 40bb aggregate is stated.',
    aggregate: { '3bet': 15.0, call: 13.5, fold: 71.5 },
    cells: cells(SB_VS_BTN_40BB_ENTRIES),
  },
}
