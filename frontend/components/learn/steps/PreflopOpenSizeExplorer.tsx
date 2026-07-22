'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { bluffBreakEvenFrequency } from '@/lib/theory/math'
import { getNeutralSliderStart } from '@/lib/learn/interactionSafety'

interface PreflopOpenSizeExplorerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

function StatTile({ label, value, color }: { label: string; value: string; color: 'slate' | 'amber' | 'violet' }) {
  const colorClasses = {
    slate:  'border-border/30 bg-secondary/20 text-foreground',
    amber:  'border-amber-500/20 bg-amber-500/8 text-amber-300',
    violet: 'border-violet-500/20 bg-violet-500/8 text-violet-300',
  }[color]
  return (
    <div className={cn('flex-1 rounded-xl border p-2.5 text-center', colorClasses)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-60 mb-0.5">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
    </div>
  )
}

export function PreflopOpenSizeExplorer({ step, onAnswer, disabled = false }: PreflopOpenSizeExplorerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)

  const pot = step.open_size_pot ?? 1.5
  const sliderSizes = step.open_size_slider_sizes ?? [2, 2.25, 2.5, 3]
  const isChallenge = step.open_size_correct != null
  const neutralAnswerStart = useMemo(
    () => getNeutralSliderStart(step.open_size_correct ?? 40, 0, 100),
    [step.open_size_correct],
  )
  const [size, setSize] = useState(sliderSizes[Math.floor(sliderSizes.length / 2)])
  const [answer, setAnswer] = useState(neutralAnswerStart)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setSize(sliderSizes[Math.floor(sliderSizes.length / 2)])
    setAnswer(neutralAnswerStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const requiredFold = useMemo(() => bluffBreakEvenFrequency(size, pot) * 100, [size, pot])
  // In challenge mode, the required-fold% tile below IS the answer being asked
  // for — hide the live number until the learner submits, or it hands them
  // the correct value for whatever size they happen to leave the slider at.
  const revealRequiredFold = !isChallenge || submitted

  function submitReveal() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(null, Date.now() - mountTime.current)
  }

  function submitAnswer() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(answer, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="text-center">
          <p className="text-3xl font-black tabular-nums text-violet-300">{size}bb</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">Open size</p>
        </div>

        <div className="space-y-1.5">
          <input
            type="range"
            min={sliderSizes[0]}
            max={sliderSizes[sliderSizes.length - 1]}
            step={0.25}
            value={size}
            disabled={disabled || submitted}
            onChange={(e) => setSize(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
            {sliderSizes.map((s) => <span key={s}>{s}x</span>)}
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <StatTile label="Risk" value={`${size}bb`} color="violet" />
          <StatTile label="Pot won if folds through" value={`${pot}bb`} color="slate" />
          <StatTile label="Break-even fold %" value={revealRequiredFold ? `${requiredFold.toFixed(1)}%` : '?'} color="amber" />
        </div>
      </div>

      {(step.open_size_prompt || isChallenge) && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">
            {step.open_size_prompt ?? 'How often does everyone need to fold for this open to break even immediately?'}
          </p>
        </div>
      )}

      {isChallenge ? (
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-black tabular-nums text-violet-300">{answer}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={answer}
            disabled={disabled || submitted}
            onChange={(e) => setAnswer(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
          />
          <button
            type="button"
            disabled={disabled || submitted}
            onClick={submitAnswer}
            className={cn(
              'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
              submitted || disabled
                ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
                : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
            )}
          >
            {submitted ? 'Submitted' : `Lock in ${answer}%`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || submitted}
          onClick={submitReveal}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            submitted || disabled
              ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
              : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
          )}
        >
          Continue
        </button>
      )}
    </div>
  )
}
