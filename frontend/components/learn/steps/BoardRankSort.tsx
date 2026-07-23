'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface BoardRankSortProps {
  step: LessonStep
  onAnswer: (order: string[], timeMs: number) => void
  disabled?: boolean
}

/** Order 3-5 boards from BETS MOST to BETS LEAST by tap-to-reorder — same
 *  tap-to-order UX as `board_volatility`'s continuum_sort, but scored against
 *  a hand-authored target order (c-bet frequency ranking across board
 *  families isn't a deterministic function the way volatility estimation is). */
export function BoardRankSort({ step, onAnswer, disabled = false }: BoardRankSortProps) {
  const mountTime = useRef(Date.now())
  const [order, setOrder] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const boards = useMemo(
    () => shuffleBySeed(step.board_rank_sort_boards ?? [], step.id),
    [step.board_rank_sort_boards, step.id],
  )

  useEffect(() => {
    mountTime.current = Date.now()
    setOrder([])
    setSubmitted(false)
  }, [step.id])

  function handleTap(id: string) {
    if (disabled || submitted) return
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit() {
    if (disabled || submitted || order.length !== boards.length) return
    setSubmitted(true)
    onAnswer(order, Date.now() - mountTime.current)
  }

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {boards.map((b) => {
          const position = order.indexOf(b.id)
          const isPicked = position >= 0
          return (
            <button
              key={b.id}
              type="button"
              disabled={disabled || submitted}
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
        disabled={disabled || submitted || order.length !== boards.length}
        onClick={handleSubmit}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Submit Order
      </button>
    </div>
  )
}
