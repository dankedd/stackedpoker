'use client'

import { useState } from 'react'
import { Lightbulb, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PokerRangeGrid } from './PokerRangeGrid'
import { RangeComparisonLayout } from './RangeComparisonLayout'
import type { MultiActionChartLike, MultiRangeAction } from '@/lib/learn/multiActionRangePrefill'
import { fromActionDict, fromPureAction, dominantFrequency, type RangeStrategyMap } from '@/lib/learn/rangeStrategy'
import { actionLabel, actionStyle } from '@/lib/learn/actionStyles'
import { comboCount } from '@/lib/learn/handGrid'
import type { LessonStep } from '@/lib/learn/types'

function formatPct(freq: number): string {
  return `${Math.round(freq * 100)}%`
}

/** A hand counts as "genuinely mixed" (not a clean pure decision) once no single
 *  action reaches this share of the book's own strategy for that hand. */
const MIXED_HAND_THRESHOLD = 0.9

type PuzzleNote = NonNullable<LessonStep['range_build_multi_puzzle_notes']>[number]

interface MultiActionRangeRevealProps {
  yourAssignments: Record<string, MultiRangeAction>
  chart: MultiActionChartLike
  className?: string
  /** Hand classes the learner already saw in this lesson's Predict/decision_spot puzzles —
   *  rung on the Baseline Strategy grid so the student can connect each puzzle hand back to
   *  where it sits inside the full range, without touching that hand's color. */
  puzzleHands?: string[]
  /** Per-`puzzleHands` explanation copy (see LessonStep.range_build_multi_puzzle_notes) — what
   *  turns an unexplained ring into a tappable "why does this hand belong here" panel. A
   *  puzzle hand with no matching note here still gets ringed but isn't tappable — never a
   *  broken/empty panel. */
  puzzleNotes?: PuzzleNote[]
}

/**
 * Post-submit secondary inspector for a range_build_multi step: a full grid diff
 * (learner vs. the book's full strategy), a tappable "key hands from this lesson"
 * list explaining every ringed puzzle hand (see puzzleNotes below — built after
 * learners reported the rings appearing with no explanation of what they meant),
 * plus a separate list of ONLY the genuinely mixed hands (book max-frequency <
 * 90%) with their exact split — kept out of the live grid so mixed-strategy
 * nuance doesn't compete with the paint interaction during play. Domain-agnostic:
 * works for any chart whose cells are `{ hand, actions: Partial<Record<string,
 * number>> }` — both the MTT RFI charts and the 3-bet-response charts satisfy
 * this shape.
 */
export function MultiActionRangeReveal({ yourAssignments, chart, className, puzzleHands, puzzleNotes }: MultiActionRangeRevealProps) {
  const [expandedHand, setExpandedHand] = useState<string | null>(null)
  const notesByHand = new Map((puzzleNotes ?? []).map((n) => [n.hand, n]))
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
          <PokerRangeGrid
            range={bookRangeHands}
            mode="strategy"
            strategies={bookStrategies}
            size="compact"
            highlightHand={puzzleHands}
          />
        </div>
      </RangeComparisonLayout>

      {puzzleHands && puzzleHands.length > 0 && (
        <div className="space-y-2.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.05] p-3.5">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-violet-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground/95">Key hands from this lesson</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60 leading-relaxed">
                {notesByHand.size > 0
                  ? "The ringed cells above are the hands you worked through earlier in this lesson. Tap one to see where it lands inside the complete strategy and why."
                  : "The ringed cells above are the hands you worked through earlier in this lesson — compare where they sit inside the complete strategy."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {puzzleHands.map((hand) => {
              const note = notesByHand.get(hand)
              const isOpen = expandedHand === hand
              const style = actionStyle(note?.action ?? 'fold')

              return (
                <div key={hand} className="overflow-hidden rounded-lg border border-border/20 bg-secondary/15">
                  <button
                    type="button"
                    disabled={!note}
                    onClick={() => setExpandedHand(isOpen ? null : hand)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left',
                      note ? 'cursor-pointer hover:bg-secondary/25' : 'cursor-default',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-foreground/90">{hand}</span>
                      {note && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', style.bg, style.text)}>
                          {actionLabel(note.action)}
                        </span>
                      )}
                    </span>
                    {note && (
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200', isOpen && 'rotate-180')}
                        aria-hidden
                      />
                    )}
                  </button>

                  {isOpen && note && (
                    <div className="space-y-2 border-t border-border/20 px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/45">{note.concept}</p>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">{note.explanation}</p>
                      <div className="rounded-lg bg-violet-500/10 px-2.5 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
                          Rule to remember
                        </p>
                        <p className="mt-0.5 text-xs text-foreground/85 leading-relaxed">{note.rule}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
