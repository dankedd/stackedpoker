'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PotDisplay } from '@/components/learn/steps/PotDisplay'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface DeadMoneyRangeVisualizerProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function DeadMoneyRangeVisualizer({ step, onAnswer, disabled = false }: DeadMoneyRangeVisualizerProps) {
  const mountTime = useRef(Date.now())
  const [anteOn, setAnteOn] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setAnteOn(false)
    setSelected(null)
  }, [step.id])

  const basePot = step.dead_money_pot ?? 1.5
  const ante = step.dead_money_ante_bb ?? 0.6
  const pot = anteOn ? basePot + ante : basePot
  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  function handleContinue() {
    handleSelect('__continue__')
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <PotDisplay potBefore={pot} />

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAnteOn(false)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-xs font-bold border transition-all duration-150',
              !anteOn ? 'border-violet-500/50 bg-violet-500/20 text-violet-200' : 'border-border/30 bg-secondary/30 text-muted-foreground',
            )}
          >
            No ante
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAnteOn(true)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-xs font-bold border transition-all duration-150',
              anteOn ? 'border-violet-500/50 bg-violet-500/20 text-violet-200' : 'border-border/30 bg-secondary/30 text-muted-foreground',
            )}
          >
            + Ante ({ante}bb)
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/50">
          {anteOn
            ? `The ante adds ${ante}bb of dead money — more reward available before Hero risks a single chip.`
            : 'No ante — the only reward available is the blinds themselves.'}
        </p>
      </div>

      {step.dead_money_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.dead_money_prompt}</p>
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
