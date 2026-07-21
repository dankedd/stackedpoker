'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

const WORLDS = [
  {
    id: 'low',
    label: 'Low SPR',
    range: 'roughly 0–5',
    color: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    points: [
      'Made hands such as strong top pairs and overpairs become relatively more powerful.',
      'There is less room for complicated future betting.',
      'Speculative hands have less room to profit from implied odds.',
    ],
  },
  {
    id: 'medium',
    label: 'Medium SPR',
    range: 'roughly 6–11',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    points: [
      'Single-pair hands become less dominant.',
      'Suitedness and connectedness become increasingly important.',
    ],
  },
  {
    id: 'high',
    label: 'High SPR',
    range: 'roughly 11+',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    points: [
      'Nut potential becomes extremely important.',
      'Sets, strong straights, high flushes and nut draws gain relative value.',
      'One-pair hands become more difficult to play for very large pots.',
    ],
  },
]

interface SprVisualizerProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

export function SprVisualizer({ step, onAnswer, disabled = false }: SprVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [activeWorld, setActiveWorld] = useState<string>('low')

  useEffect(() => {
    mountTime.current = Date.now()
    setValue('')
    setSubmitted(false)
    setActiveWorld('low')
  }, [step.id])

  const isWorlds = step.spr_visualizer_mode === 'worlds'
  const pot = step.spr_visualizer_pot_bb ?? 10
  const stack = step.spr_visualizer_stack_bb ?? 30

  // Proportional bar widths — both scaled against the larger of the two, capped for readability
  const maxVal = Math.max(pot, stack, 1)
  const potPct = Math.max(8, (pot / maxVal) * 100)
  const stackPct = Math.max(8, (stack / maxVal) * 100)

  function submitScenario() {
    if (disabled || submitted || value === '') return
    setSubmitted(true)
    const elapsed = Date.now() - mountTime.current
    onAnswer(Number(value), elapsed)
  }

  function submitWorlds() {
    if (disabled) return
    const elapsed = Date.now() - mountTime.current
    onAnswer(activeWorld, elapsed)
  }

  if (isWorlds) {
    const world = WORLDS.find((w) => w.id === activeWorld) ?? WORLDS[0]
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {WORLDS.map((w) => (
            <button
              key={w.id}
              type="button"
              disabled={disabled}
              onClick={() => setActiveWorld(w.id)}
              className={cn(
                'rounded-xl border px-3 py-3 text-center transition-all duration-150',
                activeWorld === w.id ? w.color : 'border-border/40 bg-secondary/20 text-muted-foreground/60 hover:bg-secondary/30',
              )}
            >
              <p className="text-xs font-bold">{w.label}</p>
              <p className="text-[10px] opacity-70 mt-0.5">{w.range}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border/30 bg-secondary/10 px-4 py-4 space-y-2">
          {world.points.map((p, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
              <span className="text-violet-400/60 shrink-0">•</span>
              {p}
            </p>
          ))}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={submitWorlds}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Proportional stack / pot bars */}
      <div className="space-y-3 rounded-2xl border border-border/30 bg-secondary/10 px-4 py-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sky-300">Effective stack</span>
            <span className="font-bold text-sky-200 tabular-nums">{stack}bb</span>
          </div>
          <div className="h-3 rounded-full bg-secondary/30 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500" style={{ width: `${stackPct}%` }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300">Pot</span>
            <span className="font-bold text-amber-200 tabular-nums">{pot}bb</span>
          </div>
          <div className="h-3 rounded-full bg-secondary/30 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500" style={{ width: `${potPct}%` }} />
          </div>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-foreground">
        {step.narrative ? 'What is the SPR?' : 'Effective stack ÷ pot — what is the SPR?'}
      </p>

      <div className="flex items-center justify-center gap-3">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          disabled={disabled || submitted}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2.5 text-center text-lg font-bold text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        />
        <button
          type="button"
          disabled={disabled || submitted || value === ''}
          onClick={submitScenario}
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
  )
}
