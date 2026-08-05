'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { orderStepOptions } from '@/lib/learn/interactionSafety'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'

interface RangeCompressionToggleProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/**
 * Module 12 ("One Size Rarely Fits All" / "The Small Cost of Simplifying") — reproduces the
 * book's [0-1] Toy Game Examples A-D (Modern Poker Theory, Ch.10 pp.603-609): a fixed 10-combo
 * pool, toggled across N authored raise-pressure states, each a complete RangeStrategyMap
 * (which bet-size, if any, each combo uses) plus a book-cited EV label.
 *
 * Predict-then-reveal, matching every other Module 10-12 toy-game interaction's contract: the
 * toggle is LOCKED to its first state until the learner answers the `options` prediction
 * question. Answering unlocks free exploration across every state — reused verbatim as
 * `PokerRangeGrid`'s existing 'strategy' mode, zero grid changes required (Part 3A, Section 3.2).
 */
export function RangeCompressionToggle({ step, onAnswer, disabled = false }: RangeCompressionToggleProps) {
  const mountTime = useRef(Date.now())
  const pool = step.range_compression_toggle_pool ?? []
  const states = step.range_compression_toggle_states ?? []

  const [selected, setSelected] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
    setActiveIndex(0)
  }, [step.id])

  const rawOptions = step.options ?? []
  const options = useMemo(() => orderStepOptions(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  if (pool.length === 0 || states.length === 0) {
    return <p className="text-center text-sm text-muted-foreground/40 italic">Range compression data missing.</p>
  }

  const revealed = selected !== null
  const activeState = states[Math.min(activeIndex, states.length - 1)]

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.range_compression_toggle_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.range_compression_toggle_prompt}</p>
      )}

      {/* Toggle tabs — locked to the first state until the learner has answered */}
      <div role="tablist" aria-label="Raise pressure state" className="flex flex-wrap justify-center gap-1.5">
        {states.map((s, i) => {
          const isActive = i === activeIndex
          const isLocked = !revealed && i !== 0
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isLocked}
              disabled={isLocked}
              onClick={() => !isLocked && setActiveIndex(i)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-all',
                isActive
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                  : isLocked
                  ? 'border-border/20 bg-secondary/15 text-muted-foreground/25 cursor-not-allowed'
                  : 'border-border/40 bg-secondary/30 text-muted-foreground/60 hover:text-muted-foreground',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      {!revealed && (
        <p className="text-center text-[10px] text-muted-foreground/40 italic">
          Predict below to unlock the other states
        </p>
      )}
      {/* Screen-reader announcement of the current toggle state (Module 12 architecture, Section 11.2) */}
      <p role="status" aria-live="polite" className="sr-only">
        Showing {activeState.label}. Hero&rsquo;s EV: {activeState.evLabel}.
      </p>

      {/* Range grid — reuses PokerRangeGrid's existing 'strategy' mode unchanged */}
      <PokerRangeGrid
        range={pool}
        mode="strategy"
        strategies={activeState.strategyMap}
        strategySemantics={{ kind: 'complete_strategy' }}
        size="compact"
      />

      {/* EV readout tile */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60 mb-1">
          Hero&rsquo;s EV — {activeState.label}
        </p>
        <p className="text-lg font-black text-violet-200 tabular-nums">{activeState.evLabel}</p>
      </div>

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

      {options.length === 0 && (
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
