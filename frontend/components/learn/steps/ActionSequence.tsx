'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

interface ActionSequenceProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function ActionSequence({ step, onAnswer, disabled = false }: ActionSequenceProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(0)

  const lines = step.action_sequence_display ?? []

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
    setRevealed(0)
    if (lines.length === 0) return
    const timers = lines.map((_, i) => setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 220 * (i + 1)))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    const elapsed = Date.now() - mountTime.current
    onAnswer(optionId, elapsed)
  }

  const options = step.options ?? []
  const hasSelected = selected !== null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Animated action-line timeline */}
      {lines.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-secondary/10 px-4 py-5 space-y-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 transition-all duration-300',
                i < revealed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">
                {i + 1}
              </span>
              <span className="text-sm font-mono text-foreground/90">{line}</span>
            </div>
          ))}
        </div>
      )}

      {step.action_sequence_prompt && (
        <p className="text-center text-base font-semibold text-foreground">
          {step.action_sequence_prompt}
        </p>
      )}

      {options.length > 0 && (
        <div className="space-y-2.5">
          {options.map((opt, i) => {
            const isSelected = selected === opt.id
            const isCorrect = opt.quality === 'perfect' || opt.quality === 'good'
            const showResult = disabled && hasSelected
            const letter = String.fromCharCode(65 + i)

            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'w-full relative rounded-xl px-4 py-3.5 text-sm font-medium',
                  'transition-all duration-150 active:scale-[0.99] border text-left overflow-hidden',
                  'flex items-center gap-3',
                  showResult && isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : showResult && isSelected && !isCorrect
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : showResult && !isSelected
                    ? 'border-border/15 bg-secondary/10 text-muted-foreground/25 cursor-default opacity-40'
                    : isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/15 bg-secondary/10 text-muted-foreground/25 cursor-default opacity-40'
                    : [
                        'border-border/50 bg-secondary/40 text-foreground',
                        'hover:bg-secondary/70 hover:border-violet-500/30 hover:shadow-md hover:shadow-violet-900/10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                      ].join(' ')
                )}
              >
                <span
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors',
                    showResult && isCorrect
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : showResult && isSelected && !isCorrect
                      ? 'bg-red-500/20 text-red-400'
                      : isSelected
                      ? 'bg-violet-500/30 text-violet-300'
                      : hasSelected
                      ? 'bg-secondary/30 text-muted-foreground/20'
                      : 'bg-secondary/60 text-muted-foreground/60'
                  )}
                >
                  {letter}
                </span>
                <span className="relative flex-1">{opt.label}</span>
                {showResult && isCorrect && <CheckCircle2 className="relative h-4 w-4 text-emerald-400 shrink-0" />}
                {showResult && isSelected && !isCorrect && <XCircle className="relative h-4 w-4 text-red-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
