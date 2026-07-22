'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { calculateSimpleEqR } from '@/lib/theory/math'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'

interface EquityRealizationVisualizerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

function Meter({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' }) {
  const bar = color === 'amber' ? 'bg-amber-500/60' : 'bg-emerald-500/60'
  const text = color === 'amber' ? 'text-amber-300' : 'text-emerald-300'
  return (
    <div className="space-y-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">{label}</p>
      <p className={cn('text-2xl font-black tabular-nums', text)}>{value}%</p>
      <div className="h-3 w-full rounded-full bg-secondary/30 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

const POSITION_PANELS = [
  { title: 'In Position', body: 'Villain checks. Hero can check behind and guarantee seeing another card for free.' },
  { title: 'Out of Position', body: 'Hero checks. Villain bets. Hero may be forced to fold before ever seeing that next card.' },
]

const SPECTRUM_PANELS = [
  { title: 'Very strong', body: 'Comfortably continues and builds the pot — usually realizes its equity well.' },
  { title: 'Medium strength', body: 'Wants to reach showdown, but struggles under pressure — often the hardest hand class to realize.' },
  { title: 'Very weak', body: 'Usually folds quickly to aggression — rarely sticks around long enough to face the realization problem.' },
]

function SPRZoneLabel(spr: number): { label: string; note: string } {
  if (spr <= 3) return { label: 'Low SPR', note: 'Raw equity matters most — most money often goes in with cards still to come.' }
  if (spr <= 10) return { label: 'Medium SPR', note: 'Position and playability start to matter alongside raw equity.' }
  return { label: 'High SPR', note: 'Position, playability, and nut potential dominate — raw equity matters relatively less.' }
}

export function EquityRealizationVisualizer({ step, onAnswer, disabled = false }: EquityRealizationVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const mode = step.equity_realization_mode ?? 'meters'
  const options = step.options ?? []
  const isChallenge = step.equity_realization_correct != null

  const [answer, setAnswer] = useState(50)
  const [sprValue, setSprValue] = useState(6)

  useEffect(() => {
    mountTime.current = Date.now()
    setSubmitted(false)
    setSelected(null)
    setAnswer(50)
    setSprValue(6)
  }, [step.id])

  const raw = step.equity_realization_raw ?? 0
  const captured = step.equity_realization_captured ?? 0
  const eqr = useMemo(() => calculateSimpleEqR(raw, captured) * 100, [raw, captured])

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

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  const realizationLabel =
    eqr > 103 ? 'Over-realization' : eqr < 97 ? 'Under-realization' : 'Full realization'

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {mode === 'meters' && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Meter label="Raw equity" value={raw} color="amber" />
            <Meter label="Actual pot capture" value={captured} color="emerald" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
              Equity realization
            </span>
            <span className="text-xl font-black tabular-nums text-violet-300">{eqr.toFixed(0)}%</span>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50">{realizationLabel}</p>
        </div>
      )}

      {mode === 'calculator' && raw > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
          <Meter label="Raw equity" value={raw} color="amber" />
        </div>
      )}

      {mode === 'position' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POSITION_PANELS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-1.5">
              <p className="text-xs font-bold text-violet-300">{p.title}</p>
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      )}

      {mode === 'spectrum' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SPECTRUM_PANELS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border/40 bg-card/60 p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-violet-300">{p.title}</p>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      )}

      {mode === 'card_compare' && step.equity_realization_hands && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {step.equity_realization_hands.map((h, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-card/60 p-4 text-center space-y-2">
              <p className="text-xs font-bold text-foreground">{h.label}</p>
              <div className="flex items-center justify-center gap-1.5">
                {h.cards.map((c, j) => <PlayingCardMini key={j} card={c} size="md" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'spr_slider' && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
          <div className="text-center">
            <p className="text-2xl font-black tabular-nums text-violet-300">{sprValue.toFixed(0)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">Stack-to-pot ratio</p>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={sprValue}
            disabled={disabled || submitted}
            onChange={(e) => setSprValue(Number(e.target.value))}
            className={cn('w-full accent-violet-500 cursor-pointer', (disabled || submitted) && 'opacity-50')}
          />
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 p-3 text-center space-y-1">
            <p className="text-xs font-bold text-violet-300">{SPRZoneLabel(sprValue).label}</p>
            <p className="text-[11px] text-muted-foreground/60">{SPRZoneLabel(sprValue).note}</p>
          </div>
        </div>
      )}

      {(step.equity_realization_prompt || isChallenge) && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.equity_realization_prompt ?? 'What does this tell us?'}</p>
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
            max={150}
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
      ) : options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                    : [
                        'border-border/50 bg-secondary/40 text-foreground',
                        'hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                      ].join(' ')
                )}
              >
                {opt.label}
              </button>
            )
          })}
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
