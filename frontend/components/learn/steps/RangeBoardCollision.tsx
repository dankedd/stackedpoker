'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { totalBlockedCombos } from '@/lib/learn/combos'

interface RangeBoardCollisionProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/**
 * Two named ranges against one flop, with a real (not fabricated) card-removal
 * readout underneath each grid — how many combos each range loses because the
 * board's own cards block them. This is the honest, computable half of
 * "range meets board": no hand-evaluator exists to fake made/draw/miss splits,
 * so this teaches card removal concretely instead of inventing equity numbers.
 */
export function RangeBoardCollision({ step, onAnswer, disabled = false }: RangeBoardCollisionProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  function handleSelect(id: string) {
    if (disabled || selected) return
    setSelected(id)
    onAnswer(id, Date.now() - mountTime.current)
  }

  const a = step.range_board_collision_a
  const b = step.range_board_collision_b
  const board = step.board ?? []
  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])
  const hasSelected = selected !== null

  const statsA = a ? totalBlockedCombos(a.range, board) : null
  const statsB = b ? totalBlockedCombos(b.range, board) : null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {board.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          {board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
        </div>
      )}

      {a && (
        <div className={cn('grid gap-4', b ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-sm mx-auto')}>
          <div className="space-y-1.5">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400/70">{a.label}</p>
            <PokerRangeGrid range={a.range} />
            {statsA && (
              <p className="text-center text-[10px] text-muted-foreground/50">
                {statsA.total} combos → <span className="text-violet-300/80 font-semibold">{statsA.remaining}</span> remain after removal
                {statsA.blocked > 0 && ` (${statsA.blocked} blocked by the board)`}
              </p>
            )}
          </div>
          {b && (
            <div className="space-y-1.5">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400/70">{b.label}</p>
              <PokerRangeGrid range={b.range} />
              {statsB && (
                <p className="text-center text-[10px] text-muted-foreground/50">
                  {statsB.total} combos → <span className="text-blue-300/80 font-semibold">{statsB.remaining}</span> remain after removal
                  {statsB.blocked > 0 && ` (${statsB.blocked} blocked by the board)`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {step.range_board_collision_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.range_board_collision_prompt}</p>
      )}

      {options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const isSelected = selected === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
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
