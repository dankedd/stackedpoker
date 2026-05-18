'use client'

import { useState, useCallback } from 'react'
import {
  CheckCircle2, Clock, Zap, ChevronRight, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, LessonStep, StepResult } from '@/lib/learn/types'
import { makeFailedResult } from '@/lib/learn/types'
import { evaluateStep } from '@/lib/learn/api'
import { PokerContextBar } from '@/components/learn/PokerContextBar'
import { StepFeedback } from '@/components/learn/StepFeedback'
import { XPGain } from '@/components/learn/XPGain'
import { ConceptReveal } from '@/components/learn/steps/ConceptReveal'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { EquityPredict } from '@/components/learn/steps/EquityPredict'
import { RangeBuild } from '@/components/learn/steps/RangeBuild'
import { ClassifyStep } from '@/components/learn/steps/ClassifyStep'
import { BetSizeSlider } from '@/components/learn/steps/BetSizeSlider'
import { MdfSlider } from '@/components/learn/steps/MdfSlider'
import { ScenarioTree } from '@/components/learn/steps/ScenarioTree'
import { RangeHeatmap } from '@/components/learn/steps/RangeHeatmap'
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

// ── Step dispatcher ───────────────────────────────────────────────────────────

function StepRenderer({
  step,
  lessonId,
  token,
  onResult,
  onConceptComplete,
}: {
  step: LessonStep
  lessonId: string
  token: string
  onResult: (result: StepResult) => void
  onConceptComplete: (result: StepResult) => void
}) {
  async function callEvaluate(userResponse: unknown, timeMs: number) {
    try {
      const result = await evaluateStep(lessonId, step.id, userResponse, timeMs, token)
      onResult(result)
    } catch {
      onResult(makeFailedResult('network_error'))
    }
  }

  if (step.type === 'concept_reveal') {
    return (
      <ConceptReveal
        step={step}
        onComplete={() =>
          onConceptComplete({
            score: 100,
            quality: 'perfect',
            ev_loss_bb: 0,
            feedback: 'Concept reviewed.',
            xp_earned: step.xp ?? 20,
            level_before: 1,
            level_after: 1,
            leveled_up: false,
            evaluation_source: 'theory_engine',
            confidence: 'high',
            evaluation_valid: true,
            fallback_used: false,
          })
        }
      />
    )
  }

  if (step.type === 'bet_size_choose') {
    return (
      <BetSizeSlider
        step={step}
        onAnswer={(optionId, timeMs) => callEvaluate(optionId, timeMs)}
      />
    )
  }

  if (step.type === 'decision_spot') {
    return (
      <DecisionSpot
        step={step}
        onAnswer={(optionId, timeMs) => callEvaluate(optionId, timeMs)}
      />
    )
  }

  if (step.type === 'equity_predict') {
    return (
      <EquityPredict
        step={step}
        onAnswer={(equity, timeMs) => callEvaluate(equity, timeMs)}
      />
    )
  }

  if (step.type === 'range_build') {
    return (
      <RangeBuild
        step={step}
        onAnswer={(combos, timeMs) => callEvaluate(combos, timeMs)}
      />
    )
  }

  if (step.type === 'range_heatmap') {
    return (
      <RangeHeatmap
        step={step}
        onAnswer={(hands, timeMs) => callEvaluate(hands, timeMs)}
      />
    )
  }

  if (step.type === 'mdf_slider') {
    return (
      <MdfSlider
        step={step}
        onAnswer={(value, timeMs) => callEvaluate(value, timeMs)}
      />
    )
  }

  if (step.type === 'scenario_tree') {
    return (
      <ScenarioTree
        step={step}
        onAnswer={(quality: ActionQuality, timeMs: number) => callEvaluate(quality, timeMs)}
      />
    )
  }

  // Classify-family: board_classify, nut_advantage, blocker_id, range_identify, bluff_pick, reflection_prompt
  return (
    <ClassifyStep
      step={step}
      onAnswer={(answer, timeMs) => callEvaluate(answer, timeMs)}
    />
  )
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
  token: string
  onComplete: (score: number, xpEarned: number) => void
}

export function LessonPlayer({ lesson, token, onComplete }: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [results, setResults] = useState<StepResult[]>([])
  const [latestResult, setLatestResult] = useState<StepResult | null>(null)
  const [totalXP, setTotalXP] = useState(0)

  // Level-up overlay state
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; xp: number } | null>(null)

  const steps = lesson.steps
  const currentStep: LessonStep | undefined = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1

  const handleStart = useCallback(() => {
    setPhase('step')
  }, [])

  const handleResult = useCallback((result: StepResult) => {
    setLatestResult(result)
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    setPhase('feedback')

    // Trigger level-up overlay
    if (result.leveled_up && result.level_after) {
      setLevelUpData({ level: result.level_after, xp: result.xp_earned })
      setShowLevelUp(true)
    }
  }, [])

  const handleConceptComplete = useCallback((result: StepResult) => {
    setResults((prev) => [...prev, result])
    setTotalXP((prev) => prev + result.xp_earned)
    if (isLastStep) {
      setPhase('summary')
    } else {
      setCurrentStepIndex((i) => i + 1)
      setLatestResult(null)
      setPhase('step')
    }
  }, [isLastStep])

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

      {/* Concept tags — appear above interactive step */}
      {currentStep.concept_ids && currentStep.concept_ids.length > 0 && phase === 'step' && (
        <ConceptTagRow conceptIds={currentStep.concept_ids} />
      )}

      {/* Step card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
        {phase === 'step' && (
          <StepRenderer
            step={currentStep}
            lessonId={lesson.id}
            token={token}
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
