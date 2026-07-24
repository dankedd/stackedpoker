'use client'

import { cn } from '@/lib/utils'
import { PokerRangeGrid } from './PokerRangeGrid'
import type { MttAction, MttRfiChart } from '@/lib/learn/mttRfiBaselines'
import { chartToDisplayActionMap, mttActionToDisplayAction, isMixedHand } from '@/lib/learn/mttRfiRanges'
import { comboCount } from '@/lib/learn/handGrid'

const ACTION_LABEL: Record<MttAction, string> = { raise: 'Raise', jam: 'Jam', limp: 'Limp', fold: 'Fold' }

function formatPct(freq: number): string {
  return `${Math.round(freq * 100)}%`
}

interface MultiActionRangeRevealProps {
  yourAssignments: Record<string, MttAction>
  chart: MttRfiChart
  className?: string
}

/**
 * Post-submit secondary inspector for a range_build_multi step: a full grid diff
 * (learner vs. the book's dominant action per hand), plus a separate tappable-free
 * list of ONLY the genuinely mixed hands (book max-frequency < 90%) with their exact
 * split — kept out of the live grid so mixed-strategy nuance doesn't compete with the
 * paint interaction during play.
 */
export function MultiActionRangeReveal({ yourAssignments, chart, className }: MultiActionRangeRevealProps) {
  const bookActionMap = chartToDisplayActionMap(chart)
  const yourActionMap = Object.fromEntries(
    Object.entries(yourAssignments).map(([hand, action]) => [hand, mttActionToDisplayAction(action)]),
  )
  const yourRangeHands = Object.keys(yourAssignments)
  const bookRangeHands = chart.cells.map((c) => c.hand)

  const mixedCells = chart.cells.filter((c) => isMixedHand(c.actions)).sort((a, b) => comboCount(b.hand) - comboCount(a.hand))

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">Your Strategy</p>
          <PokerRangeGrid range={yourRangeHands} mode="three_action" actionMap={yourActionMap} />
        </div>
        <div className="space-y-1.5">
          <p className="text-center text-[11px] font-semibold text-foreground/80">Baseline Strategy</p>
          <PokerRangeGrid range={bookRangeHands} mode="three_action" actionMap={bookActionMap} />
        </div>
      </div>

      {mixedCells.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground/80">Mixed boundary hands</p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            These hands don&apos;t have one clean answer in the baseline strategy — the solver splits them between actions.
          </p>
          <div className="rounded-xl border border-border/30 bg-secondary/20 divide-y divide-border/20 overflow-hidden">
            {mixedCells.map((cell) => {
              const yourAction = yourAssignments[cell.hand]
              const yourCredit = yourAction ? cell.actions[yourAction] ?? 0 : cell.actions.fold ?? 0
              const splitText = (Object.entries(cell.actions) as [MttAction, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([action, freq]) => `${ACTION_LABEL[action]} ${formatPct(freq)}`)
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
                      You: {ACTION_LABEL[yourAction]} ({formatPct(yourCredit)} credit)
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
