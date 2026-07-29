'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'
import { expandHandClass, expandGenericUnpaired, getBlockedCombos, comboKey, type Card } from '@/lib/learn/combos'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

interface ComboRemovalOverlayProps {
  step: LessonStep
  onAnswer: (markedKeys: string[], timeMs: number) => void
  disabled?: boolean
}

function expandSubject(subject: string): [Card, Card][] {
  const isPair = subject.length === 2 && subject[0] === subject[1]
  const isClassed = subject.length === 3 && (subject[2] === 's' || subject[2] === 'o')
  return isPair || isClassed ? expandHandClass(subject) : expandGenericUnpaired(subject[0], subject[1])
}

/** The Module 9 "Combo Removal Overlay" — every concrete 2-card combo for a
 *  hand class (or a whole flattened range) rendered as its own tappable tile.
 *  The learner marks the combos a known card (Hero's hand and/or the board)
 *  makes physically impossible; submitting grades the exact tapped set
 *  against combos.ts's own removal math, never a separately-authored answer key. */
export function ComboRemovalOverlay({ step, onAnswer, disabled = false }: ComboRemovalOverlayProps) {
  const mountTime = useRef(Date.now())
  const subject = step.combo_removal_subject ?? ''
  const range = step.combo_removal_range
  const known = step.combo_removal_known_cards ?? []
  const boardCards = step.combo_removal_board_cards ?? []
  const heroCards = step.combo_removal_hero_cards ?? []
  const allKnown = useMemo(() => [...known, ...boardCards, ...heroCards], [known, boardCards, heroCards])

  const allCombos = useMemo<[Card, Card][]>(() => {
    if (range && range.length > 0) {
      const seen = new Set<string>()
      const out: [Card, Card][] = []
      for (const hand of range) {
        for (const combo of expandSubject(hand)) {
          const key = comboKey(combo)
          if (!seen.has(key)) {
            seen.add(key)
            out.push(combo)
          }
        }
      }
      return out
    }
    return expandSubject(subject)
  }, [subject, range])

  const tiles = useMemo(() => shuffleBySeed(allCombos, step.id), [allCombos, step.id])
  const blockedKeys = useMemo(() => new Set(getBlockedCombos(allCombos, allKnown).map(comboKey)), [allCombos, allKnown])
  const boardBlockedKeys = useMemo(
    () => (boardCards.length ? new Set(getBlockedCombos(allCombos, boardCards).map(comboKey)) : new Set<string>()),
    [allCombos, boardCards],
  )
  const heroBlockedKeys = useMemo(
    () => (heroCards.length ? new Set(getBlockedCombos(allCombos, heroCards).map(comboKey)) : new Set<string>()),
    [allCombos, heroCards],
  )

  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setMarked(new Set())
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  function toggle(key: string) {
    if (disabled || submitted) return
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function submit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(Array.from(marked), Date.now() - mountTime.current)
  }

  const removedCount = submitted ? blockedKeys.size : marked.size
  const remainingCount = allCombos.length - (submitted ? blockedKeys.size : 0)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {(known.length > 0 || boardCards.length > 0 || heroCards.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {known.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Known cards</span>
              <div className="flex gap-1">{known.map((c) => <PlayingCardMini key={c} card={c} size="sm" />)}</div>
            </div>
          )}
          {boardCards.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Board</span>
              <div className="flex gap-1">{boardCards.map((c) => <PlayingCardMini key={c} card={c} size="sm" />)}</div>
            </div>
          )}
          {heroCards.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">Hero holds</span>
              <div className="flex gap-1">{heroCards.map((c) => <PlayingCardMini key={c} card={c} size="sm" />)}</div>
            </div>
          )}
        </div>
      )}

      {step.combo_removal_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.combo_removal_prompt}</p>
      )}

      {/* Combo tiles */}
      <div className="flex flex-wrap items-center justify-center gap-2.5" role="group" aria-label={`${subject} combinations`}>
        {tiles.map((combo) => {
          const key = comboKey(combo)
          const isMarked = marked.has(key)
          const isActuallyBlocked = blockedKeys.has(key)

          let state: 'available' | 'selected' | 'correct' | 'incorrect' | 'missed' = 'available'
          if (!submitted && isMarked) state = 'selected'
          if (submitted && isMarked && isActuallyBlocked) state = 'correct'
          if (submitted && isMarked && !isActuallyBlocked) state = 'incorrect'
          if (submitted && !isMarked && isActuallyBlocked) state = 'missed'

          const stateLabel = {
            available: 'available',
            selected: 'marked for removal',
            correct: 'correctly removed',
            incorrect: 'incorrectly removed',
            missed: 'should have been removed',
          }[state]

          // Only meaningful when board/hero cards are authored separately —
          // otherwise both sets are empty and no badge renders.
          const fromBoard = boardBlockedKeys.has(key)
          const fromHero = heroBlockedKeys.has(key)
          const removalSourceBadge = fromBoard && fromHero ? 'B+H' : fromBoard ? 'B' : fromHero ? 'H' : null
          const removalSourceLabel = fromBoard && fromHero ? 'board and Hero\'s hand' : fromBoard ? 'the board' : fromHero ? 'Hero\'s hand' : ''

          return (
            <button
              key={key}
              type="button"
              disabled={disabled || submitted}
              onClick={() => toggle(key)}
              aria-pressed={isMarked}
              aria-label={`${combo[0]} ${combo[1]}, ${stateLabel}${removalSourceBadge && (state === 'correct' || state === 'missed') ? `, impossible because of ${removalSourceLabel}` : ''}`}
              className={cn(
                'relative flex items-center gap-0.5 rounded-lg border-2 px-1.5 py-1.5 transition-all duration-200',
                state === 'available' && 'border-border/40 bg-secondary/20 hover:border-violet-500/40 hover:bg-secondary/40',
                state === 'selected' && 'border-violet-500/70 bg-violet-500/15 shadow-md shadow-violet-900/20',
                state === 'correct' && 'border-emerald-500/60 bg-emerald-500/10 opacity-60',
                state === 'incorrect' && 'border-rose-500/60 bg-rose-500/10',
                state === 'missed' && 'border-amber-500/60 bg-amber-500/10',
              )}
            >
              <PlayingCardMini card={combo[0]} size="xs" className={cn((state === 'correct') && 'grayscale')} />
              <PlayingCardMini card={combo[1]} size="xs" className={cn((state === 'correct') && 'grayscale')} />
              {state === 'selected' && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-black text-white">−</span>
              )}
              {state === 'correct' && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">✓</span>
              )}
              {state === 'incorrect' && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">✕</span>
              )}
              {state === 'missed' && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">!</span>
              )}
              {(state === 'correct' || state === 'missed') && (
                <div aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <div className="h-[2px] w-[110%] rotate-45 bg-current opacity-40" />
                </div>
              )}
              {removalSourceBadge && (state === 'correct' || state === 'missed') && (
                <span
                  aria-hidden
                  title={`Impossible because of ${removalSourceLabel}`}
                  className="absolute -bottom-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary border border-border/50 px-0.5 text-[8px] font-black text-foreground/70"
                >
                  {removalSourceBadge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Live count summary */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
        <div className="flex items-center justify-around text-center">
          <div>
            <p className="text-lg font-black text-foreground tabular-nums">{allCombos.length}</p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">{submitted ? 'Started with' : 'Possible'}</p>
          </div>
          <div>
            <p className={cn('text-lg font-black tabular-nums transition-all duration-300', submitted ? 'text-rose-400' : 'text-violet-300')}>
              -{removedCount}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">{submitted ? 'Removed' : 'Marked'}</p>
          </div>
          {submitted && (
            <div className="animate-in fade-in duration-300">
              <p className="text-lg font-black text-emerald-300 tabular-nums">{remainingCount}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground/40">Remain</p>
            </div>
          )}
        </div>
      </div>

      {!submitted && (
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200"
        >
          Submit
        </button>
      )}
    </div>
  )
}
