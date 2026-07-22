'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { resistanceRisk } from '@/lib/learn/preflopBaselines'
import { getNeutralSliderStart } from '@/lib/learn/interactionSafety'

interface PlayersBehindVisualizerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

function riskLabel(risk: number): { label: string; color: string } {
  if (risk < 0.25) return { label: 'Low', color: 'text-emerald-300' }
  if (risk < 0.5) return { label: 'Medium', color: 'text-amber-300' }
  return { label: 'High', color: 'text-red-300' }
}

export function PlayersBehindVisualizer({ step, onAnswer, disabled = false }: PlayersBehindVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)

  const presetRange = step.players_behind_range ?? [1, 2, 3, 4, 5, 6, 7, 8]
  const isChallenge = step.players_behind_correct != null
  const neutralAnswerStart = useMemo(
    () => getNeutralSliderStart(step.players_behind_correct ?? 50, 0, 100),
    [step.players_behind_correct],
  )
  const [count, setCount] = useState(step.players_behind ?? presetRange[Math.floor(presetRange.length / 2)])
  const [answer, setAnswer] = useState(neutralAnswerStart)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setCount(step.players_behind ?? presetRange[Math.floor(presetRange.length / 2)])
    setAnswer(neutralAnswerStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const risk = useMemo(() => resistanceRisk(count) * 100, [count])
  const { label, color } = riskLabel(risk / 100)
  // In challenge mode, this readout IS the answer being asked for — hide it
  // until submission, or it hands the learner the correct value for whatever
  // count they happen to leave the exploration slider at.
  const revealRisk = !isChallenge || submitted

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
        {/* Face-down opponent row */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="flex h-9 w-7 items-center justify-center rounded-md border border-border/50 bg-secondary/60 text-[10px] font-bold text-muted-foreground/40 animate-in fade-in zoom-in-95 duration-300 fill-mode-both"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              ?
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <input
            type="range"
            min={presetRange[0]}
            max={presetRange[presetRange.length - 1]}
            step={1}
            value={count}
            disabled={disabled || submitted}
            onChange={(e) => setCount(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
            {presetRange.map((p) => <span key={p}>{p}</span>)}
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50">
            <span className="font-bold text-foreground">{count}</span> player{count !== 1 ? 's' : ''} still to act behind Hero
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
            Resistance risk
          </span>
          <span className={cn('text-lg font-black tabular-nums', color)}>
            {revealRisk ? `${label} (${risk.toFixed(0)}%)` : '?'}
          </span>
        </div>
        <p className="text-center text-[9px] text-muted-foreground/30">
          Simplified illustrative model — assumes ~8% of hands are 3-bet quality, not a claimed real frequency.
        </p>
      </div>

      {(step.players_behind_prompt || isChallenge) && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">
            {step.players_behind_prompt ?? 'Approximately how much resistance risk is there?'}
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
            step={1}
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
