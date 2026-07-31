/**
 * Defending the Open (Module 5) — centralized defend-range data.
 *
 * Same data-discipline as `preflopBaselines.ts`/`threebetBaselines.ts`:
 *
 *   1. DEEP (100bb) — BB tiers ported directly from the backend's existing
 *      `backend/app/ranges/preflop/cash_100bb/defend_ranges.py` (via
 *      `registry.py`) — real, mixed-frequency, already in the project. These
 *      are BB CALLING ranges specifically (not the full defend range —
 *      the source file's own docstring notes BB's 3-bets are separate,
 *      see `threebetBaselines.ts` for those).
 *   2. SB/BTN/CO defend and every stack tier below 100bb DO NOT exist
 *      anywhere in the BACKEND (confirmed: only `open_ranges.py`,
 *      `defend_ranges.py` [BB only], `threebet_ranges.py` exist, all
 *      100bb cash) — the tiers below remain hand-authored, mechanically
 *      narrowed approximations for that reason. They ARE, however, covered
 *      by Modern Poker Theory's own Ch.8 ("MTT Equilibrium Strategies:
 *      Defense") at 15/25/40/60bb, for every position — see
 *      `defendResponseBaselines.ts` (Module 5's redesign) for the resulting
 *      source-reconstructed complete-strategy charts, which `defendRangeReveal.ts`
 *      now checks before falling back to this file's BB-only calling slices.
 *
 * Hand notation: 'AA' (pair), 'AKs' (suited), 'AKo' (offsuit).
 * Combo weights: pair=6, suited=4, offsuit=12.
 */

import { parseRangeList, type RangeEntry, type StackWorld } from './preflopBaselines'
import type { RangeSemantics } from './rangeStrategy'

export type { RangeEntry }

/** Key format: '<defender>_vs_<opener>', e.g. 'BB_vs_BTN' = BB defending (calling) a BTN open. */
export type DefendMatchup = 'BB_vs_BTN' | 'BB_vs_CO' | 'BB_vs_SB' | 'BB_vs_UTG'

/** What every `RangeEntry.freq` in this file actually proves — an `action_slice`
 *  (BB's calling frequency only), never a complete or binary strategy. Any
 *  consumer turning `DEFEND_DEEP`/`DEFEND_MEDIUM`/`DEFEND_SHALLOW` into a
 *  `RangeStrategyMap` should import THIS constant rather than re-deciding the
 *  classification at each call site — that's what makes it hard to accidentally
 *  build these into a binary call/fold strategy (the historical "AA renders as
 *  Fold" bug) instead of the `action_slice` these ranges actually are. See
 *  `RangeSemantics`'s own doc comment in rangeStrategy.ts. */
export const DEFEND_SEMANTICS: RangeSemantics = { kind: 'action_slice', action: 'call' }

// ── DEEP (100bb) — ported from backend/app/ranges/preflop/cash_100bb/defend_ranges.py ──

const BB_VS_BTN_DEFEND_RAW = [
  'AA:0.2', 'KK:0.2', 'QQ:0.3', 'JJ:0.4',
  'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs:0.3', 'AQs:0.4', 'AJs:0.5',
  'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs:0.5', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s:0.7', 'K5s:0.6',
  'QJs:0.5', 'QTs', 'Q9s', 'Q8s', 'Q7s:0.7', 'Q6s:0.6',
  'JTs:0.6', 'J9s', 'J8s', 'J7s:0.7',
  'T9s', 'T8s', 'T7s:0.7', 'T6s:0.5',
  '98s', '97s', '96s:0.7',
  '87s', '86s:0.7', '85s:0.5',
  '76s', '75s:0.7',
  '65s', '64s:0.6',
  '54s', '53s:0.6',
  '43s:0.5', '42s:0.4',
  '32s:0.4',
  'AKo:0.2', 'AQo:0.3', 'AJo:0.5',
  'ATo', 'A9o', 'A8o', 'A7o:0.7', 'A6o:0.6',
  'KQo:0.5', 'KJo', 'KTo', 'K9o:0.7', 'K8o:0.5',
  'QJo:0.6', 'QTo', 'Q9o:0.7',
  'JTo', 'J9o:0.7', 'J8o:0.5',
  'T9o:0.7', 'T8o:0.5',
  '98o:0.6',
]

const BB_VS_CO_DEFEND_RAW = [
  'AA:0.2', 'KK:0.2', 'QQ:0.2', 'JJ:0.3',
  'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs:0.3', 'AQs:0.4', 'AJs:0.5',
  'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s:0.6',
  'KQs:0.4', 'KJs', 'KTs', 'K9s', 'K8s:0.7', 'K7s:0.5',
  'QJs:0.5', 'QTs', 'Q9s', 'Q8s:0.6',
  'JTs:0.6', 'J9s', 'J8s:0.7',
  'T9s', 'T8s', 'T7s:0.6',
  '98s', '97s:0.7',
  '87s', '86s:0.6',
  '76s', '75s:0.6',
  '65s', '64s:0.5',
  '54s', '53s:0.5',
  '43s:0.4',
  'AKo:0.2', 'AQo:0.3', 'AJo:0.5',
  'ATo', 'A9o', 'A8o:0.7',
  'KQo:0.5', 'KJo', 'KTo:0.7',
  'QJo:0.6', 'QTo:0.7',
  'JTo:0.7', 'J9o:0.5',
  'T9o:0.6',
  '98o:0.5',
]

const BB_VS_SB_DEFEND_RAW = [
  'AA:0.2', 'KK:0.2', 'QQ:0.3', 'JJ:0.4',
  'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs:0.3', 'AQs:0.4', 'AJs:0.5',
  'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs:0.5', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s:0.7',
  'QJs:0.5', 'QTs', 'Q9s', 'Q8s:0.7',
  'JTs:0.6', 'J9s', 'J8s:0.7',
  'T9s', 'T8s', 'T7s:0.7',
  '98s', '97s',
  '87s', '86s:0.7',
  '76s', '75s:0.7',
  '65s', '64s:0.6',
  '54s', '53s:0.6',
  '43s:0.5', '42s:0.4',
  'AKo:0.2', 'AQo:0.3', 'AJo:0.5',
  'ATo', 'A9o', 'A8o', 'A7o:0.7',
  'KQo:0.5', 'KJo', 'KTo',
  'QJo:0.6', 'QTo:0.7', 'Q9o:0.6',
  'JTo', 'J9o:0.7',
  'T9o:0.7',
  '98o:0.6',
  '87o:0.5',
]

const BB_VS_UTG_DEFEND_RAW = [
  'AA:0.2', 'KK:0.2', 'QQ:0.3', 'JJ:0.4',
  'TT', '99', '88', '77', '66', '55', '44',
  '33:0.6', '22:0.5',
  'AKs:0.3', 'AQs:0.4', 'AJs:0.6',
  'ATs', 'A9s', 'A8s:0.7', 'A7s:0.6',
  'A5s:0.7', 'A4s:0.6',
  'KQs:0.5', 'KJs', 'KTs:0.7',
  'QJs:0.6', 'QTs:0.7',
  'JTs',
  'T9s', '98s:0.7',
  '87s:0.6', '76s:0.6',
  '65s:0.5', '54s:0.5',
  'AKo:0.3', 'AQo:0.5',
  'AJo:0.7', 'ATo:0.7',
  'KQo:0.6', 'KJo:0.7',
  'QJo:0.5',
]

export const DEFEND_DEEP: Record<DefendMatchup, RangeEntry[]> = {
  BB_vs_BTN: parseRangeList(BB_VS_BTN_DEFEND_RAW),
  BB_vs_CO: parseRangeList(BB_VS_CO_DEFEND_RAW),
  BB_vs_SB: parseRangeList(BB_VS_SB_DEFEND_RAW),
  BB_vs_UTG: parseRangeList(BB_VS_UTG_DEFEND_RAW),
}

// ── MEDIUM (~25-40bb) — mechanically derived: only "always defend" hands survive ──

export const DEFEND_MEDIUM: Record<DefendMatchup, RangeEntry[]> = Object.fromEntries(
  Object.entries(DEFEND_DEEP).map(([matchup, entries]) => [matchup, entries.filter((e) => e.freq >= 1)]),
) as Record<DefendMatchup, RangeEntry[]>

// ── SHALLOW (~15bb) — hand-authored, pedagogical only, BB vs BTN and BB vs UTG ──
// Framed as call-or-jam rather than a separate non-all-in size, mirroring the
// same shallow-world simplification `preflopBaselines.ts` uses for RFI.

export const DEFEND_SHALLOW: Partial<Record<DefendMatchup, RangeEntry[]>> = {
  BB_vs_BTN: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'QJs', 'JTs', 'T9s', '98s', '87s', '76s', '65s',
    'AKo', 'AQo', 'AJo', 'KQo',
  ]),
  BB_vs_UTG: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs',
    'AKo', 'AQo',
  ]),
}

/** Same shallow->medium->deep fallback chain StackDepthRangeMorph.tsx's slider has always
 *  used, extracted so any OTHER consumer (e.g. the post-answer defend-range reveal) resolves
 *  a matchup's entries identically instead of re-deriving its own fallback order. Shallow data
 *  only exists for BB_vs_BTN/BB_vs_UTG (see DEFEND_SHALLOW above) — every other matchup falls
 *  back to MEDIUM at the shallow tier, same as before this extraction. */
export function resolveDefendEntries(matchup: DefendMatchup, world: StackWorld): RangeEntry[] {
  if (world === 'shallow') return DEFEND_SHALLOW[matchup] ?? DEFEND_MEDIUM[matchup] ?? []
  if (world === 'medium') return DEFEND_MEDIUM[matchup] ?? []
  return DEFEND_DEEP[matchup] ?? []
}
