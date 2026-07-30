'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { CardPicker } from '@/components/poker/CardPicker'
import { SUITS } from '@/lib/learn/flopClassifier'

interface FlopBuilderProps {
  step: LessonStep
  onAnswer: (board: string[], timeMs: number) => void
  disabled?: boolean
}

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

/**
 * Constructs a flop toward a described target (checked live against
 * `classifyFlop`/`estimateVolatility` in the evaluator — never a single
 * hand-authored "correct board," since most targets accept many boards).
 * 'assign_suits': ranks are fixed, learner picks each card's suit.
 * 'swap_one_card': one card of a starting board may be replaced.
 */
export function FlopBuilder({ step, onAnswer, disabled = false }: FlopBuilderProps) {
  const mountTime = useRef(Date.now())
  const mode = step.flop_builder_mode ?? 'assign_suits'
  const fixedRanks = step.flop_builder_fixed_ranks ?? []
  const baseBoard = step.flop_builder_base_board ?? []

  // assign_suits: one suit choice per slot, starts unset (neutral).
  const [suits, setSuits] = useState<(string | null)[]>(fixedRanks.map(() => null))
  // swap_one_card: which slot (if any) has been overridden, and to what card.
  const [override, setOverride] = useState<{ slot: number; card: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setSuits(fixedRanks.map(() => null))
    setOverride(null)
    setSubmitted(false)
  }, [step.id, fixedRanks.length])

  function submit(board: string[]) {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(board, Date.now() - mountTime.current)
  }

  if (mode === 'assign_suits') {
    const board = fixedRanks.map((r, i) => (suits[i] ? `${r}${suits[i]}` : null))
    const complete = board.every(Boolean)

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}
        {step.flop_builder_prompt && (
          <p className="text-center text-sm font-semibold text-foreground">{step.flop_builder_prompt}</p>
        )}

        <div className="flex items-center justify-center gap-4">
          {fixedRanks.map((r, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <PlayingCardMini card={suits[i] ? `${r}${suits[i]}` : `${r}?`} size="md" />
              <div className="flex gap-1">
                {SUITS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled || submitted}
                    onClick={() => setSuits((prev) => prev.map((v, j) => (j === i ? s : v)))}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold border transition-colors',
                      suits[i] === s
                        ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
                        : 'border-border/40 bg-secondary/30 text-muted-foreground/60 hover:bg-secondary/60',
                    )}
                  >
                    {SUIT_SYMBOL[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!complete || disabled || submitted}
          onClick={() => submit(board as string[])}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            complete && !submitted
              ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
              : 'bg-secondary/40 border border-border/30 text-muted-foreground opacity-50 cursor-default',
          )}
        >
          <Check className="h-4 w-4" />
          Submit Board
        </button>
      </div>
    )
  }

  // swap_one_card mode
  const board = baseBoard.map((c, i) => (override && override.slot === i ? override.card : c))

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}
      {step.flop_builder_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.flop_builder_prompt}</p>
      )}

      <div className="flex items-center justify-center gap-3">
        {board.map((card, i) => (
          <CardPicker
            key={i}
            value={card}
            onChange={(newCard) => {
              if (!newCard) return
              setOverride({ slot: i, card: newCard })
            }}
            disabledCards={board}
            boardCards={board.filter((_, j) => j !== i)}
            disabled={disabled || submitted}
          />
        ))}
      </div>
      <p className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Click a card to pick a replacement
      </p>

      <button
        type="button"
        disabled={disabled || submitted}
        onClick={() => submit(board)}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Submit Board
      </button>
    </div>
  )
}
