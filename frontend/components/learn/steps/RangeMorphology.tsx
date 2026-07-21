'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Lock, Unlock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'

// 6-segment strongest→weakest spectrum, top = strongest
const SHAPE_PATTERNS: Record<string, boolean[]> = {
  linear:    [true, true, true, true, false, false],
  polarized: [true, true, false, false, false, true],
  condensed: [false, false, true, true, true, false],
}

const PLACEHOLDER_LETTERS = ['A', 'B', 'C', 'D']

function SpectrumVisual({ pattern }: { pattern: boolean[] }) {
  return (
    <div className="flex flex-col gap-[3px] w-full">
      {pattern.map((filled, i) => (
        <div
          key={i}
          className={cn(
            'h-2.5 rounded-sm',
            filled ? 'bg-gradient-to-r from-violet-500 to-blue-400' : 'bg-secondary/30 border border-border/20',
          )}
        />
      ))}
    </div>
  )
}

function CeilingVisual({ capped }: { capped: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-[3px] w-full">
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = capped ? i >= 2 : true
        return (
          <div
            key={i}
            className={cn(
              'h-2.5 w-full rounded-sm',
              filled ? 'bg-gradient-to-r from-violet-500 to-blue-400' : 'bg-secondary/20 border border-dashed border-rose-500/40',
            )}
          />
        )
      })}
      <div className="absolute -right-1 top-0 flex items-center gap-0.5">
        {capped ? <Lock className="h-3 w-3 text-rose-400" /> : <Unlock className="h-3 w-3 text-emerald-400" />}
      </div>
    </div>
  )
}

interface RangeMorphologyProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

export function RangeMorphology({ step, onAnswer, disabled = false }: RangeMorphologyProps) {
  const mountTime = useRef(Date.now())
  const elapsedRef = useRef(0)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  // Selecting a diagram reveals labels/correctness locally first — the actual
  // onAnswer (which scores the step and hands off to the feedback screen)
  // only fires once the learner confirms via Continue, so they get a moment
  // to see why the answer was right or wrong without it being revealed early.
  function handleSelect(id: string) {
    if (disabled || selected) return
    setSelected(id)
    elapsedRef.current = Date.now() - mountTime.current
  }

  function handleContinue() {
    if (!selected) return
    onAnswer(selected, elapsedRef.current)
  }

  const options = step.options ?? []
  const hasSelected = selected !== null
  const revealed = disabled || hasSelected
  const cols = options.length === 2 ? 'grid-cols-2' : options.length >= 3 ? 'grid-cols-3' : 'grid-cols-1'
  const correctOption = options.find((o) => o.quality === 'perfect' || o.quality === 'good')

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.range_morphology_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.range_morphology_prompt}</p>
      )}

      <div className={cn('grid gap-3', cols)}>
        {options.map((opt, i) => {
          const isSelected = selected === opt.id
          const isCorrect = opt.quality === 'perfect' || opt.quality === 'good'
          const pattern = SHAPE_PATTERNS[opt.id]
          const isCeiling = opt.id === 'capped' || opt.id === 'uncapped'

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || hasSelected}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-xl border px-3 py-4 transition-all duration-150 active:scale-[0.98] overflow-hidden',
                revealed && isCorrect
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : revealed && isSelected && !isCorrect
                  ? 'border-red-500/40 bg-red-500/10'
                  : revealed && !isSelected
                  ? 'border-border/15 bg-secondary/10 opacity-40'
                  : 'border-border/50 bg-secondary/40 hover:bg-secondary/70 hover:border-violet-500/30'
              )}
            >
              <div className="w-full max-w-[64px]">
                {isCeiling ? (
                  <CeilingVisual capped={opt.id === 'capped'} />
                ) : pattern ? (
                  <SpectrumVisual pattern={pattern} />
                ) : (
                  <div className="h-16" />
                )}
              </div>
              <span className={cn('text-xs font-semibold text-center', revealed ? 'text-foreground' : 'text-muted-foreground/60')}>
                {revealed ? opt.label : `Diagram ${PLACEHOLDER_LETTERS[i] ?? i + 1}`}
              </span>
              {revealed && isCorrect && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-emerald-400" />}
              {revealed && isSelected && !isCorrect && <XCircle className="absolute top-2 right-2 h-4 w-4 text-red-400" />}
            </button>
          )
        })}
      </div>

      {revealed && correctOption && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{correctOption.feedback}</p>
        </div>
      )}

      {!disabled && hasSelected && (
        <button
          type="button"
          onClick={handleContinue}
          className="group relative w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
        >
          Continue
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      )}
    </div>
  )
}
