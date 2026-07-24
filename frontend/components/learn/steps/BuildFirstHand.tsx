'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCard } from '@/components/poker/PlayingCard'
import { TABLE_FELT_CLASS, TABLE_FELT_STYLE } from '@/components/learn/visuals/OnboardingTable'

interface BuildFirstHandProps {
  step: LessonStep
  onAnswer: (selectedCards: string[], timeMs: number) => void
  disabled?: boolean
}

const TARGET_SIZE = 5

/**
 * Lesson 1, Step 3 — "Build Your First Hand". All 7 cards (Hero's 2 hole cards
 * + the 5-card board) are shown face-up. The learner taps the 5 that form
 * Hero's best hand; on submit, the correct 5-card hand visually gathers into
 * one row and the "best 5 of 7" rule is explained.
 */
export function BuildFirstHand({ step, onAnswer, disabled = false }: BuildFirstHandProps) {
  const mountTime = useRef(Date.now())
  const heroCards = step.hero_hand ?? []
  const boardCards = step.board ?? []
  const correctHand = step.build_first_hand_correct ?? []

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'select' | 'reviewed'>('select')

  useEffect(() => {
    mountTime.current = Date.now()
    setSelected(new Set())
    setPhase('select')
  }, [step.id])

  const arranging = phase === 'select' && !disabled

  function toggleCard(card: string) {
    if (!arranging) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(card)) {
        next.delete(card)
      } else if (next.size < TARGET_SIZE) {
        next.add(card)
      }
      return next
    })
  }

  function handleCheck() {
    if (selected.size !== TARGET_SIZE || !arranging) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer([...selected], Date.now() - mountTime.current)
  }

  const correctCount = correctHand.filter((c) => selected.has(c)).length
  const allCorrect = phase === 'reviewed' && correctCount === correctHand.length && selected.size === correctHand.length

  function cardButton(card: string, group: 'hero' | 'board') {
    const isSelected = selected.has(card)
    const isCorrect = correctHand.includes(card)
    const showCorrectRing = phase === 'reviewed' && isSelected && isCorrect
    const showWrongRing = phase === 'reviewed' && isSelected && !isCorrect
    const showMissedRing = phase === 'reviewed' && !isSelected && isCorrect

    return (
      <button
        key={`${group}-${card}`}
        type="button"
        disabled={!arranging}
        onClick={() => toggleCard(card)}
        aria-pressed={isSelected}
        aria-label={`Card ${card}`}
        className={cn(
          'relative rounded-[8px] transition-all duration-200 disabled:cursor-default',
          arranging && 'hover:-translate-y-1',
          phase === 'select' && isSelected && 'ring-2 ring-violet-400 ring-offset-2 ring-offset-background',
          showCorrectRing && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background',
          showWrongRing && 'ring-2 ring-red-400 ring-offset-2 ring-offset-background',
          showMissedRing && 'ring-2 ring-dashed ring-amber-400/70 ring-offset-2 ring-offset-background',
          phase === 'reviewed' && !isSelected && !isCorrect && 'opacity-40',
        )}
      >
        <PlayingCard card={card} size="md" />
      </button>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-center text-sm font-semibold text-foreground">
        {step.build_first_hand_prompt ?? "Tap the 5 cards that make Hero's best possible poker hand."}
      </p>

      <div className={cn(TABLE_FELT_CLASS, 'p-5 sm:p-7')} style={TABLE_FELT_STYLE}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400/60">Your cards</span>
          <div className="flex gap-2.5">{heroCards.map((c) => cardButton(c, 'hero'))}</div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300/60">Community cards</span>
          <div className="flex gap-2">{boardCards.map((c) => cardButton(c, 'board'))}</div>
        </div>
      </div>

      {phase === 'select' && (
        <button
          type="button"
          disabled={selected.size !== TARGET_SIZE || disabled}
          onClick={handleCheck}
          className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
        >
          {selected.size === TARGET_SIZE ? 'Check' : `Select ${TARGET_SIZE - selected.size} more`}
        </button>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className={cn('text-center text-sm font-semibold', allCorrect ? 'text-emerald-400' : 'text-amber-400')}>
            {allCorrect ? "Exactly right — that's Hero's best hand." : `${correctCount} of ${correctHand.length} correct.`}
          </p>

          {/* Gathered final hand */}
          <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Hero&apos;s final hand</span>
            <div className="flex gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
              {correctHand.map((c) => (
                <PlayingCard key={c} card={c} size="sm" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3.5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.concept_content ??
                "Your final poker hand uses the best 5-card combination available from your 2 hole cards and the 5 community cards."}
            </p>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleContinue}
            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
