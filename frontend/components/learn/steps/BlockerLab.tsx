'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { canonicalCombo, rangeBlockerBreakdown, totalBlockedCombos } from '@/lib/learn/combos'

interface BlockerLabProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  disabled?: boolean
}

/** Card-removal comparison: swap through candidate holdings and watch which
 *  villain combos get blocked from the given continuing range. */
export function BlockerLab({ step, onAnswer, disabled = false }: BlockerLabProps) {
  const mountTime = useRef(Date.now())
  const candidates = step.blocker_lab_candidates ?? []
  const villainRange = step.blocker_lab_villain_range ?? []
  const options = step.options ?? []

  const [activeCandidate, setActiveCandidate] = useState(candidates[0] ?? '')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setActiveCandidate(candidates[0] ?? '')
    setSelected(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function handleSelect(optionId: string) {
    if (disabled || selected) return
    setSelected(optionId)
    onAnswer(optionId, Date.now() - mountTime.current)
  }

  const heroCards = activeCandidate ? canonicalCombo(activeCandidate) : null
  const totals = heroCards ? totalBlockedCombos(villainRange, heroCards) : { total: 0, remaining: 0, blocked: 0 }
  const breakdown = heroCards ? rangeBlockerBreakdown(villainRange, heroCards) : []
  const mostBlocked = [...breakdown].sort((a, b) => b.blockedCombos - a.blockedCombos).slice(0, 4).filter((b) => b.blockedCombos > 0)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Candidate switcher */}
      <div className="flex flex-wrap justify-center gap-2">
        {candidates.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCandidate(c)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-bold border transition-all duration-150',
              activeCandidate === c
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-md'
                : 'border-border/40 bg-secondary/30 text-muted-foreground/60 hover:text-muted-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Hero's exact cards */}
      {heroCards && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero holds</span>
          <div className="flex gap-1">
            <PlayingCardMini card={heroCards[0]} size="md" />
            <PlayingCardMini card={heroCards[1]} size="md" />
          </div>
        </div>
      )}

      {/* Combo removal summary */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-around text-center">
          <div>
            <p className="text-lg font-black text-foreground">{totals.total}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Total combos</p>
          </div>
          <div>
            <p className="text-lg font-black text-rose-400">-{totals.blocked}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Blocked</p>
          </div>
          <div>
            <p className="text-lg font-black text-violet-300">{totals.remaining}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Still continuing</p>
          </div>
        </div>

        {mostBlocked.length > 0 && (
          <div className="border-t border-border/20 pt-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/40 text-center">
              Combos removed by this holding
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {mostBlocked.map((b) => (
                <span
                  key={b.hand}
                  className="rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[10px] font-semibold text-rose-300"
                >
                  {b.hand}: {b.remainingCombos}/{b.totalCombos}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {step.blocker_lab_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.blocker_lab_prompt}</p>
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
  )
}
