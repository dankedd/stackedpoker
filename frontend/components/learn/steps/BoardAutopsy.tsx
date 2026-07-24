'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { classifyFlop, dimensionValue, type FlopDimensionKey } from '@/lib/learn/flopClassifier'
import { CorrectnessIcon, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeFlagReveal } from '@/lib/learn/revealHelpers'

interface BoardAutopsyProps {
  step: LessonStep
  onAnswer: (flaggedKeys: string[], timeMs: number) => void
  disabled?: boolean
  /** Forces the post-submit reveal phase without requiring a real submission — used by tests. */
  reviewMode?: boolean
}

const DIMENSION_LABEL: Record<FlopDimensionKey, string> = {
  structure: 'Structure',
  texture: 'Texture',
  two_tone_subtype: 'Two-Tone Subtype',
  highest_rank_family: 'Highest Rank Family',
  straight_count: 'Possible Straights',
}

const VALUE_LABEL: Record<string, string> = {
  trips: 'Trips', paired: 'Paired', unpaired: 'Unpaired',
  monotone: 'Monotone', two_tone: 'Two-Tone', rainbow: 'Rainbow',
  high_mid: 'High-Mid', mid_low: 'Mid-Low', high_low: 'High-Low', 'n/a': 'N/A',
  A: 'A', H: 'H (K-Q-J-T)', M: 'M (9-8-7-6)', L: 'L (5-4-3-2)',
}

/**
 * A board plus an intentionally flawed classification. The learner flags
 * which claims are wrong — ground truth is derived live from `classifyFlop`
 * in the evaluator (comparing each claim to the real value), never a
 * hand-authored "errors" list, so an authoring slip can't create an
 * unfixable claim.
 *
 * Two phases before `onAnswer` fires: 'flag' (freely retoggle, unscored) ->
 * 'reviewed' (frozen; every claim shows whether it was correctly
 * flagged/left unflagged, plus the real value when the claim was wrong).
 * `onAnswer` fires on Continue with the selection exactly as submitted — the
 * reveal never changes what gets scored.
 */
export function BoardAutopsy({ step, onAnswer, disabled = false, reviewMode = false }: BoardAutopsyProps) {
  const mountTime = useRef(Date.now())
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'flag' | 'reviewed'>(reviewMode ? 'reviewed' : 'flag')

  useEffect(() => {
    mountTime.current = Date.now()
    setFlagged(new Set())
    setPhase(reviewMode ? 'reviewed' : 'flag')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const board = step.board_autopsy_board ?? step.board ?? []
  const claimed = step.board_autopsy_claimed ?? {}
  const entries = Object.entries(claimed) as [FlopDimensionKey, string][]

  const { real, correctIds } = useMemo(() => {
    if (board.length !== 3) return { real: null, correctIds: new Set<string>() }
    const r = classifyFlop([board[0], board[1], board[2]])
    const wrongKeys = entries
      .filter(([key, value]) => dimensionValue(r, key) !== value)
      .map(([key]) => key)
    return { real: r, correctIds: new Set(wrongKeys) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, claimed])

  function toggle(key: string) {
    if (disabled || phase === 'reviewed') return
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || phase === 'reviewed') return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer([...flagged], Date.now() - mountTime.current)
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeFlagReveal(entries.map(([key]) => key), flagged, correctIds) : []),
    [phase, entries, flagged, correctIds],
  )
  const correctCount = reveal.filter((r) => r.correct).length

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
      </div>

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_autopsy_prompt ?? 'This analysis has at least one mistake. Flag every claim that is wrong.'}
      </p>

      {phase === 'flag' && (
        <>
          <div className="space-y-2">
            {entries.map(([key, value]) => {
              const isFlagged = flagged.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  data-dimension-key={key}
                  disabled={disabled}
                  onClick={() => toggle(key)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-150',
                    isFlagged
                      ? 'border-red-500/40 bg-red-500/10'
                      : 'border-border/40 bg-secondary/30 hover:border-violet-500/20 hover:bg-secondary/50',
                  )}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">{DIMENSION_LABEL[key]}</p>
                    <p className="text-sm font-semibold text-foreground">{VALUE_LABEL[value] ?? value}</p>
                  </div>
                  <Flag className={cn('h-4 w-4 shrink-0', isFlagged ? 'text-red-400' : 'text-muted-foreground/25')} />
                </button>
              )
            })}
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleSubmit}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Submit Findings
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          <div className="space-y-2">
            {reveal.map((r) => {
              const key = r.id as FlopDimensionKey
              const value = claimed[key]
              const actualValue = real ? dimensionValue(real, key) : undefined
              return (
                <div
                  key={r.id}
                  data-dimension-key={r.id}
                  data-correct={r.correct}
                  className={cn(
                    'w-full flex items-center justify-between rounded-xl border px-4 py-3',
                    r.correct
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-red-500/40 bg-red-500/10',
                  )}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">
                      {DIMENSION_LABEL[r.id as FlopDimensionKey]}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      Claimed: {value != null ? VALUE_LABEL[value] ?? value : '—'}
                      {r.shouldBeSelected && actualValue != null && (
                        <span className="text-muted-foreground"> · Actually: {VALUE_LABEL[actualValue] ?? actualValue}</span>
                      )}
                    </p>
                    {!r.correct && (
                      <p className="text-[10px] font-semibold text-muted-foreground/60">
                        {r.selected ? 'This claim was actually correct — should not have been flagged.' : 'Missed — this claim is wrong.'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Flag className={cn('h-4 w-4', r.selected ? 'text-red-400' : 'text-muted-foreground/25')} />
                    <CorrectnessIcon correct={r.correct} />
                  </div>
                </div>
              )
            })}
          </div>

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}
