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

type PreflopAction = 'raise' | 'limp' | 'shove' | 'fold'

const ACTION_COLOR: Record<PreflopAction, string> = {
  raise: 'bg-violet-500 text-white',
  shove: 'bg-red-500/80 text-white',
  limp: 'bg-sky-500/70 text-white',
  fold: 'bg-secondary/40 text-muted-foreground/30',
}

const ACTION_LABEL: Record<PreflopAction, string> = {
  raise: 'Raise',
  shove: 'Shove',
  limp: 'Limp',
  fold: 'Fold',
}

interface PokerRangeGridProps {
  /** Hand notations included in the range, e.g. ['AA', 'KQs', 'JTs']. In 'diff' mode, this is the BASELINE range. */
  range: string[]
  className?: string
  /** 'membership' (default) = binary in/out. 'frequency' = shade by mix %. 'three_action' = color by actionMap. 'diff' = compare `range` (baseline) against `comparisonRange` (learner/example). */
  mode?: 'membership' | 'frequency' | 'three_action' | 'diff'
  /** 'frequency' mode: mix % per hand (0-1), keyed by hand notation. */
  frequencies?: Record<string, number>
  /** 'three_action' mode: which action each hand takes. */
  actionMap?: Record<string, PreflopAction>
  /** 'diff' mode: the range being compared against the baseline (`range`). */
  comparisonRange?: string[]
}

/** Read-only 13x13 range-grid display — membership, frequency-shaded, 3-4 action colored, or a baseline-vs-comparison diff. */
export function PokerRangeGrid({
  range,
  className,
  mode = 'membership',
  frequencies,
  actionMap,
  comparisonRange,
}: PokerRangeGridProps) {
  const inRange = new Set(range)
  const inComparison = new Set(comparisonRange ?? [])
  const combos = range.reduce((sum, h) => sum + comboCount(h), 0)
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1)

  function cellClasses(hand: string, isPair: boolean, isSuited: boolean): string {
    if (mode === 'frequency' && frequencies) {
      const freq = frequencies[hand] ?? 0
      if (freq <= 0) return 'bg-secondary/30 text-muted-foreground/15'
      // Shade violet intensity by frequency — full opacity at freq=1, faint at low freq.
      const alpha = Math.round(20 + freq * 70)
      return cn('text-white', `bg-violet-500/${alpha}`)
    }

    if (mode === 'three_action' && actionMap) {
      const action = actionMap[hand]
      return action ? ACTION_COLOR[action] : 'bg-secondary/30 text-muted-foreground/15'
    }

    if (mode === 'diff') {
      const inBase = inRange.has(hand)
      const inComp = inComparison.has(hand)
      if (inBase && inComp) return 'bg-emerald-500/70 text-white' // correctly included
      if (inBase && !inComp) return 'bg-amber-500/60 text-white' // missed
      if (!inBase && inComp) return 'bg-red-500/60 text-white' // too-wide
      return isPair
        ? 'bg-secondary/70 text-muted-foreground/30'
        : isSuited
        ? 'bg-secondary/50 text-muted-foreground/20'
        : 'bg-secondary/30 text-muted-foreground/15'
    }

    // 'membership' (default)
    const included = inRange.has(hand)
    return included
      ? isPair
        ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/40'
        : isSuited
        ? 'bg-violet-600/80 text-white'
        : 'bg-violet-500/60 text-white'
      : isPair
      ? 'bg-secondary/70 text-muted-foreground/30'
      : isSuited
      ? 'bg-secondary/50 text-muted-foreground/20'
      : 'bg-secondary/30 text-muted-foreground/15'
  }

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

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'm-px rounded-[3px] select-none text-[8px] font-bold leading-none',
                      cellClasses(hand, isPair, isSuited),
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
      {mode === 'three_action' && actionMap ? (
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
          {(['raise', 'limp', 'shove', 'fold'] as PreflopAction[])
            .filter((a) => Object.values(actionMap).includes(a))
            .map((a) => (
              <div key={a} className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 rounded-[2px]', ACTION_COLOR[a])} />
                <span>{ACTION_LABEL[a]}</span>
              </div>
            ))}
        </div>
      ) : mode === 'diff' ? (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500/70" />
            <span>Correctly included</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-amber-500/60" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-red-500/60" />
            <span>Too wide</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/40">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500" />
            <span>In range</span>
          </div>
          <span>
            {combos} combos <span className="text-muted-foreground/30">({pct}% of all hands)</span>
          </span>
        </div>
      )}
    </div>
  )
}
