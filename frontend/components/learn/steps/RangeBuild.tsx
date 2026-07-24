'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Lightbulb, RotateCcw, Eraser, type LucideIcon } from 'lucide-react'
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

// Splits an instruction note into a strong lead sentence and a more muted
// follow-up, purely for presentation — the underlying copy is untouched.
function splitLeadSentence(text: string): [string, string] {
  const match = text.match(/^(.*?[.!?])\s+([\s\S]*)$/)
  if (!match) return [text, '']
  return [match[1], match[2]]
}

// ── Small presentational helpers ────────────────────────────────────────────

function RangeStat({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          'text-base font-bold leading-none tabular-nums',
          accent ? 'text-violet-300' : 'text-foreground'
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide leading-none text-muted-foreground/45">
        {label}
      </span>
    </div>
  )
}

function ToolbarAction({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  tone: 'accent' | 'muted'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150',
        tone === 'accent'
          ? 'text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 hover:text-violet-200'
          : 'text-muted-foreground/60 hover:bg-secondary/60 hover:text-muted-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

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

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, hand: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleHand(hand)
    }
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
  const [noteLead, noteRest] = splitLeadSentence(step.range_prefilled_note ?? DEFAULT_PREFILL_NOTE)
  const showControls = !submitted && !disabled && (foundation.length > 0 || selected.size > 0)

  return (
    <div
      className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Context / instruction */}
      <div className="space-y-2.5">
        {step.narrative && <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>}

        {foundation.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-violet-500/15 bg-violet-500/[0.07] px-3.5 py-2.5">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-violet-400" aria-hidden />
            <p className="text-sm leading-snug">
              <span className="font-medium text-foreground/95">{noteLead}</span>
              {noteRest && <span className="text-muted-foreground"> {noteRest}</span>}
            </p>
          </div>
        )}

        {step.range_hint && <p className="text-xs text-violet-400/70 leading-relaxed">{step.range_hint}</p>}
      </div>

      {/* Range summary + controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border/15 bg-secondary/15 px-4 py-3">
        <div className="flex items-center gap-5">
          <RangeStat value={selected.size} label="Hands" />
          <RangeStat value={selectedCombos} label="Combos" accent />
          <RangeStat value={`${pctOfRange}%`} label="Range width" />
        </div>

        {showControls && (
          <div className="flex items-center gap-1.5 sm:ml-auto">
            {foundation.length > 0 && (
              <ToolbarAction icon={RotateCcw} label="Reset to foundation" onClick={handleResetToFoundation} tone="accent" />
            )}
            {selected.size > 0 && <ToolbarAction icon={Eraser} label="Clear all" onClick={handleClearAll} tone="muted" />}
          </div>
        )}
      </div>

      {/* 13x13 range matrix — column labels, row labels and cells all live in
          ONE css grid so every axis stays pixel-perfectly aligned, and every
          data cell shares the same `minmax(2rem, 1fr)` column track so cells
          are always identical width and (via aspect-square) identical height. */}
      <div>
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-cols-[1.75rem_repeat(13,minmax(2rem,1fr))] gap-[3px]">
            <div aria-hidden />
            {RANKS.map(r => (
              <div
                key={`col-${r}`}
                className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground/45"
              >
                {r}
              </div>
            ))}

            {HAND_GRID.map((row, rowIdx) => (
              <Fragment key={rowIdx}>
                <div className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground/45">
                  {RANKS[rowIdx]}
                </div>
                {row.map((hand, colIdx) => {
                  const isSelected = selected.has(hand)
                  const isPrefilled = isPrefilledCell(rangeState, foundationSet, hand)

                  return (
                    <button
                      key={colIdx}
                      type="button"
                      disabled={disabled || submitted}
                      onMouseDown={() => handleMouseDown(hand)}
                      onMouseEnter={() => handleMouseEnter(hand)}
                      onKeyDown={e => handleCellKeyDown(e, hand)}
                      title={isPrefilled ? `${hand} — prefilled foundation, click to remove` : hand}
                      className={cn(
                        'relative flex aspect-square items-center justify-center rounded-[5px] border',
                        'text-[10px] sm:text-[11px] font-semibold leading-none select-none',
                        'cursor-pointer transition-colors duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                        'disabled:cursor-default disabled:pointer-events-none disabled:opacity-70',
                        isPrefilled
                          ? 'bg-violet-500/20 border-violet-400/30 text-violet-100 hover:bg-violet-500/28'
                          : isSelected
                          ? 'bg-blue-500 border-blue-400/40 text-white font-bold hover:bg-blue-400'
                          : 'bg-secondary/30 border-border/15 text-muted-foreground/60 hover:bg-secondary/50 hover:border-border/30 hover:text-foreground/80'
                      )}
                    >
                      {hand}
                      {isPrefilled && (
                        <span aria-hidden className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-violet-200/80" />
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/35 sm:hidden">Scroll to see all hands →</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/50">
        {foundation.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-violet-400/30 bg-violet-500/20" />
            Foundation
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-blue-500" />
          Your selection
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-border/15 bg-secondary/30" />
          Not selected
        </div>
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
