'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface EVDecisionTreeProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/** Generic EV decision tree: a root action, weighted branches, and the total EV. */
export function EVDecisionTree({ step, onAnswer, disabled = false }: EVDecisionTreeProps) {
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

  function handleContinue() {
    if (disabled || selected) return
    setSelected('__continue__')
    onAnswer('__continue__', Date.now() - mountTime.current)
  }

  const branches = step.ev_tree_branches ?? []
  const total = branches.reduce((sum, b) => sum + b.probability * b.payoff, 0)
  const options = step.options ?? []
  const rootLabel = step.ev_tree_root_label ?? 'ACTION'

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
        <div className="text-center">
          <span className="inline-flex rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-bold text-violet-300 tracking-wide">
            {rootLabel}
          </span>
        </div>

        <div className="space-y-2">
          {branches.map((b, i) => {
            const contribution = b.probability * b.payoff
            const positive = contribution >= 0
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl border border-border/25 bg-secondary/15 px-3 py-2.5 animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-both"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="w-24 shrink-0 text-xs font-bold text-foreground truncate">{b.label}</span>
                <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
                  {(b.probability * 100).toFixed(0)}%
                </span>
                <span className="text-[11px] text-muted-foreground/30">×</span>
                <span className={cn('text-[11px] tabular-nums shrink-0', b.payoff >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                  {b.payoff >= 0 ? '+' : ''}{b.payoff}
                </span>
                <span className="flex-1 text-right text-xs font-bold tabular-nums">
                  <span className={positive ? 'text-emerald-300' : 'text-red-300'}>
                    {contribution >= 0 ? '+' : ''}{contribution.toFixed(1)}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
            Total EV
          </span>
          <span
            className={cn(
              'text-2xl font-black tabular-nums',
              total > 0.01 ? 'text-emerald-300' : total < -0.01 ? 'text-red-300' : 'text-amber-300',
            )}
          >
            {total >= 0 ? '+' : ''}{total.toFixed(1)}
          </span>
        </div>
      </div>

      {step.ev_tree_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.ev_tree_prompt}</p>
        </div>
      )}

      {options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  'relative rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-center overflow-hidden',
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
          onClick={handleContinue}
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
