'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { deviationSides, resolveDeviationPanel } from '@/lib/learn/unilateralDeviation'
import { FrequencySlider } from '@/components/learn/visuals/FrequencySlider'

export interface UnilateralDeviationAnswer {
  triedFreqPct: number
  verdict: 'can_improve' | 'no_improvement'
  /** Every distinct frequency the learner actually tried, in the order they tried them. */
  exploredFreqPcts?: number[]
}

interface UnilateralDeviationTestProps {
  step: LessonStep
  onAnswer: (answer: UnilateralDeviationAnswer, timeMs: number) => void
  disabled?: boolean
}

/**
 * Unilateral Deviation Test (Module 10, Lesson 10.4) — the Nash equilibrium
 * test made interactive. The learner gets a control for ONE player's own
 * frequency, holding the opponent fixed at the candidate equilibrium. They try
 * alternatives, watch the EV update live, then render a verdict: can this
 * player improve by changing strategy alone?
 *
 * Every number on screen is derived from `resolveDeviationPanel(step, freq)` —
 * the same pure resolver evaluator.ts grades the answer with, so the display
 * and the grade can never disagree. Nothing here is hardcoded, and the panel
 * is recomputed on every slider tick.
 *
 * The branch breakdown under the EV readout matters more than it looks: when
 * the opponent is defending at exactly the frequency that makes the tested
 * player indifferent, the TOTAL is flat by definition (Acevedo: at equilibrium
 * a hand can only be mixed if the choices have equal EV). The branches are what
 * still move — the learner watches "they fold" and "they call" grow in equal
 * and opposite amounts, which is why the total refuses to budge. Showing only
 * the total there reads as a dead control.
 */
export function UnilateralDeviationTest({ step, onAnswer, disabled = false }: UnilateralDeviationTestProps) {
  const mountTime = useRef(Date.now())
  // The slider starts at the tested player's OWN candidate-equilibrium frequency
  // — i.e. "no deviation yet" — which for a B-side step is the candidate's
  // villainFreq, not its heroFreq. See `deviationSides`.
  const baseline = deviationSides(step).testedBaselinePct

  const [tryFreq, setTryFreq] = useState(baseline)
  const [explored, setExplored] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    mountTime.current = Date.now()
    setTryFreq(baseline)
    setExplored([])
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  // Recomputed on every render — i.e. on every slider tick, since `tryFreq` is
  // this component's own state and is the only frequency input.
  const panel = useMemo(() => resolveDeviationPanel(step, tryFreq), [step, tryFreq])

  const hasTried = explored.length > 0
  const money = (v: number) => `$${Math.abs(v).toFixed(2)}`

  function handleFreqChange(next: number) {
    if (disabled || submitted) return
    setTryFreq(next)
    setExplored((prev) => (prev[prev.length - 1] === next || prev.includes(next) ? prev : [...prev, next]))
  }

  function submitVerdict(verdict: 'can_improve' | 'no_improvement') {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer({ triedFreqPct: tryFreq, verdict, exploredFreqPcts: explored }, Date.now() - mountTime.current)
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
          <span className="text-muted-foreground/70">{panel.playerLabel}&apos;s candidate-equilibrium frequency</span>
          <span className="font-black tabular-nums text-foreground">{panel.testedBaselinePct.toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/70">Held fixed — {panel.fixedMeaning}</span>
          <span className="font-black tabular-nums text-muted-foreground">{panel.fixedPct.toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/70">Equilibrium EV (baseline)</span>
          <span className="font-black tabular-nums text-foreground">${panel.baselineEV.toFixed(2)}</span>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

        <FrequencySlider
          label={`Try a different ${panel.playerLabel} frequency`}
          value={tryFreq}
          onChange={handleFreqChange}
          disabled={disabled || submitted}
          hint={hasTried ? null : `Drag to change how often ${panel.playerLabel} ${panel.testedMeaning}`}
        />

        <div className="rounded-xl bg-secondary/20 border border-border/20 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70">EV at this deviation</span>
          <span
            className={cn(
              'font-black tabular-nums text-base',
              panel.gain > 0.01 ? 'text-emerald-400' : panel.gain < -0.01 ? 'text-rose-400' : 'text-foreground',
            )}
          >
            ${panel.currentEV.toFixed(2)}
            {hasTried && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide">
                {panel.gain > 0.01
                  ? `(+${money(panel.gain)})`
                  : panel.gain < -0.01
                    ? `(−${money(panel.gain)})`
                    : '(no change)'}
              </span>
            )}
          </span>
        </div>

        {/* Where that EV comes from. Every row is live: reach and $ both respond
            to the slider even on a game whose TOTAL is flat. */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Where that ${panel.currentEV.toFixed(2)} comes from
          </p>
          {panel.branches.map((branch) => (
            <div key={branch.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-muted-foreground/80">{branch.label}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/40">
                  {(branch.reach * 100).toFixed(0)}% of the time
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-bold tabular-nums',
                  branch.ev > 0.005 ? 'text-emerald-400' : branch.ev < -0.005 ? 'text-rose-400' : 'text-muted-foreground/50',
                )}
              >
                {branch.ev < -0.005 ? '−' : '+'}
                {money(branch.ev)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!submitted && (
        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground/50">
            Try several frequencies above, then answer: can {panel.playerLabel} improve by changing strategy alone?
          </p>
          {hasTried && (
            <p className="text-center text-[10px] text-muted-foreground/40 tabular-nums">
              {explored.length} {explored.length === 1 ? 'frequency' : 'frequencies'} tried
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => submitVerdict('can_improve')}
              className="rounded-xl border border-border/40 bg-secondary/30 px-4 py-3 text-sm font-semibold text-foreground hover:border-violet-500/40 transition-colors"
            >
              Yes — {panel.playerLabel} can improve alone
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
