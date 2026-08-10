'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { QUALITY_LABELS, QUALITY_COLORS } from '@/lib/learn/types'
import { DecisionSpot } from './DecisionSpot'
import { PreflopTable } from '@/components/learn/visuals/PreflopTable'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { RangeComparisonLayout } from '@/components/learn/visuals/RangeComparisonLayout'
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
  // The two-grid comparison is supporting evidence for the one-sentence explanation right
  // above it, not the step's own learning objective (that's the decision itself) — so it
  // starts collapsed and the learner opts in, per the shared progressive-disclosure pattern.
  const [comparisonOpen, setComparisonOpen] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Prose/controls stay at a normal reading width even when the outer lesson
       *  container is widened for this step type — only the visualization below should
       *  use the extra room. */}
      <div className="max-w-2xl mx-auto w-full space-y-4">
        {/* Same mobile/desktop grid as StepFeedback's result card (see that
            comment for why the breakpoint is 480px): the quality label sits
            beside the icon, and the explanation drops to its own full-width row
            on phones instead of wrapping in the narrow column left over beside
            a 40px circle. Unchanged above 480px. */}
        <div
          className={cn(
            'grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2.5 rounded-xl border px-4 py-3.5 min-[480px]:gap-y-1',
            evaluation.quality === 'perfect' || evaluation.quality === 'good'
              ? 'border-emerald-500/30 bg-emerald-500/8'
              : evaluation.quality === 'acceptable'
              ? 'border-amber-500/30 bg-amber-500/8'
              : 'border-red-500/30 bg-red-500/8',
          )}
        >
          <div className="col-start-1 row-start-1 min-[480px]:row-span-2">
            <QualityIcon quality={evaluation.quality} />
          </div>
          <p
            className={cn(
              'col-start-2 row-start-1 min-w-0 self-center text-sm font-bold min-[480px]:self-start',
              QUALITY_COLORS[evaluation.quality],
            )}
          >
            {QUALITY_LABELS[evaluation.quality]}
          </p>
          <p className="row-start-2 col-start-1 col-span-2 min-w-0 text-sm text-muted-foreground leading-relaxed min-[480px]:col-start-2 min-[480px]:col-span-1">
            {evaluation.feedback}
          </p>
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
      </div>

      {confusion && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-3.5 space-y-2">
          <p className="text-sm font-bold text-sky-300">Right idea — wrong stack depth</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {evaluation.chosenAction} is the baseline strategy&apos;s own choice for {hand} at {confusion.stackBB}bb
            ({Math.round(confusion.frequency * 100)}%) — just not at {chart.stackBB}bb.
          </p>
          <button
            type="button"
            onClick={() => setComparisonOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 -mx-2 text-xs font-semibold text-sky-300 hover:text-sky-200 hover:bg-sky-500/10 transition-colors"
          >
            {comparisonOpen ? 'Hide ranges' : 'Compare ranges'}
            {comparisonOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {comparisonOpen && (
            // Two complete 13x13 grids need more room than the sm: breakpoint gives them
            // within this card's width — sideBySideFrom="lg" stacks them full-width until
            // there's real room, instead of shrinking both to illegibility side by side.
            // Deliberately NOT inside the max-w-2xl prose wrapper above — these two
            // size="compact" grids need the wide outer container's room to reach their
            // own 480px cap side by side.
            <RangeComparisonLayout gapClassName="gap-3" sideBySideFrom="lg" className="animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <p className="text-center text-[10px] font-semibold text-muted-foreground/60">{chart.stackBB}bb (this spot)</p>
                <PokerRangeGrid
                  range={chart.cells.map((c) => c.hand)}
                  mode="strategy"
                  strategies={strategies}
                  highlightHand={hand}
                  size="compact"
                />
              </div>
              <div className="space-y-1">
                <p className="text-center text-[10px] font-semibold text-muted-foreground/60">{confusion.stackBB}bb</p>
                <PokerRangeGrid
                  range={MTT_RFI_CHARTS[confusion.chartKey].cells.map((c) => c.hand)}
                  mode="strategy"
                  strategies={chartToStrategyMap(MTT_RFI_CHARTS[confusion.chartKey])}
                  highlightHand={hand}
                  size="compact"
                />
              </div>
            </RangeComparisonLayout>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto w-full">
        <button
          type="button"
          onClick={onContinue}
          className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden bg-gradient-to-r from-violet-600 to-blue-500"
        >
          Continue
        </button>
      </div>
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
      {/* Narrative/table/decision buttons stay at a normal reading width even when this
       *  step type widens the outer lesson container — only InlineReveal's comparison
       *  visualization (below) needs the extra room. */}
      <div className="max-w-2xl mx-auto w-full space-y-5">
        {step.narrative && (
          <p className="text-sm text-muted-foreground leading-relaxed text-center">{step.narrative}</p>
        )}

        <PreflopTable
          tableSize={step.table_size ?? 9}
          heroPosition={step.hero_position ?? chart.position}
          heroHand={heroCards}
          effectiveStackBb={step.effective_stack_bb ?? chart.stackBB}
          stackOverridesBb={step.stack_overrides_bb}
          anteBb={step.ante_bb}
          actionBeforeHero={step.action_before_hero}
          heroAction={answered && evaluation ? { label: evaluation.chosenAction.toUpperCase() } : undefined}
          result={evaluation ? (evaluation.quality === 'perfect' || evaluation.quality === 'good' ? 'correct' : 'incorrect') : undefined}
        />

        {!answered && (
          <DecisionSpot
            // hero_position is intentionally cleared here — TableDecision already
            // renders the shared table above; the nested DecisionSpot only supplies
            // the action buttons, never a second copy of the table.
            step={{ ...step, narrative: undefined, hero_position: undefined, options }}
            onAnswer={handleInnerAnswer}
            disabled={disabled}
          />
        )}
      </div>

      {answered && evaluation && (
        <InlineReveal evaluation={evaluation} chartKey={chartKey} hand={hand} onContinue={handleContinue} />
      )}
    </div>
  )
}
