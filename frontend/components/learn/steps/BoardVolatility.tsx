'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface BoardVolatilityProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

/**
 * Three sub-modes sharing one static/dynamic-reading interaction:
 * 'runout_storm' — tap the turn cards that meaningfully change the board
 *   (graded live via `turnImpact`, a labeled heuristic, never solver-exact).
 * 'compare' — which of two boards is more dynamic (uses `options`).
 * 'continuum_sort' — order several boards from most static to most dynamic.
 */
export function BoardVolatility({ step, onAnswer, disabled = false }: BoardVolatilityProps) {
  const mountTime = useRef(Date.now())
  const mode = step.board_volatility_mode ?? 'runout_storm'

  useEffect(() => {
    mountTime.current = Date.now()
  }, [step.id])

  if (mode === 'compare') {
    return <CompareMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
  }
  if (mode === 'continuum_sort') {
    return <ContinuumSortMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
  }
  return <RunoutStormMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
}

function RunoutStormMode({ step, onAnswer, disabled, mountTime }: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const board = step.board_volatility_board ?? step.board ?? []
  const pool = useMemo(() => shuffleBySeed(step.board_volatility_storm_pool ?? [], step.id), [step.board_volatility_storm_pool, step.id])

  useEffect(() => {
    setSelected(new Set())
    setSubmitted(false)
  }, [step.id])

  function toggle(card: string) {
    if (disabled || submitted) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(card)) next.delete(card)
      else next.add(card)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer([...selected], Date.now() - (mountTime.current ?? Date.now()))
  }

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

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_volatility_prompt ?? 'Which turn cards would meaningfully change this board?'}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {pool.map((card) => {
          const isSelected = selected.has(card)
          return (
            <button
              key={card}
              type="button"
              disabled={disabled || submitted}
              onClick={() => toggle(card)}
              className={cn(
                'rounded-lg transition-all duration-150 active:scale-[0.95] p-0.5',
                isSelected ? 'ring-2 ring-violet-500/60' : '',
              )}
            >
              <PlayingCardMini card={card} size="sm" />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled || submitted}
        onClick={handleSubmit}
        className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Submit
      </button>
    </div>
  )
}

function CompareMode({ step, onAnswer, disabled, mountTime }: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [selected, setSelected] = useState<string | null>(null)
  const a = step.board_volatility_compare_a ?? []
  const b = step.board_volatility_compare_b ?? []
  const options = useMemo(() => shuffleBySeed(step.options ?? [], step.id), [step.options, step.id])

  useEffect(() => setSelected(null), [step.id])

  function handleSelect(id: string) {
    if (disabled || selected) return
    setSelected(id)
    onAnswer(id, Date.now() - (mountTime.current ?? Date.now()))
  }

  const hasSelected = selected !== null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board A</p>
          <div className="flex items-center justify-center gap-1.5">{a.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
        </div>
        <div className="space-y-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board B</p>
          <div className="flex items-center justify-center gap-1.5">{b.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
        </div>
      </div>

      {step.board_volatility_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.board_volatility_prompt}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => {
          const isSelected = selected === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || (hasSelected && !isSelected)}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'relative rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                isSelected
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                  : hasSelected
                  ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                  : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ContinuumSortMode({ step, onAnswer, disabled, mountTime }: BoardVolatilityProps & { mountTime: React.RefObject<number> }) {
  const [order, setOrder] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const boards = useMemo(() => shuffleBySeed(step.board_volatility_continuum_boards ?? [], step.id), [step.board_volatility_continuum_boards, step.id])

  useEffect(() => {
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
    onAnswer(order, Date.now() - (mountTime.current ?? Date.now()))
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <p className="text-center text-sm font-semibold text-foreground">
        {step.board_volatility_prompt ?? 'Tap the boards in order, from most static to most dynamic.'}
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
                'relative rounded-xl border p-2.5 transition-all duration-150',
                isPicked ? 'border-violet-500/50 bg-violet-500/10' : 'border-border/40 bg-secondary/30 hover:border-violet-500/20',
              )}
            >
              {isPicked && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                  {position + 1}
                </span>
              )}
              <div className="flex items-center justify-center gap-1">
                {b.board.map((c, i) => <PlayingCardMini key={i} card={c} size="sm" />)}
              </div>
            </button>
          )
        })}
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
