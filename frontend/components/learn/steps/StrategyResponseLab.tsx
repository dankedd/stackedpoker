'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LessonStep } from '@/lib/learn/types'
import { evOfBetting, evOfChecking } from '@/lib/learn/gameTheoryEngine'
import { PRESSURE_GAME_DEFAULT, PUSH_FOLD_ITERATION } from '@/lib/learn/gameTheoryContent'
import { FrequencySlider } from '@/components/learn/visuals/FrequencySlider'
import { EVCompareBar } from '@/components/learn/visuals/EVCompareBar'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'

export type StrategyResponseLabAnswer =
  | { mode: 'intro'; strategyId: string }
  | { mode: 'best_response'; heroFreqPct: number }
  | { mode: 'counter_exploit'; optionId: string; exploitFreqPct: number }
  | { mode: 'iterate'; complete: true }

interface StrategyResponseLabProps {
  step: LessonStep
  onAnswer: (answer: StrategyResponseLabAnswer, timeMs: number) => void
  disabled?: boolean
}

function useToyGame(step: LessonStep) {
  const pot = step.strategy_response_lab_pot ?? PRESSURE_GAME_DEFAULT.pot
  const bet = step.strategy_response_lab_bet ?? PRESSURE_GAME_DEFAULT.bet
  const equityWhenCalled = step.strategy_response_lab_equity_when_called ?? PRESSURE_GAME_DEFAULT.equityWhenCalled
  const equityWhenChecked = step.strategy_response_lab_equity_when_checked ?? PRESSURE_GAME_DEFAULT.equityWhenChecked
  return { pot, bet, equityWhenCalled, equityWhenChecked }
}

/**
 * Strategy Response Lab (Module 10) — the A→B→A strategy feedback loop.
 * Four modes covering Lessons 10.1-10.3; every EV number is exact_derived
 * from gameTheoryEngine.ts applied to the explicitly stated toy game
 * (`strategy_response_lab_pot`/`_bet`/`_equity_when_*`, defaulting to
 * PRESSURE_GAME_DEFAULT — a clearly labeled pedagogical model, never a real
 * poker frequency). 'iterate' mode is the one exception: it walks through
 * PUSH_FOLD_ITERATION's fixed, source-cited data points, never interpolating.
 */
export function StrategyResponseLab({ step, onAnswer, disabled = false }: StrategyResponseLabProps) {
  const mountTime = useRef(Date.now())
  const mode = step.strategy_response_lab_mode ?? 'best_response'
  const game = useToyGame(step)

  useEffect(() => {
    mountTime.current = Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {step.narrative && (
        <div className="rounded-xl border border-border/30 bg-secondary/20 px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.narrative}</p>
        </div>
      )}
      {step.strategy_response_lab_prompt && (
        <p className="text-center text-base font-semibold text-foreground">{step.strategy_response_lab_prompt}</p>
      )}

      {mode === 'intro' && <IntroMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />}
      {mode === 'best_response' && (
        <BestResponseMode step={step} game={game} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
      )}
      {mode === 'counter_exploit' && (
        <CounterExploitMode step={step} game={game} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />
      )}
      {mode === 'iterate' && <IterateMode step={step} onAnswer={onAnswer} disabled={disabled} mountTime={mountTime} />}
    </div>
  )
}

// ── Intro mode (10.1, first half) — pick between two pure strategies, watch the fixed response ──

function IntroMode({
  step,
  onAnswer,
  disabled,
  mountTime,
}: {
  step: LessonStep
  onAnswer: (a: StrategyResponseLabAnswer, ms: number) => void
  disabled: boolean
  mountTime: React.MutableRefObject<number>
}) {
  const strategies = step.strategy_response_lab_intro_strategies ?? [
    { id: 'always_bet', label: 'Always bet', heroFreq: 1 },
    { id: 'never_bet', label: 'Never bet', heroFreq: 0 },
  ]
  const game = useToyGame(step)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function choose(id: string) {
    if (disabled || submitted) return
    setChosenId(id)
  }

  function submit() {
    if (disabled || submitted || !chosenId) return
    setSubmitted(true)
    onAnswer({ mode: 'intro', strategyId: chosenId }, Date.now() - mountTime.current)
  }

  const chosen = strategies.find((s) => s.id === chosenId)
  // Player B's best response given the chosen pure strategy: call if the bettor bets often
  // enough that folding is worse (a 0-equity bettor betting >0% is only ever unprofitable to
  // ignore once they bet SOME of the time); call 0% is only correct when hero never bets at all.
  const villainBestCallFreq = chosen && chosen.heroFreq > 0 ? 100 : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {strategies.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled || submitted}
            onClick={() => choose(s.id)}
            className={cn(
              'rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-all',
              chosenId === s.id
                ? 'border-violet-500/70 bg-violet-500/15 text-foreground'
                : 'border-border/40 bg-secondary/20 text-muted-foreground hover:border-violet-500/30',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {chosen && (
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/8 via-card/60 to-violet-600/5 p-5 space-y-3 animate-in fade-in duration-300">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">Player B's best response</p>
          <p className="text-sm text-foreground">
            {villainBestCallFreq === 100
              ? "Call every time. Once Player A bets any hand with no showdown value, calling always wins back more than it risks."
              : "It doesn't matter — Player A never bets, so Player B never faces a decision here."}
          </p>
          <EVCompareBar
            entries={[
              {
                id: 'hero',
                label: 'Player A EV (this strategy)',
                ev: chosen.heroFreq * evOfBetting({ ...game }, villainBestCallFreq / 100) + (1 - chosen.heroFreq) * evOfChecking(game),
              },
            ]}
          />
        </div>
      )}

      <button
        type="button"
        disabled={disabled || submitted || !chosenId}
        onClick={submit}
        className={cn(
          'w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200',
          submitted || disabled || !chosenId
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {submitted ? 'Submitted' : 'Continue'}
      </button>
    </div>
  )
}

// ── Best-response mode (10.1, second half) — Villain fixed, Hero searches for the MES ──

function BestResponseMode({
  step,
  game,
  onAnswer,
  disabled,
  mountTime,
}: {
  step: LessonStep
  game: ReturnType<typeof useToyGame>
  onAnswer: (a: StrategyResponseLabAnswer, ms: number) => void
  disabled: boolean
  mountTime: React.MutableRefObject<number>
}) {
  const villainFreq = (step.strategy_response_lab_fixed_villain_freq ?? 0.5) * 100
  const [heroFreq, setHeroFreq] = useState(50)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setHeroFreq(50)
    setSubmitted(false)
  }, [step.id])

  const evBetFull = evOfBetting(game, villainFreq / 100)
  const evCheckFull = evOfChecking(game)
  const blendedEV = (heroFreq / 100) * evBetFull + (1 - heroFreq / 100) * evCheckFull

  function submit() {
    if (disabled || submitted) return
    setSubmitted(true)
    onAnswer({ mode: 'best_response', heroFreqPct: heroFreq }, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-center">
        <p className="text-[10px] uppercase tracking-wide text-blue-400/60">Villain — locked</p>
        <p className="text-sm font-semibold text-foreground">Calls {villainFreq.toFixed(0)}% of the time</p>
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
        <FrequencySlider
          label="Hero's bet frequency"
          value={heroFreq}
          onChange={(v) => !submitted && setHeroFreq(v)}
          disabled={disabled || submitted}
        />
        <EVCompareBar entries={[{ id: 'blend', label: 'Hero EV at this frequency', ev: blendedEV }]} />
      </div>

      {!submitted && (
        <p className="text-center text-xs text-muted-foreground/40 italic">
          Find the frequency that earns Hero the most against this exact, fixed Villain strategy.
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
        {submitted ? 'Submitted' : 'Lock In My Response'}
      </button>
    </div>
  )
}

// ── Counter-exploit mode (10.2) — FREEZE/UNFREEZE Villain ──

function CounterExploitMode({
  step,
  game,
  onAnswer,
  disabled,
  mountTime,
}: {
  step: LessonStep
  game: ReturnType<typeof useToyGame>
  onAnswer: (a: StrategyResponseLabAnswer, ms: number) => void
  disabled: boolean
  mountTime: React.MutableRefObject<number>
}) {
  const freqBefore = (step.strategy_response_lab_villain_freq_before ?? 0.2) * 100
  const freqAfter = (step.strategy_response_lab_villain_freq_after ?? 0.9) * 100
  const [heroFreq, setHeroFreq] = useState(50)
  const [unfrozen, setUnfrozen] = useState(false)
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setHeroFreq(50)
    setUnfrozen(false)
    setChosenOptionId(null)
    setSubmitted(false)
  }, [step.id])

  const activeVillainFreq = unfrozen ? freqAfter : freqBefore
  const evBefore = (heroFreq / 100) * evOfBetting(game, freqBefore / 100) + (1 - heroFreq / 100) * evOfChecking(game)
  const evNow = (heroFreq / 100) * evOfBetting(game, activeVillainFreq / 100) + (1 - heroFreq / 100) * evOfChecking(game)

  const shuffledOptions = step.options ? shuffleBySeed(step.options, step.id) : []

  function submitOption(optionId: string) {
    if (disabled || submitted) return
    setChosenOptionId(optionId)
    setSubmitted(true)
    onAnswer({ mode: 'counter_exploit', optionId, exploitFreqPct: heroFreq }, Date.now() - mountTime.current)
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-center transition-colors',
          unfrozen ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/30 bg-emerald-500/5',
        )}
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
          Villain — {unfrozen ? 'unfrozen, adjusted' : 'frozen'}
        </p>
        <p className="text-sm font-semibold text-foreground">Calls {activeVillainFreq.toFixed(0)}% of the time</p>
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-5">
        <FrequencySlider
          label="Hero's bet frequency"
          value={heroFreq}
          onChange={(v) => !unfrozen && setHeroFreq(v)}
          disabled={disabled || unfrozen}
        />
        <EVCompareBar
          entries={[{ id: 'ev', label: unfrozen ? 'Hero EV — same frequency, Villain adjusted' : 'Hero EV — exploiting the frozen Villain', ev: unfrozen ? evNow : evBefore }]}
        />
      </div>

      {!unfrozen && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setUnfrozen(true)}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-semibold bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-0.5 transition-all"
        >
          Unfreeze Villain
        </button>
      )}

      {unfrozen && !submitted && step.options && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <p className="text-center text-sm font-semibold text-foreground">
            Your exploit worked before — why did it stop working?
          </p>
          <div className="grid grid-cols-1 gap-2">
            {shuffledOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => submitOption(opt.id)}
                className="rounded-xl border border-border/40 bg-secondary/30 px-4 py-3 text-left text-sm text-foreground hover:border-violet-500/40 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {submitted && chosenOptionId && (
        <p className="text-center text-xs text-muted-foreground/50">Answer locked in.</p>
      )}
    </div>
  )
}

// ── Iterate mode (10.3) — walk the fixed, source-cited push/fold sequence ──

function IterateMode({
  step,
  onAnswer,
  disabled,
  mountTime,
}: {
  step: LessonStep
  onAnswer: (a: StrategyResponseLabAnswer, ms: number) => void
  disabled: boolean
  mountTime: React.MutableRefObject<number>
}) {
  const ids = step.strategy_response_lab_iteration_ids ?? PUSH_FOLD_ITERATION.map((s) => s.id)
  const states = ids.map((id) => PUSH_FOLD_ITERATION.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s)
  const [index, setIndex] = useState(0)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    setIndex(0)
    setComplete(false)
  }, [step.id])

  const current = states[index]
  const isLast = index === states.length - 1

  function advance() {
    if (disabled) return
    if (isLast) {
      if (!complete) {
        setComplete(true)
        onAnswer({ mode: 'iterate', complete: true }, Date.now() - mountTime.current)
      }
      return
    }
    setIndex((i) => i + 1)
  }

  if (!current) return null

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/8 via-card/60 to-blue-600/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
              current.actor === 'BN' ? 'bg-blue-500/15 text-blue-300' : 'bg-violet-500/15 text-violet-300',
            )}
          >
            {current.actor}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            Step {index + 1} of {states.length}
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">{current.label}</p>
        <div className="h-3 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              current.actor === 'BN' ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-violet-600 to-violet-400',
            )}
            style={{ width: `${current.freq * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{current.note}</p>
        {current.bbEV !== undefined && (
          <div className="rounded-xl bg-secondary/20 border border-border/20 px-4 py-2 text-center">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/40 mr-2">BB EV</span>
            <span className="font-black tabular-nums text-foreground">{current.bbEV.toFixed(2)}bb</span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={disabled || complete}
        onClick={advance}
        className={cn(
          'w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200',
          complete
            ? 'opacity-50 cursor-default bg-secondary/40 border border-border/30 text-muted-foreground'
            : 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5',
        )}
      >
        {complete ? 'Done' : isLast ? 'Finish' : 'Best Respond'}
      </button>
    </div>
  )
}
