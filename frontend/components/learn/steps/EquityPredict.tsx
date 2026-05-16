'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface EquityPredictProps {
  step: LessonStep
  onAnswer: (equity: number, timeMs: number) => void
  disabled?: boolean
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

  const trackFill = `${equity}%`

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Prompt */}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
          Equity estimate
        </p>
        <p className="text-base font-semibold text-foreground">
          What is your equity against villain&apos;s range?
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
      <div className="space-y-2 px-1">
        <div className="relative h-10 flex items-center">
          {/* Custom track background */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-secondary/60">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-100"
              style={{ width: trackFill }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={equity}
            disabled={disabled || submitted}
            onChange={e => setEquity(Number(e.target.value))}
            className={cn(
              'relative w-full h-2 appearance-none bg-transparent cursor-pointer',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-white',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-400',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/30',
              '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100',
              '[&::-webkit-slider-thumb]:hover:scale-110',
              '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
              '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
              '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-violet-400',
              (disabled || submitted) ? 'opacity-50 cursor-default' : ''
            )}
          />
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground/40 font-medium px-0.5">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
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
