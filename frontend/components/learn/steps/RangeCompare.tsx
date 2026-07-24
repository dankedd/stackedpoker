'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed, bindVisualOptions } from '@/lib/learn/interactionSafety'

interface RangeCompareProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/** Two 13x13 range grids rendered side-by-side, for range-weight and range-vs-range comparisons. */
export function RangeCompare({ step, onAnswer, disabled = false }: RangeCompareProps) {
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

  const a = step.range_compare_a
  const b = step.range_compare_b
  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])
  const heroHand = step.hero_hand ?? []
  const board = step.board ?? []

  // When both grids name the option that identifies them, bind grid + option into one
  // clickable unit so a "which range is X" answer can never render under the wrong grid —
  // see interactionSafety.bindVisualOptions. Falls back to the legacy separate
  // grid-row + option-list rendering for conceptual questions that aren't a direct
  // per-grid pick (e.g. a question about a trend, or about a single unlabeled range).
  const boundSides = useMemo(() => {
    if (!a || !b) return null
    return bindVisualOptions([a, b], rawOptions, step.id)
  }, [a, b, rawOptions, step.id])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {(heroHand.length > 0 || board.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {heroHand.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero</span>
              <div className="flex gap-1">{heroHand.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
            </div>
          )}
          {board.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Board</span>
              <div className="flex gap-1">{board.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}</div>
            </div>
          )}
        </div>
      )}

      {boundSides ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boundSides.map(({ visual: side, option: opt }) => {
            const isSelected = selected === opt.id
            const hasSelected = selected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'w-full rounded-2xl border p-3 space-y-1.5 text-left transition-all duration-150 active:scale-[0.97] overflow-hidden',
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/15 shadow-lg shadow-violet-900/20'
                    : hasSelected
                    ? 'border-border/20 bg-secondary/15 opacity-50 cursor-default'
                    : [
                        'border-border/40 bg-card/60',
                        'hover:bg-secondary/40 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                      ].join(' ')
                )}
              >
                <p className={cn('text-center text-[10px] font-bold uppercase tracking-[0.15em]', isSelected ? 'text-violet-300' : 'text-violet-400/70')}>
                  {side.label}
                </p>
                <PokerRangeGrid range={side.range} />
                <p className={cn('text-center text-[11px] font-semibold pt-1', isSelected ? 'text-violet-300' : 'text-muted-foreground/50')}>
                  Select {side.label}
                </p>
              </button>
            )
          })}
        </div>
      ) : a && (
        <div className={cn('grid gap-4', b ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-sm mx-auto')}>
          <div className="space-y-1.5">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400/70">
              {a.label}
            </p>
            <PokerRangeGrid range={a.range} />
          </div>
          {b && (
            <div className="space-y-1.5">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400/70">
                {b.label}
              </p>
              <PokerRangeGrid range={b.range} />
            </div>
          )}
        </div>
      )}

      {step.range_compare_prompt && (
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{step.range_compare_prompt}</p>
        </div>
      )}

      {boundSides ? null : options.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  'relative rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-left overflow-hidden',
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
