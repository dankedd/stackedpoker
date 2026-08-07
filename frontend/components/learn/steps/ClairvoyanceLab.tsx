'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { clairvoyanceEV, clairvoyanceEquilibrium, faceUpEV } from '@/lib/learn/gameTheoryEngine'
import { CLAIRVOYANCE_GAME } from '@/lib/learn/gameTheoryContent'
import { FrequencySlider } from '@/components/learn/visuals/FrequencySlider'
import { PlayingCardMini } from '@/components/learn/PlayingCardMini'

export interface ClairvoyanceLabAnswer {
  aaBetFreqPct: number
  qqBetFreqPct: number
  kkCallFreqPct: number
}

interface ClairvoyanceLabProps {
  step: LessonStep
  onAnswer: (answer: ClairvoyanceLabAnswer, timeMs: number) => void
  disabled?: boolean
}

const SLIDER_META: Record<'aa_bet' | 'qq_bet' | 'kk_call', { label: string; accent: 'violet' | 'blue' }> = {
  aa_bet: { label: 'P1 bets AA (the value hand)', accent: 'violet' },
  qq_bet: { label: 'P1 bets QQ (the bluff)', accent: 'violet' },
  kk_call: { label: 'P2 calls with KK', accent: 'blue' },
}

/**
 * The Clairvoyance Lab (Module 10, Lessons 10.6-10.7) — Acevedo's AA/QQ-vs-KK
 * polarized toy game as a three-frequency tug of war. Every EV shown is
 * exact_derived live via gameTheoryEngine.ts's clairvoyanceEV, from the
 * game's explicitly stated rules (pot $100, bet $100, board 3♠3♥3♣2♦2♠) —
 * never a hand-authored number for an arbitrary frequency combination.
 */
export function ClairvoyanceLab({ step, onAnswer, disabled = false }: ClairvoyanceLabProps) {
  const mountTime = useRef(Date.now())
  const pot = CLAIRVOYANCE_GAME.pot
  const bet = CLAIRVOYANCE_GAME.bet
  const editable = step.clairvoyance_lab_editable ?? ['aa_bet', 'qq_bet', 'kk_call']
  const locked = step.clairvoyance_lab_locked ?? {}
  const mode = step.clairvoyance_lab_mode ?? 'explore'
  const trueEq = clairvoyanceEquilibrium(pot, bet)

  const initial = {
    aa_bet: locked.aa_bet !== undefined ? locked.aa_bet * 100 : editable.includes('aa_bet') ? 100 : trueEq.aaBetFreq * 100,
    qq_bet: locked.qq_bet !== undefined ? locked.qq_bet * 100 : editable.includes('qq_bet') ? 50 : trueEq.qqBetFreq * 100,
    kk_call: locked.kk_call !== undefined ? locked.kk_call * 100 : editable.includes('kk_call') ? 50 : trueEq.kkCallFreq * 100,
  }

  const [freqs, setFreqs] = useState(initial)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setFreqs(initial)
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  const { evP1, evP2 } = clairvoyanceEV({
    pot,
    bet,
    aaBetFreq: freqs.aa_bet / 100,
    qqBetFreq: freqs.qq_bet / 100,
    kkCallFreq: freqs.kk_call / 100,
    probAA: CLAIRVOYANCE_GAME.probAA,
  })

  // face_up_compare (Module 11, Lesson 1 "Why We Bet") — no sliders, nothing editable: a
  // fixed, read-only comparison of this SAME game's equilibrium EV with hidden information
  // against its EV if both hands were fully visible. The graded prediction happens in a
  // separate, preceding decision_spot step; this step only renders what that prediction
  // gets checked against, so it stays unscored (see isScoredStep's existing clairvoyance_lab
  // gate — anything other than 'find_equilibrium' already falls through to unscored).
  const hiddenEV = clairvoyanceEV({
    pot,
    bet,
    aaBetFreq: trueEq.aaBetFreq,
    qqBetFreq: trueEq.qqBetFreq,
    kkCallFreq: trueEq.kkCallFreq,
    probAA: CLAIRVOYANCE_GAME.probAA,
  })
  const faceUp = faceUpEV({ pot, probAA: CLAIRVOYANCE_GAME.probAA })
  const infoValue = hiddenEV.evP1 - faceUp.evP1

  function submit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(
      { aaBetFreqPct: freqs.aa_bet, qqBetFreqPct: freqs.qq_bet, kkCallFreqPct: freqs.kk_call },
      Date.now() - mountTime.current,
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {/* Board + range context */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border/30 bg-secondary/10 py-4">
        <div className="flex gap-1">
          {CLAIRVOYANCE_GAME.board.map((c) => (
            <PlayingCardMini key={c} card={c} size="sm" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground/60">
          <span>Pot ${pot} · Stacks ${CLAIRVOYANCE_GAME.stacks}</span>
          <span>P1 holds AA or QQ (50/50)</span>
          <span>P2 holds KK</span>
        </div>
      </div>

      {step.clairvoyance_lab_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.clairvoyance_lab_prompt}</p>
      )}

      {mode !== 'face_up_compare' && (
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
          {(['aa_bet', 'qq_bet', 'kk_call'] as const).map((key) => {
            const meta = SLIDER_META[key]
            const isEditable = editable.includes(key)
            return (
              <FrequencySlider
                key={key}
                label={meta.label + (isEditable ? '' : ' (fixed)')}
                value={freqs[key]}
                accent={meta.accent}
                disabled={disabled || submitted || !isEditable}
                onChange={(v) => !submitted && setFreqs((f) => ({ ...f, [key]: v }))}
              />
            )
          })}

          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-secondary/20 border border-border/20 px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/40">P1 EV</p>
              <p className="text-lg font-black text-foreground tabular-nums">${evP1.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-secondary/20 border border-border/20 px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/40">P2 EV</p>
              <p className="text-lg font-black text-foreground tabular-nums">${evP2.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {mode === 'face_up_compare' && (
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/20 bg-secondary/20 px-4 py-4 text-center space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Hidden — P2 doesn&apos;t know which hand</p>
              <p className="text-2xl font-black text-violet-300 tabular-nums">${hiddenEV.evP1.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground/40">P1&apos;s EV — AA bets 100%, QQ bluffs {Math.round(trueEq.qqBetFreq * 100)}%</p>
            </div>
            <div className="rounded-xl border border-border/20 bg-secondary/20 px-4 py-4 text-center space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Face-up — P2 sees the exact hand</p>
              <p className="text-2xl font-black text-foreground tabular-nums">${faceUp.evP1.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground/40">P1&apos;s EV — betting can no longer force a mistake</p>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

          <div className="rounded-xl bg-secondary/10 border border-violet-500/20 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/40">The gap</p>
            <p className="text-xl font-black text-violet-300 tabular-nums">${infoValue.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              The exact value of P2 not knowing which hand P1 holds — nothing about either hand changed.
            </p>
          </div>
        </div>
      )}

      {mode === 'find_equilibrium' && !submitted && (
        <p className="text-center text-xs text-muted-foreground/40 italic">
          Adjust the frequencies until neither player&apos;s EV can improve, then submit.
        </p>
      )}

      <button
        type="button"
        disabled={disabled || submitted}
        onClick={submit}
        className={cn(
          'w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200',
          submitted || disabled
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {submitted ? 'Submitted' : mode === 'find_equilibrium' ? 'Submit My Equilibrium' : 'Continue'}
      </button>
    </div>
  )
}
