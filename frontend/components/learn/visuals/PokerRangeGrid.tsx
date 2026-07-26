'use client'

import { cn } from '@/lib/utils'
import { RANKS, HAND_GRID, comboCount, TOTAL_COMBOS } from '@/lib/learn/handGrid'
import type { ChartDiffEntry } from '@/lib/learn/mttRfiRanges'

type PreflopAction = 'raise' | 'limp' | 'shove' | 'fold'

const ACTION_DIFF_COLOR: Record<ChartDiffEntry['kind'], string> = {
  added: 'bg-emerald-500/70 text-white',
  removed: 'bg-red-500/60 text-white',
  changed: 'bg-amber-500/60 text-white',
  unchanged: 'bg-secondary/30 text-muted-foreground/15',
}

const ACTION_DIFF_LABEL: Record<ChartDiffEntry['kind'], string> = {
  added: 'Added (fold -> in)',
  removed: 'Removed (in -> fold)',
  changed: 'Action changed',
  unchanged: 'Unchanged',
}

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
  /** 'membership' (default) = binary in/out. 'frequency' = shade by mix %. 'three_action' = color by actionMap.
   *  'diff' = compare `range` (baseline) against `comparisonRange` (learner/example), boolean membership only.
   *  'action_diff' = compare two MttRfiCharts' dominant actions via `actionDiff` (added/removed/changed/unchanged). */
  mode?: 'membership' | 'frequency' | 'three_action' | 'diff' | 'action_diff'
  /** 'frequency' mode: mix % per hand (0-1), keyed by hand notation. */
  frequencies?: Record<string, number>
  /** 'three_action' mode: which action each hand takes. */
  actionMap?: Record<string, PreflopAction>
  /** 'diff' mode: the range being compared against the baseline (`range`). */
  comparisonRange?: string[]
  /** 'action_diff' mode: precomputed per-hand diff (see mttRfiRanges.ts#computeChartDiff). */
  actionDiff?: ChartDiffEntry[]
  /** Rings exactly one cell (e.g. the just-tested hand) without touching its existing color. */
  highlightHand?: string
}

/** Read-only 13x13 range-grid display — membership, frequency-shaded, 3-4 action colored, a
 *  baseline-vs-comparison diff, or a two-chart action-level diff. */
export function PokerRangeGrid({
  range,
  className,
  mode = 'membership',
  frequencies,
  actionMap,
  comparisonRange,
  actionDiff,
  highlightHand,
}: PokerRangeGridProps) {
  const inRange = new Set(range)
  const inComparison = new Set(comparisonRange ?? [])
  const combos = range.reduce((sum, h) => sum + comboCount(h), 0)
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1)
  const diffByHand = new Map((actionDiff ?? []).map((d) => [d.hand, d]))

  function cellClasses(hand: string, isPair: boolean, isSuited: boolean): string {
    if (mode === 'action_diff') {
      const entry = diffByHand.get(hand)
      return entry ? ACTION_DIFF_COLOR[entry.kind] : ACTION_DIFF_COLOR.unchanged
    }

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
                      highlightHand === hand && 'ring-2 ring-white ring-offset-1 ring-offset-background z-10 relative',
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
      ) : mode === 'action_diff' ? (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
          {(['added', 'changed', 'removed'] as ChartDiffEntry['kind'][]).map((kind) => (
            <div key={kind} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-[2px]', ACTION_DIFF_COLOR[kind])} />
              <span>{ACTION_DIFF_LABEL[kind]}</span>
            </div>
          ))}
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
