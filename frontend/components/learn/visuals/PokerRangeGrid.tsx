'use client'

import { cn } from '@/lib/utils'

// Same 13x13 layout convention used by RangeBuild / RangeHeatmap:
// pairs on the diagonal, suited above, offsuit below.
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

function buildHandGrid(): string[][] {
  return RANKS.map((r1, row) =>
    RANKS.map((r2, col) => {
      if (row === col) return r1 + r1
      if (row < col) return r1 + r2 + 's'
      return r2 + r1 + 'o'
    }),
  )
}

const HAND_GRID = buildHandGrid()

function comboCount(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  return 6
}

const TOTAL_COMBOS = 1326

interface PokerRangeGridProps {
  /** Hand notations included in the range, e.g. ['AA', 'KQs', 'JTs']. */
  range: string[]
  className?: string
}

/** Read-only 13x13 range-grid display for showing a predefined range as context (no interaction). */
export function PokerRangeGrid({ range, className }: PokerRangeGridProps) {
  const inRange = new Set(range)
  const combos = range.reduce((sum, h) => sum + comboCount(h), 0)
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex ml-7 mb-0.5">
            {RANKS.map((r) => (
              <div
                key={r}
                className="flex-1 min-w-0 text-center text-[9px] font-bold text-muted-foreground/40 leading-none"
              >
                {r}
              </div>
            ))}
          </div>

          {/* Rows */}
          {HAND_GRID.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center">
              <div className="w-7 text-[9px] font-bold text-muted-foreground/40 text-center shrink-0">
                {RANKS[rowIdx]}
              </div>
              {row.map((hand, colIdx) => {
                const isPair = rowIdx === colIdx
                const isSuited = rowIdx < colIdx
                const included = inRange.has(hand)

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'm-px rounded-[3px] select-none text-[8px] font-bold leading-none',
                      included
                        ? isPair
                          ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/40'
                          : isSuited
                          ? 'bg-violet-600/80 text-white'
                          : 'bg-violet-500/60 text-white'
                        : isPair
                        ? 'bg-secondary/70 text-muted-foreground/30'
                        : isSuited
                        ? 'bg-secondary/50 text-muted-foreground/20'
                        : 'bg-secondary/30 text-muted-foreground/15',
                    )}
                  >
                    <span className="truncate px-0.5">{hand}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend / stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/40">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500" />
          <span>In Villain&apos;s range</span>
        </div>
        <span>
          {combos} combos <span className="text-muted-foreground/30">({pct}% of all hands)</span>
        </span>
      </div>
    </div>
  )
}
