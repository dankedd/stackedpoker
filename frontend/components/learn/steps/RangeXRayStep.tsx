'use client'

import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { orderStepOptions } from '@/lib/learn/interactionSafety'
import { RangeXRay } from '@/components/learn/visuals/RangeXRay'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { RangeExplanationCallout } from '@/components/poker/RangeExplanationCallout'

interface RangeXRayStepProps {
  step: LessonStep
  onAnswer: (response: unknown, timeMs: number) => void
  disabled?: boolean
}

/** Step wrapper around the reusable `RangeXRay` visual — narrative, board, the
 *  bucket bars, and an optional follow-up options question underneath. */
export function RangeXRayStep({ step, onAnswer, disabled = false }: RangeXRayStepProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)
  const board = step.range_xray_board ?? step.board

  const rawOptions = step.options ?? []
  const options = useMemo(() => orderStepOptions(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  if (!step.range_xray_entries || step.range_xray_entries.length === 0) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Range X-Ray data missing.</p>
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Prose/controls stay at a normal reading width even though this step type widens
       *  the outer lesson container — only the RangeXRay box (below) needs the room, and
       *  its own mini grid self-caps via PokerRangeGrid's size prop regardless. */}
      <div className="max-w-2xl mx-auto w-full space-y-5">
        {board && board.length > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <RangeXRay
          entries={step.range_xray_entries}
          grid={step.range_xray_grid}
          board={board}
        />
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-5">
        {step.narrative && <RangeExplanationCallout>{step.narrative}</RangeExplanationCallout>}

        {step.range_xray_prompt && (
          <p className="text-center text-base font-semibold text-foreground">{step.range_xray_prompt}</p>
        )}

        {options.length > 0 && (
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
                      : 'border-border/50 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-violet-500/30',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
