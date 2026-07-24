/**
 * Shared 13x13 starting-hand grid primitives — extracted from three previously
 * independent, byte-identical copies (RangeBuild.tsx, PokerRangeGrid.tsx,
 * RangeHeatmap.tsx). Each component's interaction/render logic stays separate
 * (they behave differently); only this constant math is deduplicated.
 */

/** 13 ranks in descending order. */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

/**
 * Builds the full 169-hand grid, [row][col] where row = rank1, col = rank2.
 * Pairs on the diagonal (row === col): e.g. AA.
 * Suited above the diagonal (row < col): AKs is [0][1].
 * Offsuit below the diagonal (row > col): AKo is [1][0].
 */
export function buildHandGrid(): string[][] {
  return RANKS.map((r1, row) =>
    RANKS.map((r2, col) => {
      if (row === col) return r1 + r1 // pair
      if (row < col) return r1 + r2 + 's' // suited (above diagonal)
      return r2 + r1 + 'o' // offsuit (below diagonal)
    }),
  )
}

export const HAND_GRID = buildHandGrid()

/** Combo count per hand-class notation: pair=6, suited=4, offsuit=12. */
export function comboCount(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6 // pair
}

/** Total two-card combos in a 13x13 grid: 4*78 + 12*78 + 6*13 = 1326. */
export const TOTAL_COMBOS = 1326
