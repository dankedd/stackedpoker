'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCard } from '@/components/poker/PlayingCard'
import { TABLE_FELT_CLASS, TABLE_FELT_STYLE } from '@/components/learn/visuals/OnboardingTable'

interface CardsIdentifyProps {
  step: LessonStep
  onAnswer: (selectedCardIds: string[], timeMs: number) => void
  disabled?: boolean
}

const COMMUNITY_COUNT = 5
const DEFAULT_HERO_HAND = ['Kc', '9d']

/**
 * Lesson 1, Step 2 — "Your Cards vs. the Board". Hero's 2 hole cards deal in
 * face-up, then 5 face-down community placeholders deal into the center. The
 * learner taps the 2 cards that belong only to Hero; on submit, the community
 * placeholders highlight as a group so the private-vs-shared split is visual,
 * not just read.
 */
export function CardsIdentify({ step, onAnswer, disabled = false }: CardsIdentifyProps) {
  const mountTime = useRef(Date.now())
  const heroCards = step.hero_hand ?? DEFAULT_HERO_HAND
  const communityIds = useMemo(
    () => Array.from({ length: COMMUNITY_COUNT }, (_, i) => `community-${i}`),
    [],
  )

  const [communityDealt, setCommunityDealt] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<'select' | 'reviewed'>('select')

  useEffect(() => {
    mountTime.current = Date.now()
    setCommunityDealt(false)
    setSelected(new Set())
    setPhase('select')
    const t = setTimeout(() => setCommunityDealt(true), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const arranging = phase === 'select' && !disabled && communityDealt

  function toggleCard(id: string) {
    if (!arranging) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 2) {
        next.add(id)
      }
      return next
    })
  }

  function handleCheck() {
    if (selected.size !== 2 || !arranging) return
    setPhase('reviewed')
  }

  function handleContinue() {
    if (disabled) return
    onAnswer([...selected], Date.now() - mountTime.current)
  }

  const heroCorrectCount = heroCards.filter((c) => selected.has(c)).length
  const allCorrect = phase === 'reviewed' && heroCorrectCount === heroCards.length && selected.size === heroCards.length

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-center text-sm font-semibold text-foreground">
        {step.cards_identify_prompt ?? 'Tap the 2 cards that belong only to you.'}
      </p>

      <div className={cn(TABLE_FELT_CLASS, 'p-5 sm:p-7')} style={TABLE_FELT_STYLE}>
        {/* Hero's hole cards */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400/60">
            {phase === 'reviewed' ? 'Your cards' : 'Dealt to you'}
          </span>
          <div className="flex gap-2.5">
            {heroCards.map((card) => {
              const isSelected = selected.has(card)
              const isCorrect = phase === 'reviewed' && isSelected
              return (
                <button
                  key={card}
                  type="button"
                  disabled={!arranging}
                  onClick={() => toggleCard(card)}
                  aria-pressed={isSelected}
                  aria-label={`Hole card ${card}`}
                  className={cn(
                    'relative rounded-[8px] transition-all duration-200 disabled:cursor-default',
                    arranging && 'hover:-translate-y-1',
                    phase === 'select' && isSelected && 'ring-2 ring-violet-400 ring-offset-2 ring-offset-background',
                    phase === 'reviewed' && isCorrect && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background',
                    phase === 'reviewed' && !isSelected && 'opacity-50',
                  )}
                >
                  <PlayingCard card={card} size="md" />
                  {phase === 'reviewed' && isCorrect && (
                    <CheckCircle2 className="absolute -top-2 -right-2 h-5 w-5 text-emerald-400 bg-background rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Community placeholders */}
        <div className="flex flex-col items-center gap-2">
          <span
            className={cn(
              'text-[9px] font-bold uppercase tracking-[0.2em] transition-colors duration-500',
              phase === 'reviewed' ? 'text-amber-300/80' : 'text-muted-foreground/40',
            )}
          >
            {communityDealt ? 'Community cards' : ''}
          </span>
          <div className="flex gap-2">
            {communityIds.map((id, i) => {
              const isWronglySelected = selected.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!arranging}
                  onClick={() => toggleCard(id)}
                  aria-pressed={isWronglySelected}
                  aria-label="Community card"
                  className={cn(
                    'relative rounded-[8px] transition-all duration-200 disabled:cursor-default',
                    !communityDealt && 'opacity-0 translate-y-2',
                    communityDealt && 'opacity-100 translate-y-0',
                    arranging && 'hover:-translate-y-1',
                    phase === 'select' && isWronglySelected && 'ring-2 ring-violet-400 ring-offset-2 ring-offset-background',
                    phase === 'reviewed' && isWronglySelected && 'ring-2 ring-red-400 ring-offset-2 ring-offset-background',
                    phase === 'reviewed' && 'shadow-[0_0_16px_rgba(251,191,36,0.25)]',
                  )}
                  style={{ transitionDelay: communityDealt ? `${i * 70}ms` : undefined }}
                >
                  <PlayingCard card="" size="md" />
                  {phase === 'reviewed' && isWronglySelected && (
                    <XCircle className="absolute -top-2 -right-2 h-5 w-5 text-red-400 bg-background rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {phase === 'select' && (
        <button
          type="button"
          disabled={selected.size !== 2 || disabled}
          onClick={handleCheck}
          className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
        >
          {selected.size === 2 ? 'Check' : `Select ${2 - selected.size} more`}
        </button>
      )}

      {phase === 'reviewed' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className={cn('text-center text-sm font-semibold', allCorrect ? 'text-emerald-400' : 'text-amber-400')}>
            {allCorrect
              ? 'Exactly right — those are your hole cards.'
              : `${heroCorrectCount} of ${heroCards.length} correct.`}
          </p>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3.5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.concept_content ??
                "In Texas Hold'em you receive 2 private hole cards. Up to 5 community cards are shared by everyone."}
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
