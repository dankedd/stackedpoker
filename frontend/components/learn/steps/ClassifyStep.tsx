'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep, StepType } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'

const STEP_PROMPTS: Partial<Record<StepType, string>> = {
  board_classify:  'How would you classify this board?',
  nut_advantage:   'Who has the nut advantage?',
  blocker_id:      'Which holding acts as a blocker here?',
  range_identify:  'What range is villain most likely on?',
  bluff_pick:      'Which hand makes the best bluff candidate?',
}

interface ClassifyStepProps {
  step: LessonStep
  onAnswer: (answer: string, timeMs: number) => void
  disabled?: boolean
}

export function ClassifyStep({ step, onAnswer, disabled = false }: ClassifyStepProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected !== null) return
    setSelected(optionId)
    const elapsed = Date.now() - mountTime.current
    onAnswer(optionId, elapsed)
  }

  const options  = step.options ?? []
  const prompt   = STEP_PROMPTS[step.type] ?? 'What is your assessment?'
  const hasSelected = selected !== null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Narrative */}
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Board cards */}
      {step.board && step.board.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40 shrink-0">
            Board
          </span>
          <div className="flex gap-1.5">
            {step.board.map((card, i) => (
              <PlayingCardMini key={i} card={card} size="md" />
            ))}
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">
          {step.type.replace(/_/g, ' ')}
        </p>
        <p className="text-base font-semibold text-foreground">{prompt}</p>
      </div>

      {/* Options — vertical list */}
      {options.length > 0 ? (
        <div className="space-y-2.5">
          {options.map((opt, i) => {
            const isSelected    = selected === opt.id
            const isCorrect     = opt.quality === 'perfect' || opt.quality === 'good'
            const showResult    = disabled && hasSelected
            const letter        = String.fromCharCode(65 + i) // A, B, C…

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
                  // After reveal
                  showResult && isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : showResult && isSelected && !isCorrect
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : showResult && !isSelected
                    ? 'border-border/15 bg-secondary/10 text-muted-foreground/25 cursor-default opacity-40'
                    // Before reveal
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
                {/* Inlay gradient on selected */}
                {(isSelected || (showResult && isCorrect)) && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/5 to-transparent"
                  />
                )}

                {/* Letter badge */}
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

                {/* Correctness icon after reveal */}
                {showResult && isCorrect && (
                  <CheckCircle2 className="relative h-4 w-4 text-emerald-400 shrink-0" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle className="relative h-4 w-4 text-red-400 shrink-0" />
                )}
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
