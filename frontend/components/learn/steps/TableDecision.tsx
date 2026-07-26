'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { QUALITY_LABELS, QUALITY_COLORS } from '@/lib/learn/types'
import { DecisionSpot } from './DecisionSpot'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { MTT_RFI_CHARTS } from '@/lib/learn/mttRfiBaselines'
import { buildHandDecisionOptions } from '@/lib/learn/mttRfiLabPool'
import { evaluateTableDecision, type TableDecisionEvaluation } from '@/lib/learn/tableDecisionEngine'
import { chartToStrategyMap } from '@/lib/learn/mttRfiRanges'
import { canonicalCombo } from '@/lib/learn/combos'

interface TableDecisionProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

function QualityIcon({ quality }: { quality: TableDecisionEvaluation['quality'] }) {
  if (quality === 'perfect' || quality === 'good') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      </div>
    )
  }
  if (quality === 'acceptable') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
      </div>
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
      <XCircle className="h-5 w-5 text-red-400" />
    </div>
  )
}

interface InlineRevealProps {
  evaluation: TableDecisionEvaluation
  chartKey: string
  hand: string
  onContinue: () => void
}

function InlineReveal({ evaluation, chartKey, hand, onContinue }: InlineRevealProps) {
  const chart = MTT_RFI_CHARTS[chartKey]
  const strategies = chartToStrategyMap(chart)
  const confusion = evaluation.stackConfusion

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3.5',
          evaluation.quality === 'perfect' || evaluation.quality === 'good'
            ? 'border-emerald-500/30 bg-emerald-500/8'
            : evaluation.quality === 'acceptable'
            ? 'border-amber-500/30 bg-amber-500/8'
            : 'border-red-500/30 bg-red-500/8',
        )}
      >
        <QualityIcon quality={evaluation.quality} />
        <div className="space-y-1">
          <p className={cn('text-sm font-bold', QUALITY_COLORS[evaluation.quality])}>
            {QUALITY_LABELS[evaluation.quality]}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{evaluation.feedback}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-center text-[11px] font-semibold text-foreground/80">
          {chart.position} — {chart.stackBB}bb
        </p>
        <PokerRangeGrid
          range={chart.cells.map((c) => c.hand)}
          mode="strategy"
          strategies={strategies}
          highlightHand={hand}
        />
      </div>

      {confusion && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-3.5 space-y-2">
          <p className="text-sm font-bold text-sky-300">Right idea — wrong stack depth</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {evaluation.chosenAction} is the baseline strategy&apos;s own choice for {hand} at {confusion.stackBB}bb
            ({Math.round(confusion.frequency * 100)}%) — just not at {chart.stackBB}bb.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-center text-[10px] font-semibold text-muted-foreground/60">{chart.stackBB}bb (this spot)</p>
              <PokerRangeGrid
                range={chart.cells.map((c) => c.hand)}
                mode="strategy"
                strategies={strategies}
                highlightHand={hand}
              />
            </div>
            <div className="space-y-1">
              <p className="text-center text-[10px] font-semibold text-muted-foreground/60">{confusion.stackBB}bb</p>
              <PokerRangeGrid
                range={MTT_RFI_CHARTS[confusion.chartKey].cells.map((c) => c.hand)}
                mode="strategy"
                strategies={chartToStrategyMap(MTT_RFI_CHARTS[confusion.chartKey])}
                highlightHand={hand}
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden bg-gradient-to-r from-violet-600 to-blue-500"
      >
        Continue
      </button>
    </div>
  )
}

/**
 * Visual poker-table decision drill: PreflopTable shows the exact spot, the learner picks an
 * action (via the existing DecisionSpot button UI, composed not forked), then an inline reveal
 * shows correct/incorrect, the canonical range grid for that exact chart with only the tested
 * hand ring-highlighted (never recolored), and a stack-confusion cross-reference when the
 * learner's wrong answer is actually correct at a different depth.
 */
export function TableDecision({ step, onAnswer, disabled = false }: TableDecisionProps) {
  const mountTime = useRef(Date.now())
  const [answered, setAnswered] = useState<{ optionId: string; ms: number } | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setAnswered(null)
  }, [step.id])

  const chartKey = step.table_decision_chart ?? ''
  const chart = MTT_RFI_CHARTS[chartKey]
  const hand = step.table_decision_hand ?? ''

  if (!chart || !hand) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Missing table decision data.</p>
  }

  const options = buildHandDecisionOptions(chart, hand, step.id)
  const heroCards = canonicalCombo(hand)

  function handleInnerAnswer(optionId: string, ms: number) {
    if (disabled || answered) return
    setAnswered({ optionId, ms })
  }

  function handleContinue() {
    if (!answered) return
    onAnswer(answered.optionId, answered.ms)
  }

  const evaluation = answered ? evaluateTableDecision(chartKey, hand, answered.optionId) : undefined

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <p className="text-sm text-muted-foreground leading-relaxed text-center">{step.narrative}</p>
      )}

      <PreflopTable
        tableSize={step.table_size ?? 9}
        heroPosition={step.hero_position ?? chart.position}
        heroHand={heroCards}
        effectiveStackBb={step.effective_stack_bb ?? chart.stackBB}
        anteBb={step.ante_bb}
        actionBeforeHero={step.action_before_hero}
        heroAction={answered && evaluation ? { label: evaluation.chosenAction.toUpperCase() } : undefined}
        result={evaluation ? (evaluation.quality === 'perfect' || evaluation.quality === 'good' ? 'correct' : 'incorrect') : undefined}
      />

      {!answered ? (
        <DecisionSpot
          // hero_position is intentionally cleared here — TableDecision already
          // renders the shared table above; the nested DecisionSpot only supplies
          // the action buttons, never a second copy of the table.
          step={{ ...step, narrative: undefined, hero_position: undefined, options }}
          onAnswer={handleInnerAnswer}
          disabled={disabled}
        />
      ) : evaluation ? (
        <InlineReveal evaluation={evaluation} chartKey={chartKey} hand={hand} onContinue={handleContinue} />
      ) : null}
    </div>
  )
}
