/**
 * Preflop Aggression (Module 4) — centralized 3-bet range data.
 *
 * Same data-discipline as `preflopBaselines.ts` (never fabricate solver-exact
 * frequencies, never copy a published chart, centralize instead of scattering
 * arrays through lesson files):
 *
 *   1. DEEP (~100bb)   — ported directly from the backend's existing
 *                        `backend/app/ranges/preflop/cash_100bb/threebet_ranges.py`,
 *                        itself documented as a polarized/linear illustrative
 *                        construction, not solver-exact. Mixed frequencies preserved.
 *   2. MEDIUM (~25-40bb) — mechanically derived from DEEP: only the "always 3-bet"
 *                        hands survive (mixed/tail bluffs drop out as fold equity
 *                        and stack-off dynamics change at shallower depths).
 *   3. SHALLOW (~15bb) — hand-authored only for the two matchups Module 4's
 *                        stack-depth lesson drills into (BB vs BTN, SB vs BTN),
 *                        framed as "3-bet becomes jam" rather than a separate
 *                        non-all-in size — clearly reduced, clearly pedagogical.
 *
 * Hand notation: 'AA' (pair), 'AKs' (suited), 'AKo' (offsuit).
 * Combo weights: pair=6, suited=4, offsuit=12.
 */

import { parseRangeList, type RangeEntry } from './preflopBaselines'

export type { RangeEntry }

/** Key format: '<3bettor>_vs_<opener>', e.g. 'BB_vs_BTN' = BB 3-betting a BTN open. */
export type ThreebetMatchup = 'SB_vs_BTN' | 'BB_vs_BTN' | 'BB_vs_CO' | 'BTN_vs_CO' | 'BTN_vs_SB' | 'CO_vs_BTN'

// ── DEEP (~100bb) — ported from backend/app/ranges/preflop/cash_100bb/threebet_ranges.py ──

const SB_VS_BTN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ:0.6',
  'AKs', 'AKo', 'AQs:0.7',
  'A5s', 'A4s', 'A3s',
  '76s:0.5', '65s:0.5', '54s:0.4',
  'KQs:0.4',
]

const BB_VS_BTN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ:0.5', 'TT:0.3',
  'AKs', 'AKo', 'AQs:0.6', 'AJs:0.3',
  'A5s', 'A4s', 'A3s', 'A2s:0.5',
  'K5s:0.4',
  '65s:0.5', '54s:0.4', '76s:0.4',
]

const BB_VS_CO_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ:0.4',
  'AKs', 'AKo', 'AQs:0.5',
  'A5s', 'A4s', 'A3s',
  '65s:0.4', '54s:0.4',
]

const BTN_VS_CO_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT:0.4',
  'AKs', 'AKo', 'AQs', 'AQo:0.5',
  'KQs:0.5',
  'A5s', 'A4s',
  '65s:0.4', '54s:0.3',
]

const BTN_VS_SB_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99:0.5',
  'AKs', 'AKo', 'AQs', 'AQo:0.6', 'AJs:0.7',
  'KQs:0.7', 'KQo:0.4',
  'A5s', 'A4s', 'A3s:0.5',
  '76s:0.5', '65s:0.5',
]

const CO_VS_BTN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ:0.5',
  'AKs', 'AKo', 'AQs:0.5',
  'A5s', 'A4s', 'A3s',
  '65s:0.4', '54s:0.4',
]

export const THREEBET_DEEP: Record<ThreebetMatchup, RangeEntry[]> = {
  SB_vs_BTN: parseRangeList(SB_VS_BTN_DEEP_RAW),
  BB_vs_BTN: parseRangeList(BB_VS_BTN_DEEP_RAW),
  BB_vs_CO: parseRangeList(BB_VS_CO_DEEP_RAW),
  BTN_vs_CO: parseRangeList(BTN_VS_CO_DEEP_RAW),
  BTN_vs_SB: parseRangeList(BTN_VS_SB_DEEP_RAW),
  CO_vs_BTN: parseRangeList(CO_VS_BTN_DEEP_RAW),
}

// ── MEDIUM (~25-40bb) — mechanically derived: only "always 3-bet" hands survive ──

export const THREEBET_MEDIUM: Record<ThreebetMatchup, RangeEntry[]> = Object.fromEntries(
  Object.entries(THREEBET_DEEP).map(([matchup, entries]) => [matchup, entries.filter((e) => e.freq >= 1)]),
) as Record<ThreebetMatchup, RangeEntry[]>

// ── SHALLOW (~15bb) — hand-authored, pedagogical only, framed as "3-bet becomes jam" ──

export const THREEBET_SHALLOW: Partial<Record<ThreebetMatchup, RangeEntry[]>> = {
  BB_vs_BTN: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AKo', 'AQs', 'AQo',
    'A5s', 'A4s',
  ]),
  SB_vs_BTN: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ',
    'AKs', 'AKo', 'AQs',
    'A5s', 'A4s',
  ]),
}
