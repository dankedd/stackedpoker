'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface StrategyComplexityMeterProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

const PANELS = [
  {
    title: 'Simple',
    subtitle: 'Raise / Fold',
    bullets: ['Two decisions to remember', 'Easy to execute consistently under pressure', 'Lower theoretical ceiling'],
  },
  {
    title: 'Complex',
    subtitle: 'Limp / Raise / Shove / Fold, mixed frequencies',
    bullets: ['More available options and higher theoretical EV', 'Easy to misremember or misapply live', 'Mistakes here can cost more than the simpler plan gains'],
  },
]

export function StrategyComplexityMeter({ step, onAnswer, disabled = false }: StrategyComplexityMeterProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PANELS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-2">
            <div>
              <p className="text-sm font-bold text-violet-300">{p.title}</p>
              <p className="text-[11px] text-muted-foreground/50">{p.subtitle}</p>
            </div>
            <ul className="space-y-1">
              {p.bullets.map((b) => (
                <li key={b} className="text-[11px] text-muted-foreground/70 leading-relaxed flex gap-1.5">
                  <span className="text-violet-400/60">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {step.strategy_complexity_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.strategy_complexity_prompt}</p>
        </div>
      )}

      {options.length > 0 ? (
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
          disabled={disabled || selected !== null}
          onClick={() => handleSelect('__continue__')}
          className={cn(
            'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
            selected !== null || disabled
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
