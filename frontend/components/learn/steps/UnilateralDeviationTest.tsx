'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { evOfBetting, evOfChecking } from '@/lib/learn/gameTheoryEngine'
import { FrequencySlider } from '@/components/learn/visuals/FrequencySlider'

export interface UnilateralDeviationAnswer {
  triedFreqPct: number
  verdict: 'can_improve' | 'no_improvement'
}

interface UnilateralDeviationTestProps {
  step: LessonStep
  onAnswer: (answer: UnilateralDeviationAnswer, timeMs: number) => void
  disabled?: boolean
}

/**
 * Unilateral Deviation Test (Module 10, Lesson 10.4) — the Nash equilibrium
 * test made interactive. The learner gets a control for ONE player's own
 * frequency (`unilateral_deviation_test_player`), holding the opponent fixed
 * at the candidate equilibrium. They try alternatives, watch EV update live
 * (exact_derived via gameTheoryEngine.ts), then render a verdict: can this
 * player improve by changing strategy alone?
 */
export function UnilateralDeviationTest({ step, onAnswer, disabled = false }: UnilateralDeviationTestProps) {
  const mountTime = useRef(Date.now())
  const pot = step.unilateral_deviation_test_pot ?? 100
  const bet = step.unilateral_deviation_test_bet ?? 100
  const equilibrium = step.unilateral_deviation_test_equilibrium ?? { heroFreq: 50, villainFreq: 50 }
  const player = step.unilateral_deviation_test_player ?? 'A'
  const playerLabel = player === 'A' ? 'Player A' : 'Player B'

  const [tryFreq, setTryFreq] = useState(equilibrium.heroFreq)
  const [hasTried, setHasTried] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setTryFreq(equilibrium.heroFreq)
    setHasTried(false)
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  // Player A = the bettor (bet frequency with a zero-equity bluff hand); Player B = the defender (call frequency).
  function evAt(freqPct: number, villainFreqPct: number): number {
    if (player === 'A') {
      // Player A's OWN frequency here is how often they bet (vs. check) this hand — the blend
      // must actually depend on freqPct, not just on the fixed Villain call frequency.
      const betEV = evOfBetting({ pot, bet, equityWhenCalled: 0 }, villainFreqPct / 100)
      const checkEV = evOfChecking({ pot, equityWhenChecked: 0 })
      return (freqPct / 100) * betEV + (1 - freqPct / 100) * checkEV
    }
    // Player B's own frequency here is the CALL frequency; `villainFreqPct` is the bettor's
    // (a zero-equity bluff) bet frequency. When the bettor doesn't bet, there's no decision
    // node for B to reach, so it contributes 0 marginal EV to this specific comparison.
    const callFreq = freqPct / 100
    const bettorFreq = villainFreqPct / 100
    const callEV = pot - evOfBetting({ pot, bet, equityWhenCalled: 0 }, 1) // pot − Hero's called-branch EV = Villain's EV from calling
    return bettorFreq * (callFreq * callEV + (1 - callFreq) * 0)
  }

  const equilibriumEV =
    player === 'A' ? evAt(equilibrium.heroFreq, equilibrium.villainFreq) : evAt(equilibrium.heroFreq, equilibrium.villainFreq)
  const triedEV = evAt(tryFreq, equilibrium.villainFreq)
  const gain = triedEV - equilibriumEV

  function submitVerdict(verdict: 'can_improve' | 'no_improvement') {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer({ triedFreqPct: tryFreq, verdict }, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}

      {step.unilateral_deviation_test_prompt && (
        <p className="text-center text-base font-semibold text-foreground">
          {step.unilateral_deviation_test_prompt}
        </p>
      )}

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/70">{playerLabel}'s candidate-equilibrium frequency</span>
          <span className="font-black tabular-nums text-foreground">{equilibrium.heroFreq.toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/70">Equilibrium EV (baseline)</span>
          <span className="font-black tabular-nums text-foreground">${equilibriumEV.toFixed(2)}</span>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

        <FrequencySlider
          label={`Try a different ${playerLabel} frequency`}
          value={tryFreq}
          onChange={(v) => {
            if (submitted) return
            setTryFreq(v)
            setHasTried(true)
          }}
          disabled={disabled || submitted}
        />

        <div className="rounded-xl bg-secondary/20 border border-border/20 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70">EV at this deviation</span>
          <span
            className={cn(
              'font-black tabular-nums text-base',
              gain > 0.01 ? 'text-emerald-400' : gain < -0.01 ? 'text-rose-400' : 'text-foreground',
            )}
          >
            ${triedEV.toFixed(2)}
            {hasTried && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide">
                {gain > 0.01 ? `(+$${gain.toFixed(2)})` : gain < -0.01 ? `(−$${Math.abs(gain).toFixed(2)})` : '(no change)'}
              </span>
            )}
          </span>
        </div>
      </div>

      {!submitted && (
        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground/50">
            Try several frequencies above, then answer: can {playerLabel} improve by changing strategy alone?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => submitVerdict('can_improve')}
              className="rounded-xl border border-border/40 bg-secondary/30 px-4 py-3 text-sm font-semibold text-foreground hover:border-violet-500/40 transition-colors"
            >
              Yes — {playerLabel} can improve alone
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => submitVerdict('no_improvement')}
              className="rounded-xl border border-border/40 bg-secondary/30 px-4 py-3 text-sm font-semibold text-foreground hover:border-violet-500/40 transition-colors"
            >
              No — no profitable deviation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
