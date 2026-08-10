'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { RangeExplanationCallout } from '@/components/poker/RangeExplanationCallout'
import { LessonSlider } from '@/components/learn/visuals/LessonSlider'

interface EquityPredictProps {
  step: LessonStep
  onAnswer: (equity: number, timeMs: number) => void
  disabled?: boolean
}

const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }

function formatHandLabel(cards: string[]): string {
  return cards
    .map((c) => {
      const rank = c[0]?.toUpperCase() === 'T' ? 'T' : c[0]?.toUpperCase()
      const suit = SUIT_SYMBOL[c[1]?.toLowerCase()] ?? ''
      return `${rank}${suit}`
    })
    .join(' ')
}

export function EquityPredict({ step, onAnswer, disabled = false }: EquityPredictProps) {
  const mountTime = useRef(Date.now())
  const [equity, setEquity] = useState(50)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setEquity(50)
    setSubmitted(false)
  }, [step.id])

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current
    onAnswer(equity, elapsed)
  }

  // Equity color thresholds
  const equityColor =
    equity >= 60
      ? 'text-emerald-400'
      : equity >= 40
      ? 'text-amber-400'
      : 'text-red-400'


  const heroHand = step.hero_hand ?? []
  const board = step.board ?? []
  const villainRange = step.equity_villain_range ?? []
  const handLabel = heroHand.length > 0 ? formatHandLabel(heroHand) : "Hero's hand"

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Hand vs range distinction */}
      {villainRange.length > 0 && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <p className="text-sm text-violet-200/90 leading-relaxed">
            Here, you are not comparing {handLabel} against one specific hand. You are comparing it
            against every hand in Villain&apos;s range.
          </p>
        </div>
      )}

      {/* Scenario context: hero hand, board, villain range */}
      {(heroHand.length > 0 || board.length > 0 || villainRange.length > 0) && (
        <div className="space-y-4 rounded-2xl border border-border/30 bg-secondary/10 p-4">
          {heroHand.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                Hero
              </span>
              <div className="flex gap-1.5">
                {heroHand.map((card, i) => (
                  <PlayingCardMini key={i} card={card} size="md" />
                ))}
              </div>
            </div>
          )}

          {board.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                Board
              </span>
              <div className="flex gap-1.5">
                {board.map((card, i) => (
                  <PlayingCardMini key={i} card={card} size="md" />
                ))}
              </div>
            </div>
          )}

          {villainRange.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                Villain&apos;s range
              </span>
              <PokerRangeGrid range={villainRange} />
            </div>
          )}
        </div>
      )}

      {step.narrative && <RangeExplanationCallout>{step.narrative}</RangeExplanationCallout>}

      {/* Prompt */}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
          Equity estimate
        </p>
        <p className="text-base font-semibold text-foreground">
          What percentage equity does {handLabel} have against Villain&apos;s entire range?
        </p>
      </div>

      {/* Equity display */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-5xl font-black tabular-nums transition-colors duration-200', equityColor)}>
            {equity}
          </span>
          <span className="text-2xl font-bold text-muted-foreground/50">%</span>
        </div>
        <p className="text-xs text-muted-foreground/50">Your equity estimate</p>
      </div>

      {/* Slider */}
      <div className="px-1">
        {/* The red -> amber -> emerald ramp IS the equity scale, so the fill
            keeps its own gradient instead of the default accent. */}
        <LessonSlider
          label="Your equity estimate, as a percentage"
          value={equity}
          onChange={setEquity}
          disabled={disabled || submitted}
          showLabel={false}
          format={(v) => `${Math.round(v)}%`}
          trackGradient="linear-gradient(to right, rgb(239,68,68), rgb(251,191,36), rgb(16,185,129))"
          ticks={['0%', '25%', '50%', '75%', '100%']}
          hint="Drag to set your estimate"
        />
      </div>

      {/* Equity bar visual */}
      <div className="rounded-xl border border-border/30 bg-secondary/20 p-4">
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className={equityColor}>Hero: {equity}%</span>
          <span className="text-muted-foreground/50">Villain: {100 - equity}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-secondary/60 flex">
          <div
            className="h-full rounded-l-full bg-violet-500 transition-all duration-100"
            style={{ width: `${equity}%` }}
          />
          <div
            className="h-full rounded-r-full bg-red-500/60 transition-all duration-100"
            style={{ width: `${100 - equity}%` }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={disabled || submitted}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2',
          'rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
        )}
      >
        {!submitted && !disabled && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
        {submitted ? 'Submitted' : `Lock in ${equity}%`}
      </button>
    </div>
  )
}
