'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { MTT_RFI_CHARTS, type MttStackBB } from '@/lib/learn/mttRfiBaselines'
import { chartToDisplayActionMap, computeChartDiff } from '@/lib/learn/mttRfiRanges'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { orderStepOptions } from '@/lib/learn/interactionSafety'

interface MttStackDepthCompareProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

const STOPS: MttStackBB[] = [15, 25, 40, 60]

/**
 * 4-stop (15/25/40/60bb) comparison of one position's canonical MTT charts, extending
 * StackDepthRangeMorph.tsx's established slider-with-labeled-stops convention (this
 * codebase's house pattern for multi-state comparison) rather than introducing tabs/swipe.
 * A diff toggle switches from the plain per-depth view to a Difference View against the
 * reference depth (defaults to 60bb, the module's canonical "build" depth).
 */
export function MttStackDepthCompare({ step, onAnswer, disabled = false }: MttStackDepthCompareProps) {
  const mountTime = useRef(Date.now())
  const referenceBB = step.mtt_stack_depth_compare_reference_bb ?? 60
  const defaultIndex = Math.max(STOPS.indexOf(referenceBB), 0)
  const [stopIndex, setStopIndex] = useState(defaultIndex)
  const [showDiff, setShowDiff] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setStopIndex(defaultIndex)
    setShowDiff(false)
    setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const positionKey = step.mtt_stack_depth_compare_position ?? 'UTG'
  const stackBB = STOPS[stopIndex]
  const chartKey = `${positionKey}_RFI_${stackBB}BB`
  const referenceChartKey = `${positionKey}_RFI_${referenceBB}BB`
  const chart = MTT_RFI_CHARTS[chartKey]
  const referenceChart = MTT_RFI_CHARTS[referenceChartKey]

  const rawOptions = step.options ?? []
  const options = useMemo(() => orderStepOptions(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  function handleContinue() {
    handleSelect('__continue__')
  }

  if (!chart || !referenceChart) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Missing stack-depth comparison data.</p>
  }

  const canDiff = stackBB !== referenceBB
  const diffEntries = canDiff ? computeChartDiff(referenceChart, chart) : []

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
              {chart.position} opening strategy
            </p>
            <p className="text-lg font-black text-violet-300">{stackBB}bb effective</p>
          </div>
          {canDiff && (
            <button
              type="button"
              onClick={() => setShowDiff((v) => !v)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                showDiff
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-border/30 bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/50',
              )}
            >
              {showDiff ? `vs. ${referenceBB}bb: showing changes` : `Compare vs. ${referenceBB}bb`}
            </button>
          )}
        </div>

        {showDiff && canDiff ? (
          <PokerRangeGrid
            range={chart.cells.map((c) => c.hand)}
            mode="action_diff"
            actionDiff={diffEntries}
          />
        ) : (
          <PokerRangeGrid
            range={chart.cells.map((c) => c.hand)}
            mode="three_action"
            actionMap={chartToDisplayActionMap(chart)}
          />
        )}

        <div className="space-y-1.5 pt-2 border-t border-border/20">
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={stopIndex}
            disabled={disabled || selected !== null}
            onChange={(e) => setStopIndex(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || selected !== null) && 'opacity-50')}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
            {STOPS.map((bb) => (
              <span key={bb}>{bb}bb</span>
            ))}
          </div>
        </div>
      </div>

      {step.mtt_stack_depth_compare_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.mtt_stack_depth_compare_prompt}</p>
        </div>
      )}

      {options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                    : [
                        'border-border/50 bg-secondary/40 text-foreground',
                        'hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                      ].join(' ')
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || selected !== null}
          onClick={handleContinue}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            selected !== null || disabled
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          Continue
        </button>
      )}
    </div>
  )
}
