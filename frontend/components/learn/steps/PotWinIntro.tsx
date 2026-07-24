'use client'

import { useState } from 'react'
import { ChevronRight, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { OnboardingTable, type OnboardingSeat } from '@/components/learn/visuals/OnboardingTable'

interface PotWinIntroProps {
  step: LessonStep
  onComplete: () => void
}

const DEFAULT_SEATS: OnboardingSeat[] = [
  { id: 'opp1', label: 'Opponent', isHero: false, stack: 100 },
  { id: 'opp2', label: 'Opponent', isHero: false, stack: 100 },
  { id: 'hero', label: 'You', isHero: true, stack: 100 },
]

/**
 * Lesson 1, Step 1 — "Win the Pot". Purely exploratory onboarding: tap the pot,
 * watch the chips animate to Hero, read one short line of context. Unscored
 * (see isScoredStep in evaluator.ts) — no fake score/XP screen for a first look.
 */
export function PotWinIntro({ step, onComplete }: PotWinIntroProps) {
  const seats = step.pot_win_intro_seats ?? DEFAULT_SEATS
  const potChips = step.pot_win_intro_pot ?? 15
  const [won, setWon] = useState(false)
  const heroStack = (seats.find((s) => s.isHero)?.stack ?? 100) + (won ? potChips : 0)
  const revisedSeats = seats.map((s) => (s.isHero ? { ...s, stack: heroStack } : s))

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 shrink-0">
          <Target className="h-4.5 w-4.5 text-violet-400" />
        </div>
        <p className="text-sm font-semibold text-foreground leading-snug">
          {step.pot_win_intro_prompt ?? 'Your goal is simple: win the pot.'}
        </p>
      </div>

      <OnboardingTable seats={revisedSeats} potChips={potChips} potWon={won} potTappable={!won} onPotClick={() => setWon(true)} />

      {!won && (
        <p className="text-center text-xs text-muted-foreground/50">Tap the pot to see how a hand gets won.</p>
      )}

      {won && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3.5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.concept_content ??
                'Every poker hand is a battle for the chips in the middle. You can win them at showdown — or by making everyone else fold.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className={cn(
              'group relative w-full inline-flex items-center justify-center gap-2.5',
              'rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-6 py-3.5',
              'text-sm font-semibold text-white',
              'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
              'hover:-translate-y-0.5 transition-all duration-200 overflow-hidden',
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
            Got it
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  )
}
