'use client'

import type { DecisionSpotRangeReveal } from '@/lib/learn/types'
import type { RangeStrategyMap, RangeSemantics } from '@/lib/learn/rangeStrategy'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { actionLabel } from '@/lib/learn/actionStyles'

interface RangeRevealCardProps {
  reveal: DecisionSpotRangeReveal
}

interface RangeGridPanelProps {
  label: string
  subtitle?: string
  range: string[]
  strategies: RangeStrategyMap
  strategySemantics: RangeSemantics
  highlightHand: string
}

/** One labeled grid — the primary reveal and its optional `secondaryRange` both
 *  render through this so the two panels are visually identical, never a
 *  bespoke second layout. */
function RangeGridPanel({ label, subtitle, range, strategies, strategySemantics, highlightHand }: RangeGridPanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>}
      </div>
      <PokerRangeGrid
        range={range}
        mode="strategy"
        strategies={strategies}
        strategySemantics={strategySemantics}
        highlightHand={highlightHand}
        size="standard"
      />
      {strategySemantics.kind === 'action_slice' && (
        <p className="text-center text-[9px] text-muted-foreground/30">
          &quot;Other action&quot; = this hand&apos;s remaining frequency isn&apos;t split out in this{' '}
          {actionLabel(strategySemantics.action).toLowerCase()}-only chart — it is not necessarily a fold.
        </p>
      )}
    </div>
  )
}

/** Post-answer full-range reveal for decision_spot steps — same didactic beat as
 *  `table_decision`'s inline reveal (question -> answer -> feedback -> full range with the
 *  asked hand highlighted), just surfaced inside `StepFeedback` instead of the step's own
 *  component, since `decision_spot` (unlike `table_decision`) has no internal answered/reveal
 *  stage of its own. Renders nothing before the caller has a `reveal` to pass — StepFeedback
 *  only mounts this once `result` (i.e. the graded answer) already exists, so there is no path
 *  that shows this before the learner has answered.
 *
 *  When `reveal.secondaryRange` is present (e.g. the opener's own opening range attached
 *  alongside Hero's defend/3-bet response — see `evaluator.ts`'s `attachOpenerPanel`), the two
 *  panels sit side-by-side on desktop and stack vertically on mobile (`sm:grid-cols-2`),
 *  sharing the same highlighted hand so the learner reads them as one comparison, not two
 *  unrelated charts. */
export function RangeRevealCard({ reveal }: RangeRevealCardProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <div className={reveal.secondaryRange ? 'grid grid-cols-1 gap-5 sm:grid-cols-2' : undefined}>
        <RangeGridPanel
          label={reveal.label}
          subtitle={reveal.subtitle}
          range={reveal.range}
          strategies={reveal.strategies}
          strategySemantics={reveal.strategySemantics}
          highlightHand={reveal.highlightHand}
        />
        {reveal.secondaryRange && (
          <RangeGridPanel
            label={reveal.secondaryRange.label}
            range={reveal.secondaryRange.range}
            strategies={reveal.secondaryRange.strategies}
            strategySemantics={reveal.secondaryRange.strategySemantics}
            highlightHand={reveal.highlightHand}
          />
        )}
      </div>
    </div>
  )
}
