'use client'

import type { DecisionSpotRangeReveal } from '@/lib/learn/types'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'

interface RangeRevealCardProps {
  reveal: DecisionSpotRangeReveal
}

/** Post-answer full-range reveal for DEFEND decision_spot steps — same didactic beat as
 *  `table_decision`'s inline reveal (question -> answer -> feedback -> full range with the
 *  asked hand highlighted), just surfaced inside `StepFeedback` instead of the step's own
 *  component, since `decision_spot` (unlike `table_decision`) has no internal answered/reveal
 *  stage of its own. Renders nothing before the caller has a `reveal` to pass — StepFeedback
 *  only mounts this once `result` (i.e. the graded answer) already exists, so there is no path
 *  that shows this before the learner has answered. */
export function RangeRevealCard({ reveal }: RangeRevealCardProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
          {reveal.label}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">{reveal.subtitle}</p>
      </div>
      <PokerRangeGrid
        range={reveal.range}
        mode="strategy"
        strategies={reveal.strategies}
        strategySemantics={reveal.strategySemantics}
        highlightHand={reveal.highlightHand}
        size="standard"
      />
      {reveal.strategySemantics.kind === 'action_slice' && (
        <p className="text-center text-[9px] text-muted-foreground/30">
          &quot;Other action&quot; = this hand&apos;s remaining frequency isn&apos;t split out in this
          calling-range-only chart — it is not necessarily a fold.
        </p>
      )}
    </div>
  )
}
