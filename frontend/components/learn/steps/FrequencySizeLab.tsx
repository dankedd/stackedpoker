'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface FrequencySizeLabProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/** Two-stage frequency-then-size decision: pick an aggregate betting-frequency
 *  bucket, then a primary sizing bucket. Submits the combined answer as
 *  `${frequencyId}|${sizingId}` so authors grade the COMBINATION — e.g. HIGH
 *  FREQUENCY + SMALL SIZE means something different from LOW FREQUENCY + BIG SIZE. */
export function FrequencySizeLab({ step, onAnswer, disabled = false }: FrequencySizeLabProps) {
  const mountTime = useRef(Date.now())
  const [frequencyId, setFrequencyId] = useState<string | null>(null)
  const [sizingId, setSizingId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setFrequencyId(null)
    setSizingId(null)
    setSubmitted(false)
  }, [step.id])

  const rawFrequencyOptions = step.cbet_frequency_size_frequency_options ?? []
  const rawSizingOptions = step.cbet_frequency_size_sizing_options ?? []
  const frequencyOptions = useMemo(
    () => shuffleBySeed(rawFrequencyOptions, `${step.id}-freq`),
    [rawFrequencyOptions, step.id],
  )
  const sizingOptions = useMemo(
    () => shuffleBySeed(rawSizingOptions, `${step.id}-size`),
    [rawSizingOptions, step.id],
  )

  function pickFrequency(id: string) {
    if (disabled || submitted || frequencyId) return
    setFrequencyId(id)
  }

  function pickSizing(id: string) {
    if (disabled || submitted || !frequencyId || sizingId) return
    setSizingId(id)
    setSubmitted(true)
    onAnswer(`${frequencyId}|${id}`, Date.now() - mountTime.current)
  }

  const frequencyLabel = frequencyOptions.find((o) => o.id === frequencyId)?.label

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.cbet_frequency_size_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.cbet_frequency_size_prompt}</p>
      )}

      {/* Stage A — frequency */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 text-center">
          Stage 1 — Aggregate betting frequency
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {frequencyOptions.map((opt) => {
            const isSelected = frequencyId === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || submitted || (!!frequencyId && !isSelected)}
                onClick={() => pickFrequency(opt.id)}
                className={cn(
                  'rounded-xl px-4 py-3 text-sm font-semibold border text-left transition-all',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                    : frequencyId
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

      {/* Stage B — sizing, only once frequency picked */}
      {frequencyId && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 text-center">
            Stage 2 — Primary sizing ({frequencyLabel})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sizingOptions.map((opt) => {
              const isSelected = sizingId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled || submitted}
                  onClick={() => pickSizing(opt.id)}
                  className={cn(
                    'rounded-xl px-3 py-3 text-sm font-semibold border text-center transition-all',
                    isSelected
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                      : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
