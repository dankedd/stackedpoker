'use client'

import { cn } from '@/lib/utils'
import { PokerRangeGrid } from './PokerRangeGrid'
import { RangeComparisonLayout } from './RangeComparisonLayout'
import type { MultiActionChartLike, MultiRangeAction } from '@/lib/learn/multiActionRangePrefill'
import { fromActionDict, fromPureAction, dominantFrequency, type RangeStrategyMap } from '@/lib/learn/rangeStrategy'
import { actionLabel } from '@/lib/learn/actionStyles'
import { comboCount } from '@/lib/learn/handGrid'

function formatPct(freq: number): string {
  return `${Math.round(freq * 100)}%`
}

/** A hand counts as "genuinely mixed" (not a clean pure decision) once no single
 *  action reaches this share of the book's own strategy for that hand. */
const MIXED_HAND_THRESHOLD = 0.9

interface MultiActionRangeRevealProps {
  yourAssignments: Record<string, MultiRangeAction>
  chart: MultiActionChartLike
  className?: string
}

/**
 * Post-submit secondary inspector for a range_build_multi step: a full grid diff
 * (learner vs. the book's full strategy), plus a separate tappable-free list of
 * ONLY the genuinely mixed hands (book max-frequency < 90%) with their exact
 * split — kept out of the live grid so mixed-strategy nuance doesn't compete with
 * the paint interaction during play. Domain-agnostic: works for any chart whose
 * cells are `{ hand, actions: Partial<Record<string, number>> }` — both the MTT
 * RFI charts and the 3-bet-response charts satisfy this shape.
 */
export function MultiActionRangeReveal({ yourAssignments, chart, className }: MultiActionRangeRevealProps) {
  // "Your Strategy" is the learner's simplified single-action-per-hand paint — the
  // input side stays simple by design. "Baseline Strategy" is the AUTHORITATIVE
  // reveal and must show the book's full mixed-frequency strategy, never collapsed
  // to one dominant action (see rangeStrategy.ts).
  const yourStrategies: RangeStrategyMap = Object.fromEntries(
    Object.entries(yourAssignments).map(([hand, action]) => [hand, fromPureAction(action)]),
  )
  const bookStrategies: RangeStrategyMap = Object.fromEntries(
    chart.cells.map((c) => [c.hand, fromActionDict(c.actions)]),
  )
  const yourRangeHands = Object.keys(yourAssignments)
  const bookRangeHands = chart.cells.map((c) => c.hand)

  const mixedCells = chart.cells
    .filter((c) => dominantFrequency(fromActionDict(c.actions)) < MIXED_HAND_THRESHOLD)
    .sort((a, b) => comboCount(b.hand) - comboCount(a.hand))

  return (
    <div className={cn('space-y-4', className)}>
      <RangeComparisonLayout gapClassName="gap-3">
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">Your Strategy</p>
          <PokerRangeGrid range={yourRangeHands} mode="strategy" strategies={yourStrategies} size="compact" />
        </div>
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">Baseline Strategy</p>
          <PokerRangeGrid range={bookRangeHands} mode="strategy" strategies={bookStrategies} size="compact" />
        </div>
      </RangeComparisonLayout>

      {mixedCells.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground/80">Mixed boundary hands</p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            These hands don&apos;t have one clean answer in the baseline strategy — the solver splits them between actions.
          </p>
          <div className="rounded-xl border border-border/30 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
            {mixedCells.map((cell) => {
              const yourAction = yourAssignments[cell.hand]
              const cellActions = cell.actions
              const yourCredit = yourAction ? cellActions[yourAction] ?? 0 : cellActions.fold ?? 0
              const splitText = (Object.entries(cellActions) as [MultiRangeAction, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([action, freq]) => `${actionLabel(action)} ${formatPct(freq)}`)
                .join(' / ')

              return (
                <div key={cell.hand} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span className="font-semibold text-foreground/90 tabular-nums">{cell.hand}</span>
                  <span className="flex-1 text-muted-foreground/70">{splitText}</span>
                  {yourAction && (
                    <span
                      className={cn(
                        'font-medium',
                        yourCredit >= 0.5 ? 'text-emerald-400' : 'text-amber-400',
                      )}
                    >
                      You: {actionLabel(yourAction)} ({formatPct(yourCredit)} credit)
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
