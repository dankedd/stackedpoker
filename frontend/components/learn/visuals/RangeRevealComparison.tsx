'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PokerRangeGrid } from './PokerRangeGrid'

export interface RangeRevealCriterion {
  label: string
  met: boolean
}

interface RangeRevealComparisonProps {
  /** Optional heading for this panel, e.g. "Range A — Linear". */
  title?: string
  yourRange: string[]
  targetRange: string[]
  /** Defaults to 'Target range'. Use 'Reference construction' when the exercise is illustrative
   *  (shape practice) rather than a real solver-accurate chart. */
  targetLabel?: string
  /** True when the underlying rule accepts more than one valid construction — renders a note so
   *  the target grid is never read as "the only correct range." */
  multipleValid?: boolean
  /** Structural pass/fail checklist, shown when the grading rule is criteria-based rather than
   *  an exact-match target (e.g. polarized shape checks). */
  criteria?: RangeRevealCriterion[]
  /** Prose explaining the range-shape pattern — reuse the evaluator's own feedback text so this
   *  never becomes a second, hand-written explanation that can drift from the actual grading. */
  patternExplanation?: string
  className?: string
}

/**
 * Reusable post-submit reveal for any range-construction exercise: shows the learner's own
 * range and the target/reference range side by side, then a single highlighted diff grid
 * (correct / missing / extra), a compact hand-count summary, and an optional structural
 * checklist + explanation. Used by RangeBuild and MorphologyBuilder (build mode) so later
 * range-construction steps get the same treatment automatically.
 */
export function RangeRevealComparison({
  title,
  yourRange,
  targetRange,
  targetLabel = 'Target range',
  multipleValid = false,
  criteria,
  patternExplanation,
  className,
}: RangeRevealComparisonProps) {
  const targetSet = new Set(targetRange)
  const yourSet = new Set(yourRange)
  const correctCount = targetRange.filter((h) => yourSet.has(h)).length
  const missingCount = targetRange.filter((h) => !yourSet.has(h)).length
  const extraCount = yourRange.filter((h) => !targetSet.has(h)).length

  return (
    <div className={cn('space-y-3', className)}>
      {title && <p className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground/60">{title}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">Your Range</p>
          <PokerRangeGrid range={yourRange} />
        </div>
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">{targetLabel}</p>
          <PokerRangeGrid range={targetRange} />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-center text-[11px] font-semibold text-foreground/80">Differences</p>
        <PokerRangeGrid range={targetRange} mode="diff" comparisonRange={yourRange} />
      </div>

      <div className="flex items-center justify-center gap-4 text-xs font-semibold">
        <span className="text-emerald-400">Correct: {correctCount}</span>
        <span className="text-amber-400">Missing: {missingCount}</span>
        <span className="text-red-400">Extra: {extraCount}</span>
      </div>

      {multipleValid && (
        <p className="text-center text-[11px] text-muted-foreground/50 italic">
          Other constructions can also be valid — the grid above shows one reference shape, not the only correct range.
        </p>
      )}

      {criteria && criteria.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              {c.met ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-400" />
              )}
              <span className={cn('text-xs', c.met ? 'text-foreground/80' : 'text-muted-foreground/70')}>{c.label}</span>
            </div>
          ))}
        </div>
      )}

      {patternExplanation && (
        <p className="text-sm text-muted-foreground leading-relaxed px-1">{patternExplanation}</p>
      )}
    </div>
  )
}
