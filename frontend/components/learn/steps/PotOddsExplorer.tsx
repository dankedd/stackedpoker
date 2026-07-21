'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { requiredEquityFromPot } from '@/lib/theory/math'
import { PotDisplay } from '@/components/learn/steps/PotDisplay'

interface PotOddsExplorerProps {
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

export function PotOddsExplorer({ step, onAnswer, disabled = false }: PotOddsExplorerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)

  const mode = step.pot_odds_explorer_mode ?? 'fixed'
  const pot = step.pot_odds_pot ?? step.pot_bb ?? 100
  const sliderSizes = step.pot_odds_slider_sizes ?? [25, 33, 50, 75, 100, 150, 200]

  const [betOverride, setBetOverride] = useState<number>(step.pot_odds_bet ?? sliderSizes[Math.floor(sliderSizes.length / 2)])
  const [answer, setAnswer] = useState(25)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setBetOverride(step.pot_odds_bet ?? sliderSizes[Math.floor(sliderSizes.length / 2)])
    setAnswer(25)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const bet = mode === 'slider' ? betOverride : (step.pot_odds_bet ?? betOverride)
  const call = bet // a call always matches the bet being called
  const finalPot = pot + bet + call
  const requiredEquity = useMemo(() => requiredEquityFromPot(pot + bet, call), [pot, bet, call])

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

  const isNumericChallenge = step.pot_odds_correct != null
  const showCallInDisplay = mode === 'build' || mode === 'challenge' || mode === 'fixed'

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <PotDisplay
          potBefore={pot}
          bet={bet}
          call={showCallInDisplay ? call : undefined}
          finalPotOverride={finalPot}
        />

        <div className="flex items-center gap-2.5 pt-1">
          <StatTile label="Risk" value={String(call)} color="violet" />
          <StatTile label="Reward" value={String(pot + bet)} color="slate" />
          <StatTile label="Required equity" value={`${requiredEquity.toFixed(1)}%`} color="amber" />
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
              {sliderSizes.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground/50">
              Villain&apos;s bet: <span className="font-bold text-foreground">{betOverride}</span> chips
            </p>
          </div>
        )}
      </div>

      {(step.pot_odds_prompt || isNumericChallenge) && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">
            {step.pot_odds_prompt ?? 'What equity does Hero need to break even?'}
          </p>
        </div>
      )}

      {isNumericChallenge ? (
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
