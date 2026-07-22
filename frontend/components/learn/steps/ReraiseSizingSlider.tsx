'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { calculateCallCost, calculatePotAfterCall, calculateRaiseRisk, computeSPR } from '@/lib/theory/math'

interface ReraiseSizingSliderProps {
  step: LessonStep
  onAnswer: (response: string, timeMs: number) => void
  disabled?: boolean
}

function heroPostedBlind(position?: string): number {
  if (position === 'BB') return 1
  if (position === 'SB') return 0.5
  return 0
}

/** Reraise (3-bet/squeeze) sizing slider — generalizes open_size_explorer to a spot
 *  where a pot already exists from an open (+ optional caller). Live-updates risk,
 *  resulting pot, call cost and approximate SPR as the learner drags through presets. */
export function ReraiseSizingSlider({ step, onAnswer, disabled = false }: ReraiseSizingSliderProps) {
  const mountTime = useRef(Date.now())
  const sizes = step.sizing_slider_sizes ?? []
  const [sizeIndex, setSizeIndex] = useState(Math.floor(sizes.length / 2))
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSizeIndex(Math.floor((step.sizing_slider_sizes?.length ?? 1) / 2))
    setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const raiseTo = sizes[sizeIndex] ?? 0
  const potBeforeRaise = step.sizing_slider_pot ?? 0
  const heroAlreadyIn = heroPostedBlind(step.hero_position)
  const villainsAlreadyIn = [step.sizing_slider_open_size ?? 0, ...(step.sizing_slider_caller_in ? [step.sizing_slider_caller_in] : [])]

  const heroRisk = calculateRaiseRisk(raiseTo, heroAlreadyIn)
  const openerCallCost = calculateCallCost(raiseTo, step.sizing_slider_open_size ?? 0)
  const potIfCalled = calculatePotAfterCall(potBeforeRaise, raiseTo, heroAlreadyIn, villainsAlreadyIn)
  const effectiveStack = step.effective_stack_bb ?? 0
  const spr = computeSPR(Math.max(effectiveStack - heroRisk, 0), potIfCalled)

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  const options = step.options ?? []

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">Reraise to</p>
          <p className="text-2xl font-black text-violet-300">{raiseTo}bb</p>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(sizes.length - 1, 0)}
          step={1}
          value={sizeIndex}
          disabled={disabled || selected !== null}
          onChange={(e) => setSizeIndex(Number(e.target.value))}
          className={cn('w-full accent-violet-500 cursor-pointer', (disabled || selected !== null) && 'opacity-50')}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/30 font-mono">
          {sizes.map((s) => <span key={s}>{s}bb</span>)}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/20 text-center">
          <div>
            <p className="text-sm font-bold text-foreground">{heroRisk.toFixed(1)}bb</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Hero risks</p>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-300">{openerCallCost.toFixed(1)}bb</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Opener's call cost</p>
          </div>
          <div>
            <p className="text-sm font-bold text-blue-300">{potIfCalled.toFixed(1)}bb</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Pot if called</p>
          </div>
          <div>
            <p className="text-sm font-bold text-violet-300">{spr.toFixed(1)}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Approx. flop SPR</p>
          </div>
        </div>
      </div>

      {step.sizing_slider_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.sizing_slider_prompt}</p>
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
