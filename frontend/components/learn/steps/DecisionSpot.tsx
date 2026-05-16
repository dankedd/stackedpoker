'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface DecisionSpotProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function DecisionSpot({ step, onAnswer, disabled = false }: DecisionSpotProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  // Reset when step changes
  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    const elapsed = Date.now() - mountTime.current
    onAnswer(optionId, elapsed)
  }

  const options = step.options ?? []
  const gridCols =
    options.length === 2
      ? 'grid-cols-2'
      : options.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2'

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Decision prompt */}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
          Your decision
        </p>
        <p className="text-base font-semibold text-foreground">
          {step.type === 'bet_size_choose' ? 'Choose your bet size:' : 'What is your action?'}
        </p>
      </div>

      {/* Action buttons */}
      {options.length > 0 ? (
        <div className={cn('grid gap-3', gridCols)}>
          {options.map(opt => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null

            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-4 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
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
                {/* Selection highlight */}
                {isSelected && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent"
                  />
                )}

                <span className="relative">{opt.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground/40 italic">No options available.</p>
      )}
    </div>
  )
}
