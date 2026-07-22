/**
 * Preflop Foundation (Module 3) — centralized RFI/limp strategy data.
 *
 * Data hierarchy, per the module's design constraints (never fabricate
 * solver-exact frequencies, never copy a published chart, prefer existing
 * app data, centralize instead of scattering arrays through lesson files):
 *
 *   1. DEEP (~100bb)   — ported directly from the backend's existing
 *                        `backend/app/ranges/preflop/cash_100bb/open_ranges.py`,
 *                        itself explicitly documented as "simplified practical
 *                        ranges, not solver-exact." Mixed frequencies preserved.
 *   2. MEDIUM (~25-40bb) — mechanically derived from DEEP: only the "always in"
 *                        hands survive (mixed/occasional tail hands drop out).
 *                        Not a separate authored chart — a direct function of
 *                        the same real data.
 *   3. SHALLOW (~15bb) — hand-authored only for BTN and UTG (the two positions
 *                        the stack-depth lesson actually drills into), clearly
 *                        reduced and clearly pedagogical, not claimed as solver
 *                        output.
 *
 * All exported hand lists use standard notation: 'AA' (pair), 'AKs' (suited),
 * 'AKo' (offsuit). Combo weights: pair=6, suited=4, offsuit=12.
 */

export interface RangeEntry {
  hand: string
  /** Mix frequency 0–1. 1.0 = always raise/act; below 1.0 = a "sometimes" hand. */
  freq: number
}

export type StackWorld = 'shallow' | 'medium' | 'deep'
export type PreflopAction = 'raise' | 'limp' | 'shove' | 'fold'

// ── Parsing helpers ────────────────────────────────────────────────────────────

export function parseRangeEntry(raw: string): RangeEntry {
  const [hand, freqStr] = raw.split(':')
  return { hand, freq: freqStr ? parseFloat(freqStr) : 1.0 }
}

export function parseRangeList(raw: string[]): RangeEntry[] {
  return raw.map(parseRangeEntry)
}

/** Plain hand list (membership only), for components that don't need frequency. */
export function entriesToHandList(entries: RangeEntry[]): string[] {
  return entries.map((e) => e.hand)
}

/** Frequency map keyed by hand, for `PokerRangeGrid`'s `frequencies` prop. */
export function entriesToFrequencyMap(entries: RangeEntry[]): Record<string, number> {
  return Object.fromEntries(entries.map((e) => [e.hand, e.freq]))
}

// ── DEEP (~100bb) — ported from backend/app/ranges/preflop/cash_100bb/open_ranges.py ──

const UTG_OPEN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88:0.5',
  'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
  'JTs:0.7', 'T9s:0.4', 'A9s:0.7', 'KTs:0.6',
  'AKo', 'AQo', 'AJo:0.5', 'KQo:0.7',
]

const HJ_OPEN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77:0.5',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s:0.6',
  'KQs', 'KJs', 'KTs', 'QJs', 'QTs:0.6', 'JTs', 'T9s', '98s:0.6', '87s:0.4',
  'AKo', 'AQo', 'AJo', 'ATo:0.5', 'KQo', 'KJo:0.6', 'QJo:0.4',
]

const CO_OPEN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55:0.6',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s:0.7', 'A3s:0.5',
  'KQs', 'KJs', 'KTs', 'K9s:0.6',
  'QJs', 'QTs', 'Q9s:0.5', 'JTs', 'J9s:0.5', 'T9s', 'T8s:0.5', '98s', '97s:0.4', '87s', '76s:0.6', '65s:0.4',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o:0.4',
  'KQo', 'KJo', 'KTo:0.5', 'QJo', 'QTo:0.4', 'JTo:0.4',
]

const BTN_OPEN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s:0.7', 'K6s:0.6', 'K5s:0.5',
  'QJs', 'QTs', 'Q9s', 'Q8s:0.6', 'Q7s:0.4',
  'JTs', 'J9s', 'J8s:0.7', 'J7s:0.4',
  'T9s', 'T8s', 'T7s:0.6',
  '98s', '97s', '96s:0.5',
  '87s', '86s:0.6', '76s', '75s:0.5', '65s', '64s:0.4', '54s', '53s:0.4', '43s:0.4',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o:0.7', 'A7o:0.6', 'A6o:0.5', 'A5o:0.5',
  'KQo', 'KJo', 'KTo', 'K9o:0.6', 'K8o:0.4',
  'QJo', 'QTo', 'Q9o:0.5',
  'JTo', 'J9o:0.6',
  'T9o:0.5',
  '98o:0.4',
]

const SB_OPEN_DEEP_RAW = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33:0.7', '22:0.6',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s:0.7',
  'KQs', 'KJs', 'KTs', 'K9s', 'K8s:0.7', 'K7s:0.5',
  'QJs', 'QTs', 'Q9s', 'Q8s:0.6',
  'JTs', 'J9s', 'J8s:0.6',
  'T9s', 'T8s:0.7',
  '98s', '97s:0.6',
  '87s', '76s:0.7', '65s:0.6', '54s:0.5',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o:0.7', 'A7o:0.6',
  'KQo', 'KJo', 'KTo', 'K9o:0.5',
  'QJo', 'QTo:0.7', 'JTo:0.7', 'T9o:0.5',
]

export const RFI_DEEP: Record<string, RangeEntry[]> = {
  UTG: parseRangeList(UTG_OPEN_DEEP_RAW),
  HJ: parseRangeList(HJ_OPEN_DEEP_RAW),
  CO: parseRangeList(CO_OPEN_DEEP_RAW),
  BTN: parseRangeList(BTN_OPEN_DEEP_RAW),
  SB: parseRangeList(SB_OPEN_DEEP_RAW),
}

// ── MEDIUM (~25-40bb) — mechanically derived: only "always in" hands survive ──

export const RFI_MEDIUM: Record<string, RangeEntry[]> = Object.fromEntries(
  Object.entries(RFI_DEEP).map(([pos, entries]) => [pos, entries.filter((e) => e.freq >= 1)]),
)

// ── SHALLOW (~15bb) — hand-authored, pedagogical only, BTN and UTG ───────────

export const RFI_SHALLOW: Record<string, RangeEntry[]> = {
  BTN: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s',
    'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s', '65s',
    'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo',
  ]),
  // Note: no '88' here, even though it's a mixed (50%) hand in the deep UTG
  // range — RFI_MEDIUM only keeps "always in" hands, so 88 already drops out
  // at medium depth. Keeping it in shallow would make it reappear as stacks
  // get *shorter*, which isn't a coherent narrowing story.
  UTG: parseRangeList([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs',
    'AKo', 'AQo',
  ]),
}

/** Simplified illustrative SHOVE / RAISE / FOLD split at the shallow world — a teaching
 *  model (top hands prefer a raise, medium-strength-but-awkward hands prefer to shove
 *  and realize their equity immediately), not a memorized solver shove/fold chart. */
export const RFI_SHALLOW_ACTIONS: Record<string, Record<string, PreflopAction>> = {
  BTN: {
    AA: 'raise', KK: 'raise', QQ: 'raise', TT: 'raise', AKs: 'raise', AKo: 'raise', AQs: 'raise',
    JJ: 'shove', 99: 'shove', 88: 'shove', 77: 'shove', 66: 'shove', 55: 'shove',
    AJs: 'shove', ATs: 'shove', A9s: 'shove', A8s: 'shove', A7s: 'shove', A6s: 'shove', A5s: 'shove', A4s: 'shove', A3s: 'shove', A2s: 'shove',
    KQs: 'shove', KJs: 'shove', KTs: 'shove', K9s: 'shove',
    QJs: 'shove', QTs: 'shove', JTs: 'shove', T9s: 'shove', '98s': 'shove', '87s': 'shove', '76s': 'shove', '65s': 'shove',
    AQo: 'shove', AJo: 'shove', ATo: 'shove', KQo: 'shove', KJo: 'shove',
  },
  UTG: {
    AA: 'raise', KK: 'raise', QQ: 'raise', AKs: 'raise', AKo: 'raise',
    JJ: 'shove', TT: 'shove', 99: 'shove',
    AQs: 'shove', AJs: 'shove', ATs: 'shove', KQs: 'shove', KJs: 'shove', AQo: 'shove',
  },
}

// ── SB three-way split (RAISE / LIMP / FOLD) — hand-authored, builds on SB_OPEN_DEEP ──

export const SB_SPLIT: Record<string, PreflopAction> = {
  // Raise: hands strong enough to want to build a pot / apply pressure
  AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise',
  AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', AKo: 'raise', AQo: 'raise', AJo: 'raise',
  KQs: 'raise', KJs: 'raise', KTs: 'raise', KQo: 'raise', KJo: 'raise',
  QJs: 'raise', QTs: 'raise', JTs: 'raise', T9s: 'raise', '98s': 'raise', '87s': 'raise', '76s': 'raise', '65s': 'raise', '54s': 'raise',
  // Limp: playable but speculative — cheap entry, keeps the pot small OOP
  66: 'limp', 55: 'limp', 44: 'limp', 33: 'limp', 22: 'limp',
  A9s: 'limp', A8s: 'limp', A7s: 'limp', A6s: 'limp', A5s: 'limp', A4s: 'limp', A3s: 'limp', A2s: 'limp',
  K9s: 'limp', K8s: 'limp', K7s: 'limp',
  Q9s: 'limp', Q8s: 'limp',
  J9s: 'limp', J8s: 'limp',
  T8s: 'limp', '97s': 'limp',
  ATo: 'limp', A9o: 'limp', KTo: 'limp', QJo: 'limp', QTo: 'limp', JTo: 'limp', T9o: 'limp',
  // Everything else: fold
}

/** Deliberately weak illustrative limp strategy for the "badly constructed" teaching
 *  example — a range that leaks information because only marginal hands ever limp. */
export const BAD_LIMP_EXAMPLE = {
  limp: ['22', '33', '44', '55', '76s', '65s', '54s', 'A9s', 'A8s'],
  raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo'],
}

// ── Players-behind resistance-risk model (Lesson 2) ──────────────────────────

/** Simplified, explicitly-labelled model: assumes ~8% of hands behind Hero are
 *  "3-bet quality." Not a claimed real frequency — an illustrative curve so the
 *  slider shows a real number instead of a vague meter. */
export const WAKE_UP_HAND_FRACTION = 0.08

export function resistanceRisk(playersBehind: number): number {
  return 1 - Math.pow(1 - WAKE_UP_HAND_FRACTION, playersBehind)
}
