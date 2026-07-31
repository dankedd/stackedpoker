'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Lightbulb, RotateCcw, Eraser, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { RANKS, HAND_GRID, comboCount, TOTAL_COMBOS } from '@/lib/learn/handGrid'
import { actionStyle, actionLabel } from '@/lib/learn/actionStyles'
import { MultiActionRangeReveal } from '@/components/learn/visuals/MultiActionRangeReveal'
import { ScenarioMeta } from '@/components/poker/ScenarioMeta'
import {
  DEFAULT_MULTI_PREFILL_NOTE,
  resolveMultiActionTargetChart,
  resolveMultiPrefilledAssignments,
  createInitialMultiSelection,
  paintMultiActionHand,
  clearMultiActionHand,
  clearMultiActionSelection,
  resetMultiActionToFoundation,
  isPrefilledMultiCell,
  type MultiActionSelectionState,
  type MultiRangeAction,
} from '@/lib/learn/multiActionRangePrefill'

/** Aggression-first display order, mirroring PokerRangeGrid's own ACTION_PRIORITY
 *  so this paint toolbar always agrees with the reveal grid's segment/legend order. */
const ACTION_PRIORITY = ['4bet', '3bet', 'squeeze', 'raise', 'jam', 'shove', 'limp', 'call', 'fold']

/** Which actions a chart's own cells actually use, always including 'fold' so the
 *  learner can explicitly mark a hand as a fold even in a no-prefill reconstruction. */
function chartActionsUsed(chart: ReturnType<typeof resolveMultiActionTargetChart>): MultiRangeAction[] {
  const seen = new Set<string>(['fold'])
  for (const cell of chart?.cells ?? []) {
    for (const action of Object.keys(cell.actions)) seen.add(action)
  }
  const prioritized = ACTION_PRIORITY.filter((a) => seen.has(a))
  const rest = [...seen].filter((a) => !ACTION_PRIORITY.includes(a))
  return [...prioritized, ...rest] as MultiRangeAction[]
}

function splitLeadSentence(text: string): [string, string] {
  const match = text.match(/^(.*?[.!?])\s+([\s\S]*)$/)
  if (!match) return [text, '']
  return [match[1], match[2]]
}

function RangeStat({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn('text-base font-bold leading-none tabular-nums', accent ? 'text-violet-300' : 'text-foreground')}>
        {value}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide leading-none text-muted-foreground/45">
        {label}
      </span>
    </div>
  )
}

function ToolbarAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground/60 transition-colors duration-150 hover:bg-secondary/60 hover:text-muted-foreground"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

interface MultiActionRangeBuildProps {
  step: LessonStep
  onAnswer: (assignments: Record<string, MultiRangeAction>, timeMs: number) => void
  disabled?: boolean
}

export function MultiActionRangeBuild({ step, onAnswer, disabled = false }: MultiActionRangeBuildProps) {
  const mountTime = useRef(Date.now())
  const chart = useMemo(() => resolveMultiActionTargetChart(step), [step])
  const offeredActions = useMemo(
    () => (step.range_build_multi_actions as MultiRangeAction[] | undefined) ?? chartActionsUsed(chart),
    [step, chart],
  )
  const prefilled = useMemo(() => resolveMultiPrefilledAssignments(step), [step])

  const [state, setState] = useState<MultiActionSelectionState>(() => createInitialMultiSelection(prefilled))
  const [activeAction, setActiveAction] = useState<MultiRangeAction>(offeredActions[0] ?? 'fold')
  const [submitted, setSubmitted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragAction, setDragAction] = useState<MultiRangeAction | null>(null)
  const [reviewingDiff, setReviewingDiff] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setState(createInitialMultiSelection(prefilled))
    setActiveAction(offeredActions[0] ?? 'fold')
    setSubmitted(false)
    setReviewingDiff(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const paintHand = useCallback(
    (hand: string, action: MultiRangeAction | null) => {
      if (disabled || submitted) return
      setState((prev) => (action === null ? clearMultiActionHand(prev, hand) : paintMultiActionHand(prev, hand, action)))
    },
    [disabled, submitted],
  )

  function handleMouseDown(hand: string) {
    if (disabled || submitted) return
    const alreadyActive = state.assignments[hand] === activeAction
    const nextAction = alreadyActive ? null : activeAction
    setDragAction(nextAction)
    setIsDragging(true)
    paintHand(hand, nextAction)
  }

  function handleMouseEnter(hand: string) {
    if (!isDragging || disabled || submitted) return
    paintHand(hand, dragAction)
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, hand: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const alreadyActive = state.assignments[hand] === activeAction
      paintHand(hand, alreadyActive ? null : activeAction)
    }
  }

  const finalAssignments = state.assignments

  function handleSubmit() {
    if (disabled || submitted) return
    const elapsed = Date.now() - mountTime.current
    if (step.range_build_multi_show_diff && !reviewingDiff) {
      setReviewingDiff(true)
      return
    }
    setSubmitted(true)
    onAnswer(finalAssignments, elapsed)
  }

  function handleContinueFromDiff() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(finalAssignments, Date.now() - mountTime.current)
  }

  if (reviewingDiff && chart) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Here&apos;s how your strategy compares to the baseline.
          </p>
        </div>
        <MultiActionRangeReveal
          yourAssignments={finalAssignments}
          chart={chart}
          puzzleHands={step.range_build_multi_puzzle_hands}
        />
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
    setState(clearMultiActionSelection())
  }

  function handleResetToFoundation() {
    if (disabled || submitted) return
    setState(resetMultiActionToFoundation(prefilled))
  }

  const assignedCount = Object.keys(finalAssignments).length
  const assignedCombos = Object.keys(finalAssignments).reduce((sum, h) => sum + comboCount(h), 0)
  const pctOfRange = ((assignedCombos / TOTAL_COMBOS) * 100).toFixed(1)
  const [noteLead, noteRest] = splitLeadSentence(step.range_build_multi_prefilled_note ?? DEFAULT_MULTI_PREFILL_NOTE)
  const hasPrefill = Object.keys(prefilled).length > 0
  const showControls = !submitted && !disabled && (hasPrefill || assignedCount > 0)
  const canSubmit = state.touched.size > 0 || hasPrefill

  return (
    <div
      className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="space-y-2.5">
        <ScenarioMeta heroPosition={step.hero_position} effectiveStackBb={step.effective_stack_bb} />

        {step.narrative && <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>}

        {hasPrefill && (
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

      {/* Action toolbar — pick the active paint action, then click/drag cells */}
      <div className="flex flex-wrap items-center gap-2">
        {offeredActions.map((action) => {
          const style = actionStyle(action)
          return (
            <button
              key={action}
              type="button"
              disabled={disabled || submitted}
              onClick={() => setActiveAction(action)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 border-transparent',
                activeAction === action
                  ? cn(style.bg, style.text, 'ring-2 ring-offset-1 ring-offset-background ring-white/40')
                  : 'border-border/20 bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50',
              )}
            >
              {actionLabel(action)}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border/15 bg-secondary/15 px-4 py-3">
        <div className="flex items-center gap-5">
          <RangeStat value={assignedCount} label="Hands" />
          <RangeStat value={assignedCombos} label="Combos" accent />
          <RangeStat value={`${pctOfRange}%`} label="Range width" />
        </div>

        {showControls && (
          <div className="flex items-center gap-1.5 sm:ml-auto">
            {hasPrefill && <ToolbarAction icon={RotateCcw} label="Reset to foundation" onClick={handleResetToFoundation} />}
            {assignedCount > 0 && <ToolbarAction icon={Eraser} label="Clear all" onClick={handleClearAll} />}
          </div>
        )}
      </div>

      <div>
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-cols-[1.75rem_repeat(13,minmax(2rem,1fr))] gap-[3px]">
            <div aria-hidden />
            {RANKS.map((r) => (
              <div key={`col-${r}`} className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground/45">
                {r}
              </div>
            ))}

            {HAND_GRID.map((row, rowIdx) => (
              <Fragment key={rowIdx}>
                <div className="flex items-center justify-center text-[10px] font-semibold text-muted-foreground/45">
                  {RANKS[rowIdx]}
                </div>
                {row.map((hand, colIdx) => {
                  const assigned = state.assignments[hand]
                  const isPrefilled = isPrefilledMultiCell(state, prefilled, hand)
                  const style = assigned ? actionStyle(assigned) : null

                  return (
                    <button
                      key={colIdx}
                      type="button"
                      disabled={disabled || submitted}
                      onMouseDown={() => handleMouseDown(hand)}
                      onMouseEnter={() => handleMouseEnter(hand)}
                      onKeyDown={(e) => handleCellKeyDown(e, hand)}
                      title={
                        isPrefilled
                          ? `${hand} — prefilled foundation (${actionLabel(assigned!)}), click to change`
                          : assigned
                          ? `${hand} — ${actionLabel(assigned)}`
                          : hand
                      }
                      className={cn(
                        'relative flex aspect-square items-center justify-center rounded-[5px] border',
                        'text-[10px] sm:text-[11px] font-semibold leading-none select-none',
                        'cursor-pointer transition-colors duration-150 hover:brightness-110',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                        'disabled:cursor-default disabled:pointer-events-none disabled:opacity-70',
                        isPrefilled
                          ? 'bg-violet-500/20 border-violet-400/30 text-violet-100 hover:bg-violet-500/28'
                          : style
                          ? cn(style.bg, style.text, 'border-transparent font-bold')
                          : 'bg-secondary/30 border-border/15 text-muted-foreground/60 hover:bg-secondary/50 hover:border-border/30 hover:text-foreground/80',
                      )}
                    >
                      {hand}
                      {isPrefilled && <span aria-hidden className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-violet-200/80" />}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/35 sm:hidden">Scroll to see all hands →</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/50">
        {hasPrefill && (
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-violet-400/30 bg-violet-500/20" />
            Foundation
          </div>
        )}
        {offeredActions.map((action) => (
          <div key={action} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-[3px]', actionStyle(action).swatch)} />
            {actionLabel(action)}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || submitted || !canSubmit}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2',
          'rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled || !canSubmit
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {!submitted && !disabled && canSubmit && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
        {submitted ? 'Submitted' : !canSubmit ? 'Assign at least one hand' : `Submit strategy (${assignedCombos} combos)`}
      </button>
    </div>
  )
}
