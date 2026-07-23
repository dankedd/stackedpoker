'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import type { FlopDimensionKey } from '@/lib/learn/flopClassifier'

interface FlopClassifyDrillProps {
  step: LessonStep
  onAnswer: (answers: string[], timeMs: number) => void
  disabled?: boolean
}

const DIMENSION_OPTIONS: Record<FlopDimensionKey, { id: string; label: string }[]> = {
  structure: [
    { id: 'trips', label: 'Trips' },
    { id: 'paired', label: 'Paired' },
    { id: 'unpaired', label: 'Unpaired' },
  ],
  texture: [
    { id: 'monotone', label: 'Monotone' },
    { id: 'two_tone', label: 'Two-Tone' },
    { id: 'rainbow', label: 'Rainbow' },
  ],
  two_tone_subtype: [
    { id: 'high_mid', label: 'High-Mid' },
    { id: 'mid_low', label: 'Mid-Low' },
    { id: 'high_low', label: 'High-Low' },
    { id: 'n/a', label: 'N/A (not two-tone)' },
  ],
  highest_rank_family: [
    { id: 'A', label: 'A' },
    { id: 'H', label: 'H (K-Q-J-T)' },
    { id: 'M', label: 'M (9-8-7-6)' },
    { id: 'L', label: 'L (5-4-3-2)' },
  ],
  straight_count: [
    { id: '0', label: '0' },
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
  ],
}

/**
 * Rapid-fire, one-board-at-a-time classification along a single dimension.
 * "Structure Sort," "Family Drill," and "Speed Round" are all this component
 * with a different `flop_classify_drill_dimension` — grading is derived live
 * from `classifyFlop`/`dimensionValue` in the evaluator, never hand-authored.
 */
export function FlopClassifyDrill({ step, onAnswer, disabled = false }: FlopClassifyDrillProps) {
  const mountTime = useRef(Date.now())
  const boards = step.flop_classify_drill_boards ?? []
  const dimension = step.flop_classify_drill_dimension
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setIndex(0)
    setAnswers([])
    setPicked(null)
  }, [step.id])

  const rawOptions = dimension ? DIMENSION_OPTIONS[dimension] : []
  const options = useMemo(() => shuffleBySeed(rawOptions, `${step.id}-${index}`), [rawOptions, step.id, index])

  if (boards.length === 0 || !dimension) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">No drill configured.</p>
  }

  const board = boards[index]
  const isLast = index === boards.length - 1

  function handlePick(optId: string) {
    if (disabled || picked) return
    setPicked(optId)
    const nextAnswers = [...answers, optId]
    setTimeout(() => {
      if (isLast) {
        onAnswer(nextAnswers, Date.now() - mountTime.current)
      } else {
        setAnswers(nextAnswers)
        setIndex((i) => i + 1)
        setPicked(null)
      }
    }, 260)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/50">
        <span>Board {index + 1} of {boards.length}</span>
        <div className="flex gap-1">
          {boards.map((_, i) => (
            <div key={i} className={cn('h-1.5 w-4 rounded-full', i < index ? 'bg-violet-500/70' : i === index ? 'bg-violet-400' : 'bg-white/10')} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {board.map((card, i) => (
          <PlayingCardMini key={i} card={card} size="md" />
        ))}
      </div>

      {step.flop_classify_drill_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.flop_classify_drill_prompt}</p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((opt) => {
          const isSelected = picked === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || picked !== null}
              onClick={() => handlePick(opt.id)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97]',
                isSelected
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                  : picked !== null
                  ? 'border-border/20 bg-secondary/15 text-muted-foreground/30 cursor-default opacity-50'
                  : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
