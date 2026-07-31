'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCard } from '@/components/poker/PlayingCard'
import { CardPickerGrid } from '@/components/poker/CardPicker'
import { SUITS } from '@/lib/learn/flopClassifier'

const RANK_NAME: Record<string, string> = {
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten',
  '9': 'Nine', '8': 'Eight', '7': 'Seven', '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two',
}
const SUIT_NAME: Record<string, string> = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' }

function cardLabel(card: string): string {
  return `${RANK_NAME[card[0]?.toUpperCase()] ?? card[0]} of ${SUIT_NAME[card[1]?.toLowerCase()] ?? card[1]}`
}

interface FlopBuilderProps {
  step: LessonStep
  onAnswer: (board: string[], timeMs: number) => void
  disabled?: boolean
}

const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

/** Shared across both builder modes so every board-building exercise renders
 *  cards at the same, prominent size — bump this one constant to rescale both. */
const BOARD_CARD_SIZE = 'xl'

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
  // swap_one_card: which slot's replacement picker is currently open below the board.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setSuits(fixedRanks.map(() => null))
    setOverride(null)
    setSelectedSlot(null)
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

        <div className="flex items-center justify-center gap-2 sm:gap-5 overflow-x-auto">
          {fixedRanks.map((r, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <PlayingCard card={suits[i] ? `${r}${suits[i]}` : `${r}?`} size={BOARD_CARD_SIZE} />
              <div className="flex flex-wrap justify-center gap-1 max-w-[100px] sm:max-w-none sm:flex-nowrap">
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

  // swap_one_card mode — a guided 5-step flow: (1) show the board, (2) click a
  // card to select it, (3) an inline picker appears below to choose its
  // replacement, (4) the board above updates immediately as a live preview,
  // (5) submit. The board itself is the single source of truth throughout —
  // nothing is ever hidden or duplicated, and the replacement grid never
  // scrolls (see CardPickerGrid).
  const board = baseBoard.map((c, i) => (override && override.slot === i ? override.card : c))
  const locked = disabled || submitted

  function selectSlot(i: number) {
    if (locked) return
    setSelectedSlot((prev) => (prev === i ? null : i))
  }

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

      <div className="flex items-center justify-center gap-3 sm:gap-6">
        {board.map((card, i) => {
          const isSelected = selectedSlot === i
          const isChanged = override?.slot === i
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => selectSlot(i)}
              aria-pressed={isSelected}
              aria-label={locked ? cardLabel(card) : `${cardLabel(card)} — click to replace`}
              className={cn(
                'group relative rounded-xl transition-all duration-200',
                locked ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5',
              )}
            >
              <PlayingCard
                card={card}
                size={BOARD_CARD_SIZE}
                className={cn(
                  'transition-shadow duration-200',
                  isSelected && 'ring-2 ring-violet-400 ring-offset-2 ring-offset-background',
                  !isSelected && isChanged && 'ring-2 ring-violet-500/40 ring-offset-2 ring-offset-background',
                )}
              />
              {isChanged && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white shadow">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              {!locked && !isSelected && !isChanged && (
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white/80 text-black text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                  <Pencil className="h-2 w-2" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
        {selectedSlot === null
          ? 'Click one card to replace.'
          : `Choose a replacement for the ${cardLabel(board[selectedSlot])}`}
      </p>

      {selectedSlot !== null && (
        <CardPickerGrid
          key={selectedSlot}
          value={board[selectedSlot]}
          onChange={(newCard) => {
            if (!newCard) return
            setOverride({ slot: selectedSlot, card: newCard })
          }}
          disabledCards={board.filter((_, j) => j !== selectedSlot)}
          onEscape={() => setSelectedSlot(null)}
          className="mx-auto max-w-md animate-in fade-in slide-in-from-top-1 duration-200"
        />
      )}

      <button
        type="button"
        disabled={locked || !override}
        onClick={() => submit(board)}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
      >
        <Check className="h-4 w-4" />
        Submit Board
      </button>
    </div>
  )
}
