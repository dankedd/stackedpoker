'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { CorrectnessIcon, ReviewContinueButton, ReviewSummaryLine } from '@/components/learn/RevealKit'
import { computeOrderReveal } from '@/lib/learn/revealHelpers'

interface BoardRankSortProps {
  step: LessonStep
  onAnswer: (order: string[], timeMs: number) => void
  disabled?: boolean
  /** Forces the post-submit reveal phase without requiring a real submission — used by tests. */
  reviewMode?: boolean
}

/**
 * Order 3-5 boards from BETS MOST to BETS LEAST by tap-to-reorder — same
 * tap-to-order UX as `board_volatility`'s continuum_sort, but scored against
 * a hand-authored target order (c-bet frequency ranking across board
 * families isn't a deterministic function the way volatility estimation is).
 *
 * Two phases before `onAnswer` fires: 'arrange' (freely retap, unscored) ->
 * 'reviewed' (frozen; every slot shows correct/incorrect plus the full
 * correct order below). `onAnswer` only fires on Continue, using the order
 * exactly as submitted — the reveal never changes what gets scored.
 */
export function BoardRankSort({ step, onAnswer, disabled = false, reviewMode = false }: BoardRankSortProps) {
  const mountTime = useRef(Date.now())
  const [order, setOrder] = useState<string[]>([])
  const [phase, setPhase] = useState<'arrange' | 'reviewed'>(reviewMode ? 'reviewed' : 'arrange')
  const boards = useMemo(
    () => shuffleBySeed(step.board_rank_sort_boards ?? [], step.id),
    [step.board_rank_sort_boards, step.id],
  )
  const target = step.board_rank_sort_target ?? []
  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards])

  useEffect(() => {
    mountTime.current = Date.now()
    setOrder([])
    setPhase(reviewMode ? 'reviewed' : 'arrange')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function handleTap(id: string) {
    if (disabled || phase === 'reviewed') return
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCheckOrder() {
    if (disabled || phase === 'reviewed' || order.length !== boards.length) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer(order, Date.now() - mountTime.current)
  }

  const reveal = useMemo(
    () => (phase === 'reviewed' ? computeOrderReveal(order, target) : []),
    [phase, order, target],
  )
  const correctCount = reveal.filter((r) => r.correct).length

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_rank_sort_prompt ?? 'Tap the boards in order — bets most first, bets least last.'}
      </p>

      {phase === 'arrange' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {boards.map((b) => {
              const position = order.indexOf(b.id)
              const isPicked = position >= 0
              return (
                <button
                  key={b.id}
                  type="button"
                  data-board-id={b.id}
                  disabled={disabled}
                  onClick={() => handleTap(b.id)}
                  className={cn(
                    'relative rounded-xl border p-2.5 space-y-1.5 transition-all duration-150',
                    isPicked ? 'border-violet-500/50 bg-violet-500/10' : 'border-border/40 bg-secondary/30 hover:border-violet-500/20',
                  )}
                >
                  {isPicked && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                      {position + 1}
                    </span>
                  )}
                  {b.label && <p className="text-center text-[9px] font-semibold text-muted-foreground/50">{b.label}</p>}
                  <div className="flex items-center justify-center gap-1">
                    {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[9px] text-muted-foreground/40">
            <span>1 = bets most</span>
            <span>{boards.length} = bets least</span>
          </div>

          <button
            type="button"
            disabled={disabled || order.length !== boards.length}
            onClick={handleCheckOrder}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Check order
          </button>
        </>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <ReviewSummaryLine correctCount={correctCount} total={reveal.length} />

          <div className="space-y-2">
            {reveal.map((r) => {
              const b = boardById.get(r.id)
              if (!b) return null
              return (
                <div
                  key={r.id}
                  data-board-id={r.id}
                  data-correct={r.correct}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                    r.correct ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10',
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-base font-black tabular-nums text-foreground/80">
                    {r.position + 1}
                  </span>
                  {b.label && (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                      {b.label}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1">
                    {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
                  </div>
                  <CorrectnessIcon correct={r.correct} className="ml-auto" />
                </div>
              )
            })}
          </div>

          {correctCount < reveal.length && (
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Correct order — bets most to bets least
              </p>
              <ol className="space-y-1.5">
                {target.map((id, i) => {
                  const b = boardById.get(id)
                  if (!b) return null
                  return (
                    <li key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-4 shrink-0 text-right font-bold tabular-nums">{i + 1}</span>
                      {b.label && <span className="font-medium text-foreground/80">{b.label}</span>}
                      <div className="flex shrink-0 gap-0.5">
                        {b.board.map((c, ci) => <PlayingCardMini key={ci} card={c} size="xs" />)}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          <ReviewContinueButton onClick={handleContinue} disabled={disabled} />
        </div>
      )}
    </div>
  )
}
