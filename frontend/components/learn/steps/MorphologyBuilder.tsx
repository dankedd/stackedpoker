'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PokerRangeGrid } from '@/components/learn/visuals/PokerRangeGrid'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface MorphologyBuilderProps {
  step: LessonStep
  onAnswer: (response: string | { linear: string[]; polarized: string[] }, timeMs: number) => void
  disabled?: boolean
}

/**
 * 'build': construct a linear range and a polarized range from the same hand pool.
 * 'classify': label a single shown range's shape (uses `options`, scored like any option-based step).
 */
export function MorphologyBuilder({ step, onAnswer, disabled = false }: MorphologyBuilderProps) {
  const mountTime = useRef(Date.now())
  const mode = step.morphology_builder_mode ?? 'classify'

  // ── classify mode ──────────────────────────────────────────────────────────
  const [classifySelected, setClassifySelected] = useState<string | null>(null)

  // ── build mode ─────────────────────────────────────────────────────────────
  const [activeTarget, setActiveTarget] = useState<'linear' | 'polarized'>('linear')
  const [linearSet, setLinearSet] = useState<Set<string>>(new Set())
  const [polarSet, setPolarSet] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setClassifySelected(null)
    setLinearSet(new Set())
    setPolarSet(new Set())
    setActiveTarget('linear')
    setSubmitted(false)
  }, [step.id])

  // Declared unconditionally (before the mode branch below) so hook order
  // never depends on `mode` — this component instance persists across
  // consecutive morphology_builder steps regardless of their mode.
  const rawOptions = step.options ?? []
  const shuffledOptions = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  if (mode === 'classify') {
    const range = step.morphology_builder_range ?? []
    const options = shuffledOptions

    function handleSelect(optionId: string) {
      if (disabled || classifySelected) return
      setClassifySelected(optionId)
      onAnswer(optionId, Date.now() - mountTime.current)
    }

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}

        <div className="max-w-sm mx-auto">
          <PokerRangeGrid range={range} />
        </div>

        {step.morphology_builder_prompt && (
          <p className="text-center text-base font-semibold text-foreground">{step.morphology_builder_prompt}</p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = classifySelected === opt.id
            const hasSelected = classifySelected !== null
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || (hasSelected && !isSelected)}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  'relative rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] border text-center overflow-hidden',
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
      </div>
    )
  }

  // ── build mode ─────────────────────────────────────────────────────────────
  const pool = step.morphology_builder_pool ?? []

  function toggleHand(hand: string) {
    if (disabled || submitted) return
    const setter = activeTarget === 'linear' ? setLinearSet : setPolarSet
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(hand)) next.delete(hand)
      else next.add(hand)
      return next
    })
  }

  function handleSubmit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer({ linear: Array.from(linearSet), polarized: Array.from(polarSet) }, Date.now() - mountTime.current)
  }

  const activeSet = activeTarget === 'linear' ? linearSet : polarSet
  const canSubmit = linearSet.size > 0 && polarSet.size > 0

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.morphology_builder_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.morphology_builder_prompt}</p>
      )}

      {/* Target selector */}
      <div className="flex justify-center gap-2">
        {(['linear', 'polarized'] as const).map((target) => {
          const isActive = activeTarget === target
          const count = target === 'linear' ? linearSet.size : polarSet.size
          return (
            <button
              key={target}
              type="button"
              disabled={disabled || submitted}
              onClick={() => setActiveTarget(target)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide border transition-all duration-150',
                isActive
                  ? target === 'linear'
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-md'
                    : 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-md'
                  : 'border-border/40 bg-secondary/30 text-muted-foreground/50 hover:text-muted-foreground',
              )}
            >
              {target === 'linear' ? 'Range A — Linear' : 'Range B — Polarized'} ({count})
            </button>
          )
        })}
      </div>

      {/* Hand pool — tapping toggles membership in whichever range tab is active */}
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-border/40 bg-card/40 p-4">
        {pool.map((hand) => {
          const inLinear = linearSet.has(hand)
          const inPolar = polarSet.has(hand)
          const inActive = activeSet.has(hand)
          return (
            <button
              key={hand}
              type="button"
              disabled={disabled || submitted}
              onClick={() => toggleHand(hand)}
              className={cn(
                'min-w-[3.25rem] rounded-lg px-2.5 py-2 text-xs font-bold transition-all duration-150 active:scale-95 border relative',
                inActive
                  ? activeTarget === 'linear'
                    ? 'bg-violet-500/70 text-white border-transparent shadow-sm'
                    : 'bg-blue-500/70 text-white border-transparent shadow-sm'
                  : 'border-border/40 bg-secondary/50 text-foreground hover:bg-secondary/80',
              )}
            >
              {hand}
              {/* Small dot indicating membership in the *other* range, for cross-visibility */}
              {activeTarget === 'linear' && inPolar && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-400" />
              )}
              {activeTarget === 'polarized' && inLinear && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-400" />
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled || submitted || !canSubmit}
        onClick={handleSubmit}
        className={cn(
          'group relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200 overflow-hidden',
          submitted || disabled || !canSubmit
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {submitted ? 'Submitted' : canSubmit ? 'Submit both ranges' : 'Build both Range A and Range B'}
      </button>
    </div>
  )
}
