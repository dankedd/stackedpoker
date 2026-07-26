'use client'

import { cn } from '@/lib/utils'
import { RANKS, HAND_GRID, comboCount, TOTAL_COMBOS } from '@/lib/learn/handGrid'
import type { ChartDiffEntry } from '@/lib/learn/mttRfiRanges'
import type { ActionId, RangeStrategyMap, StrategyMix } from '@/lib/learn/rangeStrategy'
import { classifyMix, pruneMix } from '@/lib/learn/rangeStrategy'
import { actionCssColor, actionLabel, actionStyle } from '@/lib/learn/actionStyles'

type PreflopAction = 'raise' | 'limp' | 'shove' | 'fold'

/** Preferred left-to-right segment order so every cell (and the legend) orders
 *  actions the same way across the whole grid — aggression first, fold last.
 *  Any action id not in this list falls in afterward, in first-seen order. */
const ACTION_PRIORITY = ['4bet', '3bet', 'squeeze', 'raise', 'jam', 'shove', 'limp', 'call', 'fold']

/** Stable, grid-wide action order derived from every mix actually present —
 *  so a hand's segments (and the shared legend) are always ordered the same
 *  way no matter which hands happen to be mixed. */
function resolveActionOrder(strategies: RangeStrategyMap, explicit?: ActionId[]): ActionId[] {
  if (explicit && explicit.length > 0) return explicit
  // 'fold' is always a possible implicit action (any hand absent from `strategies`
  // renders as 100% fold — see the component's own per-cell fallback), so it's
  // always part of the order even when every explicit mix omits it entirely.
  const seen = new Set<ActionId>(['fold'])
  for (const mix of Object.values(strategies)) {
    for (const action of Object.keys(mix)) seen.add(action)
  }
  const prioritized = ACTION_PRIORITY.filter((a) => seen.has(a))
  const rest = [...seen].filter((a) => !ACTION_PRIORITY.includes(a))
  return [...prioritized, ...rest]
}

/** Builds a hard-stop `linear-gradient` so segment widths are exactly
 *  proportional to frequency — no gradients/blur at the boundary, per spec
 *  ("a clean left-to-right split", never an ambiguous fade). */
function segmentedBackground(mix: StrategyMix, order: ActionId[]): string {
  const pruned = pruneMix(mix)
  const total = Object.values(pruned).reduce((s, f) => s + f, 0)
  if (total <= 1e-9) return actionCssColor('fold')
  let cumulative = 0
  const stops: string[] = []
  for (const action of order) {
    const freq = pruned[action]
    if (!freq) continue
    const color = actionCssColor(action)
    const start = (cumulative / total) * 100
    cumulative += freq
    const end = (cumulative / total) * 100
    stops.push(`${color} ${start}%`, `${color} ${end}%`)
  }
  if (stops.length === 0) return actionCssColor('fold')
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** Exact-percentage breakdown text for hover (title) / tap (detail bubble),
 *  descending by frequency — "Call 72%, Fold 28%". */
function formatMixBreakdown(mix: StrategyMix, order: ActionId[]): string {
  const pruned = pruneMix(mix)
  return order
    .filter((a) => pruned[a] != null)
    .map((a) => `${actionLabel(a)} ${Math.round(pruned[a] * 100)}%`)
    .join(', ')
}

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
  /** 'membership' (default) = binary in/out. 'three_action' = color by actionMap.
   *  'diff' = compare `range` (baseline) against `comparisonRange` (learner/example), boolean membership only.
   *  'action_diff' = compare two MttRfiCharts' dominant actions via `actionDiff` (added/removed/changed/unchanged).
   *  'strategy' = the canonical mixed-frequency renderer: each cell is a proportional left-to-right
   *  split of every action in that hand's `strategies[hand]` mix (see rangeStrategy.ts), rather than
   *  collapsing to one dominant color. Use this for any AUTHORITATIVE reveal of a real strategy —
   *  superseded the old opacity-shaded 'frequency' mode, which only supported one action's frequency
   *  and had no exact-percentage hover/tap detail. */
  mode?: 'membership' | 'three_action' | 'diff' | 'action_diff' | 'strategy'
  /** 'three_action' mode: which action each hand takes. */
  actionMap?: Record<string, PreflopAction>
  /** 'diff' mode: the range being compared against the baseline (`range`). */
  comparisonRange?: string[]
  /** 'action_diff' mode: precomputed per-hand diff (see mttRfiRanges.ts#computeChartDiff). */
  actionDiff?: ChartDiffEntry[]
  /** 'strategy' mode: hand -> full action-frequency mix (see rangeStrategy.ts). A hand absent from
   *  this map renders as 100% fold, matching the sparse-chart convention used elsewhere. */
  strategies?: RangeStrategyMap
  /** 'strategy' mode: explicit left-to-right action order (defaults to a stable aggression-first
   *  order derived from every action actually present in `strategies`). */
  strategyActionOrder?: ActionId[]
  /** Rings exactly one cell (e.g. the just-tested hand) without touching its existing color. */
  highlightHand?: string
}

/** Read-only 13x13 range-grid display — membership, frequency-shaded, 3-4 action colored, a
 *  baseline-vs-comparison diff, or a two-chart action-level diff. */
export function PokerRangeGrid({
  range,
  className,
  mode = 'membership',
  actionMap,
  comparisonRange,
  actionDiff,
  strategies,
  strategyActionOrder,
  highlightHand,
}: PokerRangeGridProps) {
  const inRange = new Set(range)
  const inComparison = new Set(comparisonRange ?? [])
  const combos = range.reduce((sum, h) => sum + comboCount(h), 0)
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1)
  const diffByHand = new Map((actionDiff ?? []).map((d) => [d.hand, d]))
  const strategyOrder = mode === 'strategy' ? resolveActionOrder(strategies ?? {}, strategyActionOrder) : []

  function cellClasses(hand: string, isPair: boolean, isSuited: boolean): string {
    if (mode === 'action_diff') {
      const entry = diffByHand.get(hand)
      return entry ? ACTION_DIFF_COLOR[entry.kind] : ACTION_DIFF_COLOR.unchanged
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

                if (mode === 'strategy') {
                  const mix = strategies?.[hand] ?? { fold: 1 }
                  const breakdown = formatMixBreakdown(mix, strategyOrder)
                  const mixInfo = classifyMix(mix, actionLabel)

                  return (
                    <div
                      key={colIdx}
                      tabIndex={0}
                      role="group"
                      aria-label={`${hand}: ${breakdown}`}
                      title={`${hand}\n${breakdown}`}
                      className={cn(
                        'group relative flex-1 min-w-0 aspect-square flex items-center justify-center',
                        'm-px rounded-[3px] select-none text-[8px] font-bold leading-none cursor-default',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:z-20',
                        highlightHand === hand && 'ring-2 ring-white ring-offset-1 ring-offset-background z-10 relative',
                      )}
                      style={{ background: segmentedBackground(mix, strategyOrder) }}
                    >
                      <span className="relative z-10 truncate rounded-sm bg-black/30 px-0.5 text-white drop-shadow-sm">
                        {hand}
                      </span>
                      {/* Hover/focus/tap detail — always in the DOM (SSR/testable), shown via CSS only. */}
                      <div
                        role="tooltip"
                        className={cn(
                          'pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 w-max max-w-[9rem] -translate-x-1/2',
                          'rounded-md border border-border/30 bg-popover px-2 py-1 text-left text-[9px] font-medium leading-tight text-popover-foreground shadow-lg',
                          'opacity-0 scale-95 transition-all duration-100',
                          'group-hover:opacity-100 group-hover:scale-100 group-focus:opacity-100 group-focus:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100',
                        )}
                      >
                        <p className="font-bold">{hand} — {mixInfo.label}</p>
                        <p className="text-muted-foreground">{breakdown}</p>
                      </div>
                    </div>
                  )
                }

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
      {mode === 'strategy' ? (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
          {strategyOrder.map((a) => (
            <div key={a} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-[2px]', actionStyle(a).swatch)} />
              <span>{actionLabel(a)}</span>
            </div>
          ))}
        </div>
      ) : mode === 'three_action' && actionMap ? (
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
