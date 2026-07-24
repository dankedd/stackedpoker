'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { RangeRevealComparison } from '@/components/learn/visuals/RangeRevealComparison'
import {
  DEFAULT_PREFILL_NOTE,
  resolvePrefilledHands,
  resolveTargetHands,
  createInitialRangeSelection,
  toggleRangeHand,
  clearRangeSelection,
  resetRangeToFoundation,
  isPrefilledCell,
  type RangeSelectionState,
} from '@/lib/learn/rangePrefill'

// 13 ranks in descending order
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

// Build the full 169-hand grid
// [row][col] where row = rank1, col = rank2
// Pairs on diagonal (row === col): e.g. AA
// Suited ABOVE diagonal (row < col → col rank > row rank → use col+row+"s"): AKs is [0][1]
// Offsuit BELOW diagonal (row > col): AKo is [1][0]
function buildHandGrid(): string[][] {
  return RANKS.map((r1, row) =>
    RANKS.map((r2, col) => {
      if (row === col) return r1 + r1          // pair
      if (row < col) return r1 + r2 + 's'     // suited (above diagonal)
      return r2 + r1 + 'o'                     // offsuit (below diagonal)
    })
  )
}

const HAND_GRID = buildHandGrid()

// Approximate combo counts per cell
function comboCount(hand: string): number {
  if (hand.endsWith('s')) return 4
  if (hand.endsWith('o')) return 12
  // pair
  return 6
}

// Total combos in a 13x13 grid = 4*78 + 12*78 + 6*13 = 312 + 936 + 78 = 1326
const TOTAL_COMBOS = 1326
const TOTAL_HANDS = 1326 // same as above: total two-card combos

interface RangeBuildProps {
  step: LessonStep
  onAnswer: (combos: string[], timeMs: number) => void
  disabled?: boolean
}

export function RangeBuild({ step, onAnswer, disabled = false }: RangeBuildProps) {
  const mountTime = useRef(Date.now())
  const foundation = useMemo(() => resolvePrefilledHands(step), [step])
  const foundationSet = useMemo(() => new Set(foundation), [foundation])
  const [rangeState, setRangeState] = useState<RangeSelectionState>(() => createInitialRangeSelection(foundation))
  const [submitted, setSubmitted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add')
  const [reviewingDiff, setReviewingDiff] = useState(false)

  const selected = rangeState.selected

  useEffect(() => {
    mountTime.current = Date.now()
    setRangeState(createInitialRangeSelection(foundation))
    setSubmitted(false)
    setReviewingDiff(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const toggleHand = useCallback(
    (hand: string, mode?: 'add' | 'remove') => {
      if (disabled || submitted) return
      setRangeState(prev => toggleRangeHand(prev, hand, mode))
    },
    [disabled, submitted]
  )

  function handleMouseDown(hand: string) {
    if (disabled || submitted) return
    const mode = selected.has(hand) ? 'remove' : 'add'
    setDragMode(mode)
    setIsDragging(true)
    toggleHand(hand, mode)
  }

  function handleMouseEnter(hand: string) {
    if (!isDragging || disabled || submitted) return
    toggleHand(hand, dragMode)
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  const finalCombos = Array.from(selected)

  function handleSubmit() {
    if (disabled || submitted) return
    const elapsed = Date.now() - mountTime.current
    if (step.range_build_show_diff && !reviewingDiff) {
      // Show the inline diff before advancing to the generic score feedback.
      setReviewingDiff(true)
      return
    }
    setSubmitted(true)
    onAnswer(finalCombos, elapsed)
  }

  function handleContinueFromDiff() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(finalCombos, Date.now() - mountTime.current)
  }

  if (reviewingDiff) {
    const targetCombos = resolveTargetHands(step)
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Here&apos;s how your range compares to the target range.
          </p>
        </div>
        <RangeRevealComparison yourRange={finalCombos} targetRange={targetCombos} targetLabel="Target range" />
        <button
          type="button"
          onClick={handleContinueFromDiff}
          className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden bg-gradient-to-r from-violet-600 to-blue-500"
        >
          Continue
        </button>
      </div>
    )
  }

  function handleClearAll() {
    if (disabled || submitted) return
    setRangeState(clearRangeSelection())
  }

  function handleResetToFoundation() {
    if (disabled || submitted) return
    setRangeState(resetRangeToFoundation(foundation))
  }

  // Stats
  const selectedCombos = Array.from(selected).reduce((sum, h) => sum + comboCount(h), 0)
  const pctOfRange = ((selectedCombos / TOTAL_COMBOS) * 100).toFixed(1)

  return (
    <div
      className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Narrative / prompt */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Prefilled foundation explanation */}
      {foundation.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <p className="text-sm text-amber-200/80 leading-relaxed">
            {step.range_prefilled_note ?? DEFAULT_PREFILL_NOTE}
          </p>
        </div>
      )}

      {/* Hint */}
      {step.range_hint && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <p className="text-xs text-violet-400/80">{step.range_hint}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">
            {selected.size}{' '}
            <span className="text-muted-foreground/50 font-normal">
              hand{selected.size !== 1 ? 's' : ''}
            </span>
          </span>
          <span className="text-sm font-bold text-violet-400">
            {selectedCombos}{' '}
            <span className="text-muted-foreground/50 font-normal text-xs">combos</span>
          </span>
          <span className="text-sm font-bold text-amber-400">
            {pctOfRange}
            <span className="text-muted-foreground/50 font-normal text-xs">% of range</span>
          </span>
        </div>
        {!submitted && !disabled && (
          <div className="flex items-center gap-3">
            {foundation.length > 0 && (
              <button
                type="button"
                onClick={handleResetToFoundation}
                className="text-xs text-amber-400/70 hover:text-amber-300 transition-colors"
              >
                Reset to foundation
              </button>
            )}
            {selected.size > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Range grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex ml-7 mb-0.5">
            {RANKS.map(r => (
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
              {/* Row label */}
              <div className="w-7 text-[9px] font-bold text-muted-foreground/40 text-center shrink-0">
                {RANKS[rowIdx]}
              </div>
              {/* Cells */}
              {row.map((hand, colIdx) => {
                const isSelected = selected.has(hand)
                const isPair = rowIdx === colIdx
                const isSuited = rowIdx < colIdx
                const isPrefilled = isPrefilledCell(rangeState, foundationSet, hand)

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex-1 min-w-0 aspect-square flex items-center justify-center',
                      'm-px rounded-[3px] cursor-pointer select-none transition-colors duration-75',
                      'text-[8px] font-bold leading-none',
                      isPrefilled
                        ? 'bg-violet-500/30 text-violet-200 border border-dashed border-amber-400/60'
                        : isSelected
                        ? isPair
                          ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/40'
                          : isSuited
                          ? 'bg-violet-600/80 text-white'
                          : 'bg-violet-500/60 text-white'
                        : isPair
                        ? 'bg-secondary/70 text-muted-foreground/60 hover:bg-violet-500/20 hover:text-violet-300'
                        : isSuited
                        ? 'bg-secondary/50 text-muted-foreground/40 hover:bg-violet-500/15 hover:text-violet-400/70'
                        : 'bg-secondary/30 text-muted-foreground/30 hover:bg-violet-500/10 hover:text-violet-400/50',
                      (disabled || submitted) && 'cursor-default pointer-events-none'
                    )}
                    onMouseDown={() => handleMouseDown(hand)}
                    onMouseEnter={() => handleMouseEnter(hand)}
                    title={isPrefilled ? 'Prefilled foundation — click to remove if you disagree' : undefined}
                  >
                    <span className="truncate px-0.5">{hand}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/40">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500" />
          <span>Pairs (diagonal)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-600/80" />
          <span>Suited (upper)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500/60" />
          <span>Offsuit (lower)</span>
        </div>
        {foundation.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-[2px] bg-violet-500/30 border border-dashed border-amber-400/60" />
            <span>Prefilled foundation</span>
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        type="button"
        disabled={disabled || submitted || selected.size === 0}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2',
          'rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled || selected.size === 0
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
        )}
      >
        {!submitted && !disabled && selected.size > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
        {submitted
          ? 'Submitted'
          : selected.size === 0
          ? 'Select at least one hand'
          : `Submit range (${selectedCombos} combos)`}
      </button>
    </div>
  )
}
