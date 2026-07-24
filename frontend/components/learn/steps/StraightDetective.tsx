'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { classifyFlop } from '@/lib/learn/flopClassifier'
import { CorrectnessIcon, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeFlagReveal } from '@/lib/learn/revealHelpers'

interface StraightDetectiveProps {
  step: LessonStep
  onAnswer: (selectedIds: string[], timeMs: number) => void
  disabled?: boolean
  /** Forces the post-submit reveal phase without requiring a real submission — used by tests. */
  reviewMode?: boolean
}

/**
 * Tap every hole-card rank pair that completes a possible flopped straight
 * on this board. Decoys mixed in represent real misconceptions (an adjacent
 * pair that looks plausible but doesn't actually complete a straight).
 * Correctness is derived live from `classifyFlop`, never hand-authored.
 *
 * Two phases before `onAnswer` fires: 'select' (freely retoggle, unscored) ->
 * 'reviewed' (frozen; every candidate shows whether it was correctly
 * flagged/left unflagged). `onAnswer` fires on Continue with the selection
 * exactly as submitted — the reveal never changes what gets scored.
 */
export function StraightDetective({ step, onAnswer, disabled = false, reviewMode = false }: StraightDetectiveProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'select' | 'reviewed'>(reviewMode ? 'reviewed' : 'select')

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(new Set())
    setPhase(reviewMode ? 'reviewed' : 'select')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const board = step.straight_detective_board ?? step.board ?? []
  const decoys = step.straight_detective_decoys ?? []

  const { candidates, correctIds } = useMemo(() => {
    if (board.length !== 3) return { candidates: [] as { id: string; label: string }[], correctIds: new Set<string>() }
    const real = classifyFlop([board[0], board[1], board[2]]).possibleFloppedStraights.combos
    const realIds = new Set(real.map((p) => p.join('')))
    const all = [...real, ...decoys].map((p) => ({ id: p.join(''), label: `${p[0]}-${p[1]}` }))
    const seen = new Set<string>()
    const deduped = all.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
    return { candidates: shuffleBySeed(deduped, step.id), correctIds: realIds }
  }, [board, decoys, step.id])

  function toggle(id: string) {
    if (disabled || phase === 'reviewed') return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || phase === 'reviewed') return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer([...selected], Date.now() - mountTime.current)
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeFlagReveal(candidates.map((c) => c.id), selected, correctIds) : []),
    [phase, candidates, selected, correctIds],
  )
  const correctCount = reveal.filter((r) => r.correct).length
  const labelById = useMemo(() => new Map(candidates.map((c) => [c.id, c.label])), [candidates])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {board.map((card, i) => <PlayingCardMini key={i} card={card} size="md" />)}
      </div>

      {step.straight_detective_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.straight_detective_prompt}</p>
      )}

      {phase === 'select' && (
        <>
          {candidates.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              {candidates.map((c) => {
                const isSelected = selected.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-candidate-id={c.id}
                    disabled={disabled}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'rounded-lg border px-4 py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.96]',
                      isSelected
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                        : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground/50 italic">No candidates configured.</p>
          )}

          <p className="text-center text-[11px] text-muted-foreground/40">
            Tap every pair that completes a straight — or submit with none selected if this board has no possible flopped straight.
          </p>

          <button
            type="button"
            disabled={disabled}
            onClick={handleSubmit}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Submit
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          {reveal.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2.5">
              {reveal.map((r) => (
                <div
                  key={r.id}
                  data-candidate-id={r.id}
                  data-correct={r.correct}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-4 py-2.5',
                    r.correct
                      ? r.selected
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border/30 bg-secondary/20'
                      : r.selected
                      ? 'border-red-500/40 bg-red-500/10'
                      : 'border-amber-500/40 bg-amber-500/10',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">{labelById.get(r.id)}</span>
                    <CorrectnessIcon correct={r.correct} />
                  </div>
                  {!r.correct && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                      {r.selected ? "Shouldn't be flagged" : 'Missed — completes a straight'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground/50 italic">No candidates configured.</p>
          )}

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}
