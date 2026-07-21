'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface EquityBalanceProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function EquityBalance({ step, onAnswer, disabled = false }: EquityBalanceProps) {
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

  const required = step.equity_balance_required ?? 0
  const actual = step.equity_balance_actual ?? 0
  const ahead = actual > required
  const options = step.options ?? []
  const maxVal = Math.max(required, actual, 1)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
              Required equity
            </p>
            <p className="text-2xl font-black tabular-nums text-amber-300">{required}%</p>
            <div className="h-24 w-full flex items-end rounded-lg bg-secondary/20 overflow-hidden">
              <div
                className="w-full bg-amber-500/60 transition-all duration-500"
                style={{ height: `${(required / maxVal) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
              Hero&apos;s equity
            </p>
            <p className={cn('text-2xl font-black tabular-nums', ahead ? 'text-emerald-300' : 'text-red-300')}>
              {actual}%
            </p>
            <div className="h-24 w-full flex items-end rounded-lg bg-secondary/20 overflow-hidden">
              <div
                className={cn('w-full transition-all duration-500', ahead ? 'bg-emerald-500/60' : 'bg-red-500/60')}
                style={{ height: `${(actual / maxVal) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <p className={cn('text-center text-xs font-semibold', ahead ? 'text-emerald-300/80' : 'text-red-300/80')}>
          {ahead
            ? `Hero clears the break-even line by ${(actual - required).toFixed(1)} points.`
            : actual === required
            ? 'Hero is exactly at break-even.'
            : `Hero falls short of break-even by ${(required - actual).toFixed(1)} points.`}
        </p>
      </div>

      {step.equity_balance_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.equity_balance_prompt}</p>
        </div>
      )}

      {options.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
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
                  'relative rounded-xl px-4 py-4 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-center overflow-hidden',
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
      )}
    </div>
  )
}
