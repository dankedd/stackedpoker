'use client'

import { useState, useCallback } from 'react'
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
import type { ActionQuality } from '@/lib/learn/types'
import { LevelUpOverlay } from '@/components/learn/LevelUpOverlay'
import { ConceptTagRow } from '@/components/learn/ConceptPopover'
import { LessonCompletionScreen } from '@/components/learn/LessonCompletionScreen'

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'step' | 'feedback' | 'summary'

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
  onConceptComplete,
}: {
  step: LessonStep
  currentXP: number
  onResult: (result: StepResult, userResponse: unknown, timeMs: number) => void
  onConceptComplete: (result: StepResult) => void
}) {
  // Evaluate locally — instant, deterministic, no network dependency
  function evaluate(userResponse: unknown, timeMs: number) {
    const result = evaluateStepLocally(step, userResponse, currentXP)
    onResult(result, userResponse, timeMs)
  }

  if (step.type === 'concept_reveal') {
    return (
      <ConceptReveal
        step={step}
        onComplete={() => onConceptComplete(evaluateStepLocally(step, null, currentXP))}
      />
    )
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
  /** Fired once per answered/viewed step, for the caller to persist via LearnProgressContext */
  onStepResult?: (
    step: LessonStep,
    stepIndex: number,
    result: StepResult,
    userResponse: unknown,
    timeMs: number,
  ) => void
}

export function LessonPlayer({
  lesson,
  userXP = 0,
  initialStepIndex = 0,
  onComplete,
  onStepResult,
}: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(
    Math.min(Math.max(initialStepIndex, 0), Math.max(lesson.steps.length - 1, 0)),
  )
  const [results, setResults] = useState<StepResult[]>([])
  const [latestResult, setLatestResult] = useState<StepResult | null>(null)
  const [totalXP, setTotalXP] = useState(0)

  // Running XP = user's pre-lesson total + XP earned so far in this lesson
  // Used by the local evaluator for accurate level tracking
  const runningXP = userXP + totalXP

  // Level-up overlay state
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; xp: number } | null>(null)

  const steps = lesson.steps
  const currentStep: LessonStep | undefined = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  const handleStart = useCallback(() => {
    setPhase('step')
  }, [])

  const handleResult = useCallback((result: StepResult, userResponse: unknown, timeMs: number) => {
    setLatestResult(result)
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    setPhase('feedback')

    if (currentStep) {
      onStepResult?.(currentStep, currentStepIndex, result, userResponse, timeMs)
    }

    // Trigger level-up overlay
    if (result.leveled_up && result.level_after) {
      setLevelUpData({ level: result.level_after, xp: result.xp_earned })
      setShowLevelUp(true)
    }
  }, [currentStep, currentStepIndex, onStepResult])

  const handleConceptComplete = useCallback((result: StepResult) => {
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    if (currentStep) {
      onStepResult?.(currentStep, currentStepIndex, result, null, 0)
    }
    if (isLastStep) {
      setPhase('summary')
    } else {
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPhase('step')
    }
  }, [isLastStep, currentStep, currentStepIndex, onStepResult])

  const handleRetry = useCallback(() => {
    // Go back to the step so the user can re-answer (failed evaluation, no penalty)
    setLatestResult(null)
    setResults((prev) => prev.slice(0, -1))  // remove the failed result
    setPhase('step')
  }, [])

  const handleContinue = useCallback(() => {
    if (isLastStep) {
      setPhase('summary')
    } else {
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPhase('step')
    }
  }, [isLastStep])

  const handleSummaryDone = useCallback(() => {
    const valid = results.filter((r) => r.evaluation_valid !== false)
    const avgScore =
      valid.length > 0
        ? Math.round(valid.reduce((s, r) => s + r.score, 0) / valid.length)
        : 0
    onComplete(avgScore, totalXP)
  }, [results, totalXP, onComplete])

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
          setResults([])
          setTotalXP(0)
          setCurrentStepIndex(0)
          setLatestResult(null)
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

      {/* Progress */}
      <ProgressBar current={currentStepIndex} total={steps.length} />

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
          Skipped for range_morphology: its concept_ids (e.g. "polarized_range")
          name the very answer the step is quizzing, so showing them here would
          give away the question. The tag still drives mastery tracking via evaluate(). */}
      {currentStep.concept_ids && currentStep.concept_ids.length > 0 && phase === 'step' && currentStep.type !== 'range_morphology' && (
        <ConceptTagRow conceptIds={currentStep.concept_ids} />
      )}

      {/* Step card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
        {phase === 'step' && (
          <StepRenderer
            step={currentStep}
            currentXP={runningXP}
            onResult={handleResult}
            onConceptComplete={handleConceptComplete}
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
