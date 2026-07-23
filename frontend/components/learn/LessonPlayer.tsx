'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  CheckCircle2, Clock, Zap, ChevronRight, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, LessonStep, StepResult } from '@/lib/learn/types'
import { evaluateStepLocally } from '@/lib/learn/evaluator'
import { PokerContextBar } from '@/components/learn/PokerContextBar'
import { StepFeedback } from '@/components/learn/StepFeedback'
import { ConceptReveal } from '@/components/learn/steps/ConceptReveal'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { EquityPredict } from '@/components/learn/steps/EquityPredict'
import { RangeBuild } from '@/components/learn/steps/RangeBuild'
import { ClassifyStep } from '@/components/learn/steps/ClassifyStep'
import { BetSizeSlider } from '@/components/learn/steps/BetSizeSlider'
import { MdfSlider } from '@/components/learn/steps/MdfSlider'
import { ScenarioTree } from '@/components/learn/steps/ScenarioTree'
import { RangeHeatmap } from '@/components/learn/steps/RangeHeatmap'
import { PositionTable } from '@/components/learn/steps/PositionTable'
import { ComboVisualizer } from '@/components/learn/steps/ComboVisualizer'
import { ActionSequence } from '@/components/learn/steps/ActionSequence'
import { SprVisualizer } from '@/components/learn/steps/SprVisualizer'
import { RangeMorphology } from '@/components/learn/steps/RangeMorphology'
import { PotOddsExplorer } from '@/components/learn/steps/PotOddsExplorer'
import { EquityBalance } from '@/components/learn/steps/EquityBalance'
import { OutsDeckVisualizer } from '@/components/learn/steps/OutsDeckVisualizer'
import { RangeCompare } from '@/components/learn/steps/RangeCompare'
import { EVDecisionTree } from '@/components/learn/steps/EVDecisionTree'
import { BluffBreakEvenVisualizer } from '@/components/learn/steps/BluffBreakEvenVisualizer'
import { EquityRealizationVisualizer } from '@/components/learn/steps/EquityRealizationVisualizer'
import { PlayersBehindVisualizer } from '@/components/learn/steps/PlayersBehindVisualizer'
import { HandDNA } from '@/components/learn/steps/HandDNA'
import { StackDepthRangeMorph } from '@/components/learn/steps/StackDepthRangeMorph'
import { DeadMoneyRangeVisualizer } from '@/components/learn/steps/DeadMoneyRangeVisualizer'
import { PreflopOpenSizeExplorer } from '@/components/learn/steps/PreflopOpenSizeExplorer'
import { StrategyComplexityMeter } from '@/components/learn/steps/StrategyComplexityMeter'
import { RangeDiffOverlay } from '@/components/learn/steps/RangeDiffOverlay'
import { RangeBucketSort } from '@/components/learn/steps/RangeBucketSort'
import { MorphologyBuilder } from '@/components/learn/steps/MorphologyBuilder'
import { BlockerLab } from '@/components/learn/steps/BlockerLab'
import { ReraiseSizingSlider } from '@/components/learn/steps/ReraiseSizingSlider'
import { DefenseLens } from '@/components/learn/steps/DefenseLens'
import { FlopScanner } from '@/components/learn/steps/FlopScanner'
import { FlopClassifyDrill } from '@/components/learn/steps/FlopClassifyDrill'
import { SuitIsomorphism } from '@/components/learn/steps/SuitIsomorphism'
import { FlopBuilder } from '@/components/learn/steps/FlopBuilder'
import { StraightDetective } from '@/components/learn/steps/StraightDetective'
import { BoardVolatility } from '@/components/learn/steps/BoardVolatility'
import { RangeBoardCollision } from '@/components/learn/steps/RangeBoardCollision'
import { EquityBucket } from '@/components/learn/steps/EquityBucket'
import { BoardAutopsy } from '@/components/learn/steps/BoardAutopsy'
import { HandRankingOrder } from '@/components/learn/steps/HandRankingOrder'
import type { ActionQuality } from '@/lib/learn/types'
import { LevelUpOverlay } from '@/components/learn/LevelUpOverlay'
import { ConceptTagRow } from '@/components/learn/ConceptPopover'
import { LessonCompletionScreen } from '@/components/learn/LessonCompletionScreen'
import { ConfidencePrompt } from '@/components/learn/ConfidencePrompt'
import { recordConceptResult, pickInjectedStep } from '@/lib/learn/adaptiveEngine'

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'confidence' | 'step' | 'feedback' | 'summary'

/** Concept ids that name the exact answer to a step quizzing that same concept
 *  (e.g. a step classifying "+EV / 0EV / -EV" tagged with concept_id "positive_ev"
 *  would spoil itself if the tag were shown before answering). */
const SPOILER_CONCEPT_TAGS = new Set([
  'positive_ev', 'zero_ev', 'negative_ev', 'first_in',
  // Module 4/5 additions — each of these is also used as a literal option id
  // (or range_bucket category id) on at least one identify-the-term/classify
  // step, so showing the chip before answering would print the answer.
  'polarized', 'blockers', 'squeeze', 'rejam', 'domination',
])

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  current,
  total,
  className,
}: {
  current: number
  total: number
  className?: string
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground/50">
        <span>
          Step {Math.min(current + 1, total)} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Chapter progress ──────────────────────────────────────────────────────────

function ChapterProgress({
  chapters,
  currentStepId,
}: {
  chapters: NonNullable<Lesson['chapters']>
  currentStepId: string
}) {
  const currentIndex = chapters.findIndex((c) => c.step_ids.includes(currentStepId))
  if (currentIndex < 0) return null

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400/70 shrink-0">
        Ch. {currentIndex + 1}/{chapters.length}
      </span>
      <span className="hidden sm:block flex-1 min-w-0 text-[10px] font-semibold text-muted-foreground/40 truncate">
        {chapters[currentIndex].title}
      </span>
      <div className="flex items-center gap-1 shrink-0 min-w-0 overflow-hidden">
        {chapters.map((c, i) => (
          <div
            key={c.title}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 shrink-0',
              i < currentIndex ? 'w-1.5 bg-violet-500/70' : i === currentIndex ? 'w-4 bg-violet-400' : 'w-1.5 bg-white/10',
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step dispatcher ───────────────────────────────────────────────────────────

function StepRenderer({
  step,
  currentXP,
  onResult,
}: {
  step: LessonStep
  currentXP: number
  onResult: (result: StepResult, userResponse: unknown, timeMs: number) => void
}) {
  // Evaluate locally — instant, deterministic, no network dependency
  function evaluate(userResponse: unknown, timeMs: number) {
    const result = evaluateStepLocally(step, userResponse, currentXP)
    onResult(result, userResponse, timeMs)
  }

  if (step.type === 'concept_reveal') {
    // Passive content — nothing to answer. evaluate() will produce an
    // unscored result, which LessonPlayer's handleResult advances past
    // instantly without a graded feedback screen.
    return <ConceptReveal step={step} onComplete={() => evaluate(null, 0)} />
  }

  if (step.type === 'defense_lens') {
    // Also unscored — the framework is explored, not quizzed.
    return <DefenseLens step={step} onComplete={() => evaluate(null, 0)} />
  }

  if (step.type === 'bet_size_choose') {
    return <BetSizeSlider step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'decision_spot') {
    return <DecisionSpot step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'equity_predict') {
    return <EquityPredict step={step} onAnswer={(eq, ms) => evaluate(eq, ms)} />
  }

  if (step.type === 'range_build') {
    return <RangeBuild step={step} onAnswer={(combos, ms) => evaluate(combos, ms)} />
  }

  if (step.type === 'range_heatmap') {
    return <RangeHeatmap step={step} onAnswer={(hands, ms) => evaluate(hands, ms)} />
  }

  if (step.type === 'mdf_slider') {
    return <MdfSlider step={step} onAnswer={(val, ms) => evaluate(val, ms)} />
  }

  if (step.type === 'scenario_tree') {
    return (
      <ScenarioTree
        step={step}
        onAnswer={(quality: ActionQuality, explanation: string, ms: number) =>
          evaluate({ quality, explanation }, ms)
        }
      />
    )
  }

  if (step.type === 'position_table') {
    return <PositionTable step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'combo_visualizer') {
    return <ComboVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'action_sequence') {
    return <ActionSequence step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'spr_visualizer') {
    return <SprVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'range_morphology') {
    return <RangeMorphology step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'pot_odds_explorer') {
    return <PotOddsExplorer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'equity_balance') {
    return <EquityBalance step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'outs_deck') {
    return <OutsDeckVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'range_compare') {
    return <RangeCompare step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'ev_tree') {
    return <EVDecisionTree step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'bluff_breakeven') {
    return <BluffBreakEvenVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'equity_realization') {
    return <EquityRealizationVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'players_behind') {
    return <PlayersBehindVisualizer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'hand_dna') {
    return <HandDNA step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'stack_depth_morph') {
    return <StackDepthRangeMorph step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'dead_money_visualizer') {
    return <DeadMoneyRangeVisualizer step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'open_size_explorer') {
    return <PreflopOpenSizeExplorer step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'strategy_complexity') {
    return <StrategyComplexityMeter step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'range_diff') {
    return <RangeDiffOverlay step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'range_bucket') {
    return <RangeBucketSort step={step} onAnswer={(assignments, ms) => evaluate(assignments, ms)} />
  }

  if (step.type === 'morphology_builder') {
    return <MorphologyBuilder step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'blocker_lab') {
    return <BlockerLab step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'sizing_slider') {
    return <ReraiseSizingSlider step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  // ── Understanding the Flop (Module 6) ─────────────────────────────────────

  if (step.type === 'flop_scanner') {
    // Always unscored — an inspection tool, not a quiz.
    return <FlopScanner step={step} onComplete={() => evaluate(null, 0)} />
  }

  if (step.type === 'flop_classify_drill') {
    return <FlopClassifyDrill step={step} onAnswer={(answers, ms) => evaluate(answers, ms)} />
  }

  if (step.type === 'suit_isomorphism') {
    return (
      <SuitIsomorphism
        step={step}
        onAnswer={(id, ms) => evaluate(id, ms)}
        onComplete={() => evaluate(null, 0)}
      />
    )
  }

  if (step.type === 'flop_builder') {
    return <FlopBuilder step={step} onAnswer={(board, ms) => evaluate(board, ms)} />
  }

  if (step.type === 'straight_detective') {
    return <StraightDetective step={step} onAnswer={(ids, ms) => evaluate(ids, ms)} />
  }

  if (step.type === 'board_volatility') {
    return <BoardVolatility step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'range_board_collision') {
    return <RangeBoardCollision step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'equity_bucket') {
    return <EquityBucket step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'board_autopsy') {
    return <BoardAutopsy step={step} onAnswer={(keys, ms) => evaluate(keys, ms)} />
  }

  if (step.type === 'hand_ranking_order') {
    return <HandRankingOrder step={step} onAnswer={(order, ms) => evaluate(order, ms)} />
  }

  // Classify-family: board_classify, nut_advantage, blocker_id, range_identify, bluff_pick, reflection_prompt
  return <ClassifyStep step={step} onAnswer={(answer, ms) => evaluate(answer, ms)} />
}

// ── Intro screen ──────────────────────────────────────────────────────────────

function IntroScreen({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  const lessonTypeLabel = {
    micro: 'Quick Lesson',
    range_trainer: 'Range Training',
    puzzle_drill: 'Puzzle Drill',
    concept_reveal: 'Concept Reveal',
    simulation: 'Simulation',
  }[lesson.lesson_type] ?? lesson.lesson_type.replace(/_/g, ' ')

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center animate-in fade-in duration-300">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/25">
        <BookOpen className="h-8 w-8 text-violet-400" />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/60">
          {lessonTypeLabel}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground/50" />
          <span>~{lesson.estimated_min} min</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-400/70" />
          <span className="text-amber-300/80 font-semibold">{lesson.xp_reward} XP</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
          <span>{lesson.steps.length} steps</span>
        </div>
      </div>

      {/* Concepts covered — with interactive popovers */}
      {lesson.concept_ids.length > 0 && (
        <ConceptTagRow conceptIds={lesson.concept_ids} />
      )}

      <button
        type="button"
        onClick={onStart}
        className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
        Start Lesson
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  )
}


// ── Main LessonPlayer ─────────────────────────────────────────────────────────

interface LessonPlayerProps {
  lesson: Lesson
  /** User's total XP before starting this lesson — used for accurate level-up detection */
  userXP?: number
  /** Step index to resume at (0 = start from the beginning) */
  initialStepIndex?: number
  onComplete: (score: number, xpEarned: number) => void
  /** Fired once, the INSTANT the lesson reaches its completed state (i.e. as
   *  the summary screen is entered) — not when the user later clicks a button
   *  on that screen. The caller should start the durable server-side
   *  completion write here, so it is already in flight even if the learner
   *  closes the tab while looking at the celebration screen. `onComplete`
   *  (above) still fires on the "Continue Learning" click, for whatever
   *  UI transition the caller wants to gate on that explicit action. */
  onLessonFinished?: (score: number, xpEarned: number) => void
  /** Fired once per answered/viewed step, for the caller to persist via LearnProgressContext */
  onStepResult?: (
    step: LessonStep,
    stepIndex: number,
    result: StepResult,
    userResponse: unknown,
    timeMs: number,
  ) => void
}

/** Same "exclude passive/invalid steps" rule used by the completion screen —
 *  kept in one place so the early (onLessonFinished) and late (onComplete)
 *  score computations can never drift apart. */
function computeAvgScore(results: StepResult[]): number {
  const scored = results.filter((r) => r.evaluation_valid !== false && !r.unscored)
  if (scored.length === 0) return 100
  return Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
}

export function LessonPlayer({
  lesson,
  userXP = 0,
  initialStepIndex = 0,
  onComplete,
  onLessonFinished,
  onStepResult,
}: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(
    Math.min(Math.max(initialStepIndex, 0), Math.max(lesson.steps.length - 1, 0)),
  )
  const [results, setResults] = useState<StepResult[]>([])
  const [latestResult, setLatestResult] = useState<StepResult | null>(null)
  const [totalXP, setTotalXP] = useState(0)
  // Dynamic step queue — starts as the authored lesson.steps, but a wrong answer on a step
  // with a `remediation_ladder` (or a low-confidence correct answer with a `reinforcement_step`)
  // splices an extra step in right after the current index.
  const [dynamicSteps, setDynamicSteps] = useState<LessonStep[]>(lesson.steps)
  const [pendingConfidence, setPendingConfidence] = useState<'low' | 'medium' | 'high' | null>(null)

  // Running XP = user's pre-lesson total + XP earned so far in this lesson
  // Used by the local evaluator for accurate level tracking
  const runningXP = userXP + totalXP

  // Level-up overlay state
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; xp: number } | null>(null)

  const steps = dynamicSteps
  const currentStep: LessonStep | undefined = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  const handleStart = useCallback(() => {
    setPhase(currentStep?.ask_confidence ? 'confidence' : 'step')
  }, [currentStep])

  const handleConfidenceSelect = useCallback((level: 'low' | 'medium' | 'high') => {
    setPendingConfidence(level)
    setPhase('step')
  }, [])

  // Advance to the next step (or the lesson summary, if this was the last one).
  // Shared by the unscored/passive path (skips feedback entirely) and the
  // scored path's "Continue" button (after the feedback screen).
  const advanceStep = useCallback(() => {
    if (isLastStep) {
      setPhase('summary')
    } else {
      const next = steps[currentStepIndex + 1]
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPendingConfidence(null)
      setPhase(next?.ask_confidence ? 'confidence' : 'step')
    }
  }, [isLastStep, currentStepIndex, steps])

  const handleResult = useCallback((result: StepResult, userResponse: unknown, timeMs: number) => {
    // Merge in the learner's self-reported confidence, if this step asked for one
    const enriched: StepResult = pendingConfidence
      ? { ...result, learner_confidence: pendingConfidence }
      : result

    setResults((prev) => [...prev, enriched])
    setTotalXP((prev) => prev + enriched.xp_earned)

    if (currentStep) {
      onStepResult?.(currentStep, currentStepIndex, enriched, userResponse, timeMs)
      recordConceptResult(currentStep.concept_ids?.[0], enriched.quality)
    }

    if (enriched.unscored) {
      // Passive/informational step — nothing was graded, so there's no result
      // to show. Skip the feedback screen and go straight to the next step.
      advanceStep()
      return
    }

    setLatestResult(enriched)
    setPhase('feedback')

    // Trigger level-up overlay
    if (enriched.leveled_up && enriched.level_after) {
      setLevelUpData({ level: enriched.level_after, xp: enriched.xp_earned })
      setShowLevelUp(true)
    }
  }, [currentStep, currentStepIndex, onStepResult, pendingConfidence, advanceStep])

  const handleRetry = useCallback(() => {
    // Go back to the step so the user can re-answer (failed evaluation, no penalty)
    setLatestResult(null)
    setResults((prev) => prev.slice(0, -1))  // remove the failed result
    setPhase('step')
  }, [])

  const handleContinue = useCallback(() => {
    const injected = currentStep && latestResult ? pickInjectedStep(currentStep, latestResult) : null

    if (injected) {
      setDynamicSteps((prev) => {
        const next = [...prev]
        next.splice(currentStepIndex + 1, 0, injected)
        return next
      })
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPendingConfidence(null)
      setPhase(injected.ask_confidence ? 'confidence' : 'step')
      return
    }

    advanceStep()
  }, [currentStep, currentStepIndex, latestResult, advanceStep])

  const handleSummaryDone = useCallback(() => {
    onComplete(computeAvgScore(results), totalXP)
  }, [results, totalXP, onComplete])

  // Fires the durable completion write the INSTANT the lesson reaches its
  // completed state — i.e. as soon as `phase` becomes 'summary' — rather than
  // waiting for the user to click "Continue Learning" on the celebration
  // screen. A learner who answers the final question and immediately closes
  // the tab must not lose that completion: the request needs to already be
  // in flight before any button click could happen. Guarded by a ref (not
  // state) so it fires exactly once per attempt and never re-fires on an
  // unrelated re-render; `onRetry` below resets the guard for a genuine retry.
  const lessonFinishedFiredRef = useRef(false)
  useEffect(() => {
    if (phase !== 'summary') return
    if (lessonFinishedFiredRef.current) return
    lessonFinishedFiredRef.current = true
    onLessonFinished?.(computeAvgScore(results), totalXP)
    // Intentionally NOT depending on `results`/`totalXP` beyond this one fire —
    // they're stable by the time `phase` flips to 'summary' (see call sites of
    // advanceStep), and re-running this effect on their identity is unwanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Level-up overlay ───────────────────────────────────────────────────────
  if (showLevelUp && levelUpData) {
    return (
      <LevelUpOverlay
        newLevel={levelUpData.level}
        xpEarned={levelUpData.xp}
        onDismiss={() => {
          setShowLevelUp(false)
          setLevelUpData(null)
        }}
      />
    )
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return <IntroScreen lesson={lesson} onStart={handleStart} />
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    return (
      <LessonCompletionScreen
        lesson={lesson}
        results={results}
        totalXP={totalXP}
        onContinue={handleSummaryDone}
        onRetry={() => {
          lessonFinishedFiredRef.current = false
          setResults([])
          setTotalXP(0)
          setDynamicSteps(lesson.steps)
          setCurrentStepIndex(0)
          setLatestResult(null)
          setPendingConfidence(null)
          setPhase('intro')
        }}
        onCoachReview={() => { window.location.href = '/coach' }}
      />
    )
  }

  // ── Step / Feedback ────────────────────────────────────────────────────────
  if (!currentStep) return null

  const hasContext =
    currentStep.board?.length ||
    currentStep.hero_position ||
    currentStep.villain_position ||
    currentStep.pot_bb != null

  return (
    <div className="flex flex-col gap-5">
      {/* Chapter progress */}
      {lesson.chapters && lesson.chapters.length > 0 && (
        <ChapterProgress chapters={lesson.chapters} currentStepId={currentStep.id} />
      )}

      {/* Progress — measured against the lesson's authored step count, not the dynamically
          extended one, so an injected remediation/reinforcement step doesn't make the bar
          jump backward in perceived percentage. */}
      <ProgressBar
        current={Math.min(currentStepIndex, Math.max(lesson.steps.length - 1, 0))}
        total={lesson.steps.length}
      />

      {/* Context bar */}
      {hasContext && (
        <PokerContextBar
          board={currentStep.board}
          heroPosition={currentStep.hero_position}
          villainPosition={currentStep.villain_position}
          potBb={currentStep.pot_bb}
          effectiveStackBb={currentStep.effective_stack_bb}
          street={currentStep.street}
          heroHand={currentStep.hero_hand}
        />
      )}

      {/* Concept tags — appear above interactive step.
          Skipped for range_morphology and for steps tagged with a SPOILER_CONCEPT_TAG:
          those concept_ids (e.g. "polarized_range", "positive_ev") name the very answer
          the step is quizzing, so showing them here would give away the question. The
          tag still drives mastery tracking via evaluate(). */}
      {currentStep.concept_ids && currentStep.concept_ids.length > 0 && phase === 'step'
        && currentStep.type !== 'range_morphology'
        && !currentStep.concept_ids.some((c) => SPOILER_CONCEPT_TAGS.has(c)) && (
        <ConceptTagRow conceptIds={currentStep.concept_ids} />
      )}

      {/* Step card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
        {phase === 'confidence' && (
          <ConfidencePrompt onSelect={handleConfidenceSelect} />
        )}

        {phase === 'step' && (
          <StepRenderer
            step={currentStep}
            currentXP={runningXP}
            onResult={handleResult}
          />
        )}

        {phase === 'feedback' && latestResult && (
          <StepFeedback
            result={latestResult}
            onContinue={handleContinue}
            onRetry={handleRetry}
            isLast={isLastStep}
          />
        )}
      </div>
    </div>
  )
}
