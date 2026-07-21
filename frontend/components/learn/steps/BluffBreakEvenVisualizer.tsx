'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { bluffBreakEvenFrequency } from '@/lib/theory/math'
import { PotDisplay } from '@/components/learn/steps/PotDisplay'

interface BluffBreakEvenVisualizerProps {
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

export function BluffBreakEvenVisualizer({ step, onAnswer, disabled = false }: BluffBreakEvenVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)

  const mode = step.bluff_breakeven_mode ?? 'challenge'
  const pot = step.bluff_breakeven_pot ?? step.pot_bb ?? 100
  const sliderSizes = step.bluff_breakeven_slider_sizes ?? [25, 50, 75, 100, 150, 200]
  const compare = step.bluff_breakeven_compare ?? []
  const options = step.options ?? []

  const [betOverride, setBetOverride] = useState<number>(step.bluff_breakeven_bet ?? sliderSizes[Math.floor(sliderSizes.length / 2)])
  const [answer, setAnswer] = useState(50)
  const [selectedCompare, setSelectedCompare] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setBetOverride(step.bluff_breakeven_bet ?? sliderSizes[Math.floor(sliderSizes.length / 2)])
    setAnswer(50)
    setSelectedCompare(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const bet = mode === 'slider' ? betOverride : (step.bluff_breakeven_bet ?? betOverride)
  const requiredFold = useMemo(() => bluffBreakEvenFrequency(bet, pot) * 100, [bet, pot])

  const isChallenge = step.bluff_breakeven_correct != null

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

  function submitCompare(optionId: string) {
    if (disabled || selectedCompare) return
    setSelectedCompare(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {mode === 'predict_compare' && compare.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {compare.map((c, i) => {
            const opt = options[i]
            const isSelected = selectedCompare === opt?.id
            const hasSelected = selectedCompare !== null
            return (
              <button
                key={i}
                type="button"
                disabled={disabled || !opt || (hasSelected && !isSelected)}
                onClick={() => opt && submitCompare(opt.id)}
                className={cn(
                  'rounded-2xl border p-4 text-center transition-all duration-150 active:scale-[0.98]',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15'
                    : hasSelected
                    ? 'border-border/15 bg-secondary/10 opacity-40 cursor-default'
                    : 'border-border/40 bg-secondary/30 hover:bg-secondary/50 hover:border-violet-500/25',
                )}
              >
                <p className="text-xs font-bold text-foreground mb-2">{c.label}</p>
                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
                  <span>Pot {c.pot}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>Bet {c.bet}</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
          <PotDisplay potBefore={pot} bet={bet} />

          <div className="flex items-center gap-2.5 pt-1">
            <StatTile label="Risk" value={String(bet)} color="violet" />
            <StatTile label="Reward" value={String(pot)} color="slate" />
            <StatTile label="Required fold %" value={`${requiredFold.toFixed(1)}%`} color="amber" />
          </div>

          {mode === 'slider' && (
            <div className="space-y-1.5 pt-2 border-t border-border/20">
              <input
                type="range"
                min={sliderSizes[0]}
                max={sliderSizes[sliderSizes.length - 1]}
                step={1}
                value={betOverride}
                disabled={disabled || submitted}
                onChange={(e) => setBetOverride(Number(e.target.value))}
                className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
                {sliderSizes.map((s) => <span key={s}>{s}</span>)}
              </div>
              <p className="text-center text-[11px] text-muted-foreground/50">
                Hero&apos;s bluff: <span className="font-bold text-foreground">{betOverride}</span> chips
              </p>
            </div>
          )}
        </div>
      )}

      {(step.bluff_breakeven_prompt || isChallenge) && mode !== 'predict_compare' && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">
            {step.bluff_breakeven_prompt ?? 'How often must Villain fold for this to break even?'}
          </p>
        </div>
      )}

      {mode === 'predict_compare' ? null : isChallenge ? (
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
