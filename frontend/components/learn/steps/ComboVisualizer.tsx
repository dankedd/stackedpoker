'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'

const SUITS = ['s', 'h', 'd', 'c']

function nCr2(n: number): number {
  return (n * (n - 1)) / 2
}

interface ComboVisualizerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

export function ComboVisualizer({ step, onAnswer, disabled = false }: ComboVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setValue('')
    setSubmitted(false)
  }, [step.id])

  const isQuiz = step.combo_visualizer_mode === 'quiz'
  const kind = step.combo_visualizer_kind ?? 'pair'
  const known = new Set((step.combo_visualizer_known_cards ?? []).map((c) => c.toLowerCase()))
  const subject = step.combo_visualizer_subject ?? 'A'

  function submitQuiz() {
    if (disabled || submitted || value === '') return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current
    onAnswer(Number(value), elapsed)
  }

  function submitReveal() {
    if (disabled) return
    const elapsed = Date.now() - mountTime.current
    onAnswer(null, elapsed)
  }

  // ── Pair / removal visual: 4 cards of one rank ──────────────────────────────
  function PairFan({ rank }: { rank: string }) {
    const cards = SUITS.map((s) => `${rank}${s}`)
    const removedCount = cards.filter((c) => known.has(c.toLowerCase())).length
    const remaining = 4 - removedCount
    const combos = nCr2(remaining)

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {cards.map((c) => {
            const isRemoved = known.has(c.toLowerCase())
            return (
              <div key={c} className={cn('relative transition-all duration-300', isRemoved && 'opacity-25 grayscale')}>
                <PlayingCardMini card={c} size="md" />
                {isRemoved && (
                  <div aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <div className="h-[2px] w-[130%] rotate-45 bg-rose-500/70" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {!isQuiz && (
          <p className="text-sm text-muted-foreground text-center">
            {remaining} card{remaining !== 1 ? 's' : ''} remain
            {removedCount > 0 ? ` (${removedCount} removed)` : ''} → choose 2 →{' '}
            <span className="font-bold text-violet-300">{combos} combination{combos !== 1 ? 's' : ''}</span>
          </p>
        )}
      </div>
    )
  }

  // ── Unpaired visual: rank1 x rank2 suit grid ────────────────────────────────
  function UnpairedGrid({ hand }: { hand: string }) {
    const r1 = hand[0]
    const r2 = hand[1]
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="inline-grid grid-cols-4 gap-1.5">
          {SUITS.map((sa) =>
            SUITS.map((sb) => {
              const suited = sa === sb
              return (
                <div
                  key={`${sa}-${sb}`}
                  className={cn(
                    'flex items-center gap-0.5 rounded-md border px-1 py-1',
                    suited ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/30 bg-secondary/20',
                  )}
                >
                  <PlayingCardMini card={`${r1}${sa}`} size="xs" />
                  <PlayingCardMini card={`${r2}${sb}`} size="xs" />
                </div>
              )
            }),
          )}
        </div>
        {!isQuiz && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-emerald-300 font-bold">4 suited</span>
            <span className="text-muted-foreground/40">+</span>
            <span className="text-foreground/80 font-bold">12 offsuit</span>
            <span className="text-muted-foreground/40">=</span>
            <span className="text-violet-300 font-bold">16 total</span>
          </div>
        )}
      </div>
    )
  }

  const isPairLike = kind === 'pair' || kind === 'removal'

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.combo_visualizer_correct_feedback && !isQuiz && null}

      <div className="rounded-2xl border border-border/30 bg-secondary/10 px-4 py-6">
        {isPairLike ? <PairFan rank={subject[0]} /> : <UnpairedGrid hand={subject} />}
      </div>

      {isQuiz ? (
        <div className="space-y-3">
          <p className="text-center text-sm font-semibold text-foreground">
            How many combinations remain?
          </p>
          <div className="flex items-center justify-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              value={value}
              disabled={disabled || submitted}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5 text-center text-lg font-bold text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            />
            <button
              type="button"
              disabled={disabled || submitted || value === ''}
              onClick={submitQuiz}
              className={cn(
                'rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200',
                disabled || submitted || value === ''
                  ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                  : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-md shadow-violet-500/25 hover:-translate-y-0.5',
              )}
            >
              Submit
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={submitReveal}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Continue
        </button>
      )}
    </div>
  )
}
