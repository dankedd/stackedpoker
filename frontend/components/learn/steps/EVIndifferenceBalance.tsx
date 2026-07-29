'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { evOfBetting, evOfChecking, isIndifferent } from '@/lib/learn/gameTheoryEngine'
import { FrequencySlider } from '@/components/learn/visuals/FrequencySlider'
import { EVCompareBar } from '@/components/learn/visuals/EVCompareBar'

interface EVIndifferenceBalanceProps {
  step: LessonStep
  /** The opponent frequency (0-100) the learner submitted. */
  onAnswer: (opponentFreqPct: number, timeMs: number) => void
  disabled?: boolean
}

/**
 * EV Indifference Balance (Module 10) — two action bars (e.g. BET vs CHECK)
 * whose EVs respond live to an opponent-frequency slider. The learner
 * searches for the point where neither action earns more — the Indifference
 * Principle in action. All EV math is exact_derived via gameTheoryEngine.ts's
 * evOfBetting/evOfChecking; nothing here is a hand-authored per-frequency number.
 */
export function EVIndifferenceBalance({ step, onAnswer, disabled = false }: EVIndifferenceBalanceProps) {
  const mountTime = useRef(Date.now())
  const pot = step.ev_indifference_balance_pot ?? 100
  const bet = step.ev_indifference_balance_bet ?? 100
  const equityWhenCalled = step.ev_indifference_balance_equity_when_called ?? 0
  const equityWhenChecked = step.ev_indifference_balance_equity_when_checked ?? 0
  const labelA = step.ev_indifference_balance_action_a_label ?? 'Bet'
  const labelB = step.ev_indifference_balance_action_b_label ?? 'Check'
  const tolerance = step.ev_indifference_balance_tolerance ?? 0.03

  const [oppFreq, setOppFreq] = useState(50)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setOppFreq(50)
    setSubmitted(false)
  }, [step.id])

  const evA = evOfBetting({ pot, bet, equityWhenCalled }, oppFreq / 100)
  const evB = evOfChecking({ pot, equityWhenChecked })
  const foundIndifference = isIndifferent(evA, evB, tolerance * (pot + bet))

  function submit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer(oppFreq, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.ev_indifference_balance_prompt && (
        <p className="text-center text-base font-semibold text-foreground">
          {step.ev_indifference_balance_prompt}
        </p>
      )}

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
        <FrequencySlider
          label="Opponent's continuing frequency"
          value={oppFreq}
          onChange={(v) => !submitted && setOppFreq(v)}
          disabled={disabled || submitted}
        />

        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

        <EVCompareBar
          entries={[
            { id: 'a', label: labelA, ev: evA },
            { id: 'b', label: labelB, ev: evB },
          ]}
          indifferent={foundIndifference}
        />
      </div>

      {!submitted && (
        <p className="text-center text-xs text-muted-foreground/40 italic">
          Move the slider until neither action earns more than the other.
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
        {submitted ? 'Submitted' : 'Lock In This Frequency'}
      </button>
    </div>
  )
}
