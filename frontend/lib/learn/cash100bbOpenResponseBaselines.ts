/**
 * Cash 100bb "Playing Versus Open Raises" (Chapter 5) — a defending position's
 * COMPLETE response to an open: 3-bet / call / fold, all three actions known.
 *
 * SOURCE: Michael Acevedo, "Modern Poker Theory" (2019), Chapter 5, "6-max Cash
 * Game Equilibrium Strategies (100bb)" -> "Specific Ranges for Playing Versus
 * Open Raises" (Hand Ranges 56-87, cEV solver output, 100bb effective stacks).
 *
 * Same extraction method as mttRfiBaselines.ts: each chart is a 13x13
 * color-coded hand grid in the book (red = 3-bet, black = call, gray = fold;
 * fill width within a cell = frequency), with no per-hand numbers printed in
 * the text — only a chart-wide aggregate caption. Extracted via per-cell pixel
 * measurement against that color legend, then cross-validated against the
 * book's own stated aggregate for the one chart transcribed so far (measured
 * 12.16% 3-bet / 4.99% call / 82.85% fold vs. the book's printed 11.7% / 5.4%
 * / 82.3% for Hand Range 66 — within ~0.5 percentage points, same tolerance
 * mttRfiBaselines.ts's own extraction landed within). Frequencies are rounded
 * to the nearest 0.05 — deliberately not claiming false precision beyond what
 * a rendered chart image supports.
 *
 * Cells are SPARSE: a hand absent from a chart's `cells` array is implicitly
 * 100% fold (matches MTT_RFI_CHARTS' convention). Only Hand Range 66 (BN vs CO
 * Open) has been transcribed so far — the other 31 charts in this section
 * (HJ/CO/BN/SB/BB vs every earlier position, plus their 4-bet-response
 * counterparts) are out of scope until a real need for them exists; do not
 * invent placeholder entries for matchups not listed in
 * `CASH_100BB_OPEN_RESPONSE_CHARTS` below.
 */

export type Cash100bbOpenResponseAction = '3bet' | 'call' | 'fold'

export interface Cash100bbOpenResponseActionFrequencies {
  '3bet'?: number
  call?: number
  fold?: number
}

export interface Cash100bbOpenResponseCell {
  hand: string
  actions: Cash100bbOpenResponseActionFrequencies
}

/** Book-stated aggregate %, printed directly under the chart in the book —
 *  the only per-chart numbers the book itself prints; every per-hand cell
 *  below is a pixel-measured reconstruction, not a transcribed number. */
export interface Cash100bbOpenResponseAggregate {
  '3bet': number
  call: number
  fold: number
}

export interface Cash100bbOpenResponseSourceRef {
  book: 'Modern Poker Theory'
  chapterNo: 5
  handRangeNo: number
  page: number
}

export interface Cash100bbOpenResponseChart {
  key: string
  /** The position choosing an action here (facing `openerPosition`'s open). */
  defenderPosition: string
  openerPosition: string
  aggregate: Cash100bbOpenResponseAggregate
  cells: Cash100bbOpenResponseCell[]
  sourceRef: Cash100bbOpenResponseSourceRef
}

// ── Hand Range 66: BN vs CO Open (p.228) ─────────────────────────────────────
// Book aggregate: 3-bet 11.7% / call 5.4% / fold 82.3%.
// Measured (combo-weighted, this file's 51 listed hands + implicit fold for
// the rest): 3-bet 12.16% / call 4.99% / fold 82.85%.

const BN_VS_CO_CELLS: Cash100bbOpenResponseCell[] = [
  { hand: 'AA', actions: { '3bet': 1 } },
  { hand: 'AKs', actions: { '3bet': 1 } },
  { hand: 'AQs', actions: { '3bet': 0.95, call: 0.05 } },
  { hand: 'AJs', actions: { '3bet': 0.6, call: 0.4 } },
  { hand: 'ATs', actions: { '3bet': 0.4, call: 0.6 } },
  { hand: 'A9s', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'A8s', actions: { '3bet': 0.7, call: 0.3 } },
  { hand: 'A7s', actions: { '3bet': 0.75, call: 0.25 } },
  { hand: 'A6s', actions: { '3bet': 0.6, call: 0.15, fold: 0.25 } },
  { hand: 'A5s', actions: { '3bet': 0.55, call: 0.45 } },
  { hand: 'A4s', actions: { '3bet': 0.6, call: 0.4 } },
  { hand: 'A3s', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'AKo', actions: { '3bet': 1 } },
  { hand: 'KK', actions: { '3bet': 1 } },
  { hand: 'KQs', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'KJs', actions: { '3bet': 0.7, call: 0.3 } },
  { hand: 'KTs', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'K9s', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'K8s', actions: { '3bet': 0.15, call: 0.1, fold: 0.75 } },
  { hand: 'K7s', actions: { call: 0.05, fold: 0.95 } },
  { hand: 'K6s', actions: { '3bet': 0.15, call: 0.1, fold: 0.75 } },
  { hand: 'AQo', actions: { '3bet': 0.7, call: 0.3 } },
  { hand: 'KQo', actions: { '3bet': 0.7, call: 0.3 } },
  { hand: 'QQ', actions: { '3bet': 1 } },
  { hand: 'QJs', actions: { '3bet': 0.5, call: 0.5 } },
  { hand: 'QTs', actions: { '3bet': 0.45, call: 0.55 } },
  { hand: 'Q9s', actions: { '3bet': 0.9, call: 0.1 } },
  { hand: 'AJo', actions: { '3bet': 0.75, call: 0.25 } },
  { hand: 'KJo', actions: { '3bet': 0.6, call: 0.2, fold: 0.2 } },
  { hand: 'QJo', actions: { '3bet': 0.45, fold: 0.55 } },
  { hand: 'JJ', actions: { '3bet': 0.9, call: 0.1 } },
  { hand: 'JTs', actions: { '3bet': 0.6, call: 0.4 } },
  { hand: 'J9s', actions: { '3bet': 0.5, call: 0.25, fold: 0.25 } },
  { hand: 'ATo', actions: { '3bet': 0.7, fold: 0.3 } },
  { hand: 'KTo', actions: { '3bet': 0.15, fold: 0.85 } },
  { hand: 'TT', actions: { '3bet': 0.65, call: 0.35 } },
  { hand: 'T9s', actions: { '3bet': 0.55, call: 0.45 } },
  { hand: 'T8s', actions: { call: 0.05, fold: 0.95 } },
  { hand: '99', actions: { '3bet': 0.6, call: 0.4 } },
  { hand: '98s', actions: { call: 0.25, fold: 0.75 } },
  { hand: '88', actions: { '3bet': 0.5, call: 0.5 } },
  { hand: '87s', actions: { call: 0.2, fold: 0.8 } },
  { hand: '77', actions: { '3bet': 0.5, call: 0.5 } },
  { hand: '76s', actions: { call: 0.15, fold: 0.85 } },
  { hand: '66', actions: { '3bet': 0.5, call: 0.5 } },
  { hand: '65s', actions: { call: 0.05, fold: 0.95 } },
  { hand: '55', actions: { '3bet': 0.4, call: 0.45, fold: 0.15 } },
  { hand: '54s', actions: { call: 0.15, fold: 0.85 } },
  { hand: '44', actions: { '3bet': 0.2, call: 0.3, fold: 0.5 } },
  { hand: '33', actions: { '3bet': 0.15, call: 0.25, fold: 0.6 } },
  { hand: '22', actions: { '3bet': 0.1, call: 0.25, fold: 0.65 } },
]

/** Key convention: `${defenderPosition}_vs_${openerPosition}_100bb`. */
export const CASH_100BB_OPEN_RESPONSE_CHARTS: Record<string, Cash100bbOpenResponseChart> = {
  BN_vs_CO_100bb: {
    key: 'BN_vs_CO_100bb',
    defenderPosition: 'BTN',
    openerPosition: 'CO',
    aggregate: { '3bet': 11.7, call: 5.4, fold: 82.3 },
    cells: BN_VS_CO_CELLS,
    sourceRef: { book: 'Modern Poker Theory', chapterNo: 5, handRangeNo: 66, page: 228 },
  },
}
