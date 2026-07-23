'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface SuitIsomorphismProps {
  step: LessonStep
  onAnswer: (optionId: string, timeMs: number) => void
  onComplete: () => void
  disabled?: boolean
}

/**
 * 'explain' mode: an unscored walkthrough of why 22,100 specific flops
 * collapse to 1,755 strategically unique ones — suit LABELS don't matter,
 * only the PATTERN of which cards share a suit does.
 * 'sort' mode: two boards, judge whether they share the same suit pattern —
 * scored via `options` (evalOptionBased).
 */
export function SuitIsomorphism({ step, onAnswer, onComplete, disabled = false }: SuitIsomorphismProps) {
  const mountTime = useRef(Date.now())
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(null)
  }, [step.id])

  const rawOptions = step.options ?? []
  const options = useMemo(() => shuffleBySeed(rawOptions, step.id), [rawOptions, step.id])

  function handleSelect(id: string) {
    if (disabled || selected) return
    setSelected(id)
    onAnswer(id, Date.now() - mountTime.current)
  }

  if (step.suit_isomorphism_mode === 'explain') {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step.narrative && (
          <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-6">
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Specific Flops</p>
            <p className="text-3xl font-extrabold text-foreground">22,100</p>
            <p className="text-[11px] text-muted-foreground/60">every exact card combination</p>
          </div>
          <ChevronRight className="h-6 w-6 text-violet-400/60 shrink-0" />
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300/70">Strategic Patterns</p>
            <p className="text-3xl font-extrabold text-violet-300">1,755</p>
            <p className="text-[11px] text-muted-foreground/60">unique suit relationships</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-secondary/10 px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">A♠K♠7♦</span> and <span className="font-semibold text-foreground">A♣K♣7♥</span> are
            different exact flops, but strategically identical — both are "two cards of one suit, one card of a different suit," with the same
            ranks. Swapping which physical suit plays which role never changes how the flop plays. That's suit isomorphism, and it's why this
            module classifies by <em>pattern</em> instead of memorizing exact boards.
          </p>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
        >
          Continue
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    )
  }

  // 'sort' mode
  const boardA = step.suit_isomorphism_board_a ?? []
  const boardB = step.suit_isomorphism_board_b ?? []
  const hasSelected = selected !== null

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board A</p>
          <div className="flex items-center justify-center gap-1.5">
            {boardA.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
        </div>
        <div className="space-y-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Board B</p>
          <div className="flex items-center justify-center gap-1.5">
            {boardB.map((c, i) => <PlayingCardMini key={i} card={c} size="md" />)}
          </div>
        </div>
      </div>

      {step.suit_isomorphism_prompt && (
        <p className="text-center text-sm font-semibold text-foreground">{step.suit_isomorphism_prompt}</p>
      )}

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
    </div>
  )
}
