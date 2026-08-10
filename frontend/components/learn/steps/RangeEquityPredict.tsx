'use client'

import { useEffect, useRef, useState } from 'react'
import type { LessonStep } from '@/lib/learn/types'
import { getNeutralSliderStart } from '@/lib/learn/interactionSafety'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { RangeEquityMeter } from '@/components/learn/visuals/RangeEquityMeter'
import { LessonSlider } from '@/components/learn/visuals/LessonSlider'

interface RangeEquityPredictProps {
  step: LessonStep
  onAnswer: (value: number, timeMs: number) => void
  disabled?: boolean
}

/**
 * Slider estimate of a range-vs-range equity split (side A's %, 0-100), then a
 * reveal comparing the learner's own estimate against the book's cited figure.
 * The goal is calibration, not punishing an approximate guess — see evaluator.ts's
 * tiered tolerance bands (tolerance / 2x / 3.5x -> perfect/good/acceptable/mistake).
 */
export function RangeEquityPredict({ step, onAnswer, disabled = false }: RangeEquityPredictProps) {
  const mountTime = useRef(Date.now())
  const aLabel = step.range_equity_predict_a_label ?? 'Side A'
  const bLabel = step.range_equity_predict_b_label ?? 'Side B'
  const correct = step.range_equity_predict_correct ?? 50
  const board = step.range_equity_predict_board ?? step.board ?? []

  const [value, setValue] = useState(() => getNeutralSliderStart(correct))
  const [submitted, setSubmitted] = useState(false)
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setValue(getNeutralSliderStart(step.range_equity_predict_correct ?? 50))
    setSubmitted(false)
    setInteracted(false)
  }, [step.id, step.range_equity_predict_correct])

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(value, Date.now() - mountTime.current)
  }

  const delta = Math.round(Math.abs(value - correct) * 10) / 10

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {board.length > 0 && (
        <div className="flex items-center justify-center gap-1.5">
          {board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
        </div>
      )}

      <p className="text-center text-sm font-semibold text-foreground">
        {step.range_equity_predict_prompt ?? `Estimate ${aLabel}'s range-vs-range equity on this board.`}
      </p>

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-violet-300">{aLabel} 100%</span>
          <span className="text-muted-foreground/50">50 / 50</span>
          <span className="text-blue-300">{bLabel} 100%</span>
        </div>

        {/* One track split between two players: the unfilled side is B's share,
            not slack, so it keeps B's blue rather than the neutral track colour. */}
        <LessonSlider
          label={`${aLabel} equity percentage estimate`}
          value={value}
          onChange={(next) => { setValue(next); setInteracted(true) }}
          disabled={disabled || submitted}
          showLabel={false}
          format={(v) => `${aLabel} ${v}% / ${bLabel} ${100 - v}%`}
          trackGradient="rgb(124,58,237)"
          trackBase="rgb(59,130,246)"
          hint={null}
        />

        <p className="text-center text-lg font-black tabular-nums text-foreground">
          {aLabel} {value}% <span className="text-muted-foreground/40 text-sm font-medium">/</span> {bLabel} {100 - value}%
        </p>
      </div>

      {!submitted && !interacted && (
        <p className="text-center text-xs text-muted-foreground/40 italic">Drag the slider to set your estimate.</p>
      )}

      {!submitted ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleSubmit}
          className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Lock In My Estimate
        </button>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3 animate-in fade-in duration-300">
          <p className="text-center text-xs font-semibold text-muted-foreground/60">
            Your estimate <span className="text-foreground font-bold">{aLabel} {value}%</span> vs. the book&apos;s figure{' '}
            <span className="text-foreground font-bold">{aLabel} {correct}%</span>
            {' — '}
            {delta <= 3 ? 'right on the money.' : `off by ${delta} points.`}
          </p>
          <RangeEquityMeter aLabel={aLabel} bLabel={bLabel} aEquity={correct} />
        </div>
      )}
    </div>
  )
}
