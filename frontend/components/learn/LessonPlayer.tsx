'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  CheckCircle2, Clock, Zap, ChevronRight, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson, LessonStep, StepResult } from '@/lib/learn/types'
import { evaluateStepLocally } from '@/lib/learn/evaluator'
import { buildLessonReviewContext } from '@/lib/learn/coachReview'
import { COACH_REVIEW_STORAGE_KEY } from '@/lib/learn/coachReviewStorage'
import { PokerContextBar } from '@/components/learn/PokerContextBar'
import { StepFeedback } from '@/components/learn/StepFeedback'
import { PreviousButton } from '@/components/learn/PreviousButton'
import { ConceptReveal } from '@/components/learn/steps/ConceptReveal'
import { DecisionSpot } from '@/components/learn/steps/DecisionSpot'
import { EquityPredict } from '@/components/learn/steps/EquityPredict'
import { RangeBuild } from '@/components/learn/steps/RangeBuild'
import { MultiActionRangeBuild } from '@/components/learn/steps/MultiActionRangeBuild'
import { TableDecision } from '@/components/learn/steps/TableDecision'
import { MttStackDepthCompare } from '@/components/learn/steps/MttStackDepthCompare'
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
import { ComboRemovalOverlay } from '@/components/learn/steps/ComboRemovalOverlay'
import { FlushPyramid } from '@/components/learn/steps/FlushPyramid'
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
import { PotWinIntro } from '@/components/learn/steps/PotWinIntro'
import { CardsIdentify } from '@/components/learn/steps/CardsIdentify'
import { BuildFirstHand } from '@/components/learn/steps/BuildFirstHand'
import { RangeDistributionBar } from '@/components/learn/steps/RangeDistributionBar'
import { FrequencySizeLab } from '@/components/learn/steps/FrequencySizeLab'
import { BoardRankSort } from '@/components/learn/steps/BoardRankSort'
import { BoardSortingPuzzle } from '@/components/learn/steps/BoardSortingPuzzle'
import { RangeCollision } from '@/components/learn/steps/RangeCollision'
import { RangeEquityPredict } from '@/components/learn/steps/RangeEquityPredict'
import { RangeXRayStep } from '@/components/learn/steps/RangeXRayStep'
import { TendencySummary } from '@/components/learn/steps/TendencySummary'
import type { ActionQuality } from '@/lib/learn/types'
import { LevelUpOverlay } from '@/components/learn/LevelUpOverlay'
import { ConceptTagRow } from '@/components/learn/ConceptPopover'
import { LessonCompletionScreen } from '@/components/learn/LessonCompletionScreen'
import { recordConceptResult, pickInjectedStep } from '@/lib/learn/adaptiveEngine'

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'step' | 'feedback' | 'summary'

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
  steps,
  resultsByStepId,
}: {
  step: LessonStep
  currentXP: number
  onResult: (result: StepResult, userResponse: unknown, timeMs: number) => void
  /** Full lesson step list + this playthrough's real results so far — only read by
   *  'tendency_summary' steps (see TendencySummary.tsx). Every other step type ignores them. */
  steps: LessonStep[]
  resultsByStepId: Map<string, StepResult>
}) {
  // Evaluate locally — instant, deterministic, no network dependency
  function evaluate(userResponse: unknown, timeMs: number) {
    const result = evaluateStepLocally(step, userResponse, currentXP)
    onResult(result, userResponse, timeMs)
  }

  if (step.type === 'tendency_summary') {
    return (
      <TendencySummary
        step={step}
        steps={steps}
        resultsByStepId={resultsByStepId}
        onComplete={() => evaluate(null, 0)}
      />
    )
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

  if (step.type === 'range_build_multi') {
    return <MultiActionRangeBuild step={step} onAnswer={(assignments, ms) => evaluate(assignments, ms)} />
  }

  if (step.type === 'table_decision') {
    return <TableDecision step={step} onAnswer={(optionId, ms) => evaluate(optionId, ms)} />
  }

  if (step.type === 'mtt_stack_depth_compare') {
    return <MttStackDepthCompare step={step} onAnswer={(optionId, ms) => evaluate(optionId, ms)} />
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

  // ── Blockers & Card Removal (Module 9) ────────────────────────────────────

  if (step.type === 'combo_removal') {
    return <ComboRemovalOverlay step={step} onAnswer={(keys, ms) => evaluate(keys, ms)} />
  }

  if (step.type === 'flush_pyramid') {
    return <FlushPyramid step={step} onAnswer={(tiers, ms) => evaluate(tiers, ms)} />
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

  // ── Lesson 1 opening interactive beats ──────────────────────────────────

  if (step.type === 'pot_win_intro') {
    // Purely exploratory onboarding — unscored, no feedback screen.
    return <PotWinIntro step={step} onComplete={() => evaluate(null, 0)} />
  }

  if (step.type === 'cards_identify') {
    return <CardsIdentify step={step} onAnswer={(cards, ms) => evaluate(cards, ms)} />
  }

  if (step.type === 'build_first_hand') {
    return <BuildFirstHand step={step} onAnswer={(cards, ms) => evaluate(cards, ms)} />
  }

  if (step.type === 'range_distribution') {
    return <RangeDistributionBar step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'cbet_frequency_size') {
    return <FrequencySizeLab step={step} onAnswer={(id, ms) => evaluate(id, ms)} />
  }

  if (step.type === 'board_rank_sort') {
    return step.board_rank_sort_layout === 'spectrum' ? (
      <BoardSortingPuzzle step={step} onAnswer={(order, ms) => evaluate(order, ms)} />
    ) : (
      <BoardRankSort step={step} onAnswer={(order, ms) => evaluate(order, ms)} />
    )
  }

  // ── Range vs Range (Module 8) ─────────────────────────────────────────────

  if (step.type === 'range_collision') {
    return <RangeCollision step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
  }

  if (step.type === 'range_equity_predict') {
    return <RangeEquityPredict step={step} onAnswer={(value, ms) => evaluate(value, ms)} />
  }

  if (step.type === 'range_xray') {
    return <RangeXRayStep step={step} onAnswer={(response, ms) => evaluate(response, ms)} />
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
  /** True while the caller's "Continue Learning" click is awaiting the
   *  durable completion write — surfaced on the primary CTA so a slow save
   *  reads as "in progress" instead of an inert, unresponsive button. */
  isCompletionPending?: boolean
  /** Set by the caller when the completion write failed (after its own
   *  retries) — swaps the CTA into a retry affordance instead of leaving it
   *  looking like it silently did nothing. */
  completionError?: string | null
  /** Fired once per answered/viewed step, for the caller to persist via LearnProgressContext */
  onStepResult?: (
    step: LessonStep,
    stepIndex: number,
    result: StepResult,
    userResponse: unknown,
    timeMs: number,
  ) => void
  /** Fired whenever the visible step index changes — including backward
   *  navigation, which never touches onStepResult. Purely cosmetic (e.g. a
   *  header progress-dot indicator); never used for persistence. */
  onStepIndexChange?: (stepIndex: number) => void
}

/** Same "exclude passive/invalid steps" rule used by the completion screen —
 *  kept in one place so the early (onLessonFinished) and late (onComplete)
 *  score computations can never drift apart. */
function computeAvgScore(results: StepResult[]): number {
  const scored = results.filter((r) => r.evaluation_valid !== false && !r.unscored)
  if (scored.length === 0) return 100
  return Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
}

/** A step's recorded outcome, kept so backward navigation can redisplay it
 *  without re-evaluating, re-awarding XP, or re-persisting anything. */
interface AnsweredEntry {
  result: StepResult
  userResponse: unknown
  timeMs: number
}

export function LessonPlayer({
  lesson,
  userXP = 0,
  initialStepIndex = 0,
  onComplete,
  onLessonFinished,
  isCompletionPending,
  completionError,
  onStepResult,
  onStepIndexChange,
}: LessonPlayerProps) {
  const clampedInitialIndex = Math.min(Math.max(initialStepIndex, 0), Math.max(lesson.steps.length - 1, 0))
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentStepIndex, setCurrentStepIndex] = useState(clampedInitialIndex)
  const [results, setResults] = useState<StepResult[]>([])
  const [latestResult, setLatestResult] = useState<StepResult | null>(null)
  const [totalXP, setTotalXP] = useState(0)
  // Dynamic step queue — starts as the authored lesson.steps, but a wrong answer on a step
  // with a `remediation_ladder` splices an extra step in right after the current index.
  const [dynamicSteps, setDynamicSteps] = useState<LessonStep[]>(lesson.steps)
  // Every step index answered/viewed so far this session, keyed by index —
  // the idempotency guard for backward navigation: re-visiting one of these
  // never re-scores, re-awards XP, or re-persists (see gotoIndex/handleResult).
  const [answeredSteps, setAnsweredSteps] = useState<Map<number, AnsweredEntry>>(new Map())
  // Furthest step index this session has ever reached — distinct from
  // currentStepIndex, which can move backward. Used solely to tell "the user
  // is stepping into genuinely new territory" (may need adaptive injection)
  // apart from "the user is re-walking territory already resolved" (must not
  // inject a second remediation/reinforcement step).
  const [maxIndexReached, setMaxIndexReached] = useState(clampedInitialIndex)

  // Running XP = user's pre-lesson total + XP earned so far in this lesson
  // Used by the local evaluator for accurate level tracking
  const runningXP = userXP + totalXP

  // Step id -> this playthrough's REAL result so far — the only thing a
  // 'tendency_summary' step is allowed to read (see TendencySummary.tsx).
  // Derived, never itself stored, so it can never drift from answeredSteps.
  const resultsByStepId = useMemo(() => {
    const map = new Map<string, StepResult>()
    for (const [index, entry] of answeredSteps) {
      const id = dynamicSteps[index]?.id
      if (id) map.set(id, entry.result)
    }
    return map
  }, [answeredSteps, dynamicSteps])

  // Level-up overlay state
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; xp: number } | null>(null)

  const steps = dynamicSteps
  const currentStep: LessonStep | undefined = steps[currentStepIndex]
  const isLastStep = currentStepIndex === steps.length - 1
  const canGoPrevious = currentStepIndex > 0

  const handleStart = useCallback(() => {
    setPhase('step')
  }, [])

  // Single place that actually moves `currentStepIndex` anywhere — forward
  // (advanceStep/handleContinue) or backward (handlePrevious). Re-deriving
  // phase/latestResult from `answeredSteps` here (rather than at each call
  // site) is what makes revisiting an already-answered step show its stored
  // feedback, and revisiting a passive step reopen it fresh, no matter which
  // direction we arrived from.
  const gotoIndex = useCallback((targetIndex: number) => {
    if (targetIndex >= steps.length) {
      setPhase('summary')
      return
    }
    const entry = answeredSteps.get(targetIndex)
    setCurrentStepIndex(targetIndex)
    setMaxIndexReached((m) => Math.max(m, targetIndex))
    if (entry && !entry.result.unscored) {
      // Already-graded step — reopen the feedback screen instead of the
      // (now stale) interactive question, so the recorded answer can never
      // be resubmitted to farm XP or change the score.
      setLatestResult(entry.result)
      setPhase('feedback')
    } else {
      // Either a brand-new step, or a passive/theory step being revisited —
      // both simply reopen the step itself.
      setLatestResult(null)
      setPhase('step')
    }
  }, [steps, answeredSteps])

  // Advance to the next step (or the lesson summary, if this was the last one).
  // Shared by the unscored/passive path (skips feedback entirely) and the
  // scored path's "Continue" button (after the feedback screen).
  const advanceStep = useCallback(() => {
    gotoIndex(currentStepIndex + 1)
  }, [gotoIndex, currentStepIndex])

  const handlePrevious = useCallback(() => {
    if (currentStepIndex <= 0) return
    gotoIndex(currentStepIndex - 1)
  }, [currentStepIndex, gotoIndex])

  const handleResult = useCallback((result: StepResult, userResponse: unknown, timeMs: number) => {
    // A passive/theory step reopened via "Previous" fires onComplete again
    // when the learner clicks through it a second time. It must not be
    // re-scored, re-added to totals, or re-sent to the caller for
    // persistence — that's exactly the "no duplicate completion records /
    // no double XP" requirement for backward navigation. (Scored steps never
    // reach this branch a second time: revisiting one always lands on the
    // stored feedback screen, not the interactive question — see gotoIndex.)
    const alreadyRecorded = answeredSteps.has(currentStepIndex)

    if (!alreadyRecorded) {
      setResults((prev) => [...prev, result])
      setTotalXP((prev) => prev + result.xp_earned)
      setAnsweredSteps((prev) => {
        const next = new Map(prev)
        next.set(currentStepIndex, { result, userResponse, timeMs })
        return next
      })

      if (currentStep) {
        onStepResult?.(currentStep, currentStepIndex, result, userResponse, timeMs)
        recordConceptResult(currentStep.concept_ids?.[0], result.quality)
      }

      // Trigger level-up overlay
      if (result.leveled_up && result.level_after) {
        setLevelUpData({ level: result.level_after, xp: result.xp_earned })
        setShowLevelUp(true)
      }
    }

    if (result.unscored) {
      // Passive/informational step — nothing was graded, so there's no result
      // to show. Skip the feedback screen and go straight to the next step.
      advanceStep()
      return
    }

    setLatestResult(result)
    setPhase('feedback')
  }, [currentStep, currentStepIndex, onStepResult, advanceStep, answeredSteps])

  const handleRetry = useCallback(() => {
    // Go back to the step so the user can re-answer (failed evaluation, no penalty)
    setLatestResult(null)
    setResults((prev) => prev.slice(0, -1))  // remove the failed result
    setAnsweredSteps((prev) => {
      if (!prev.has(currentStepIndex)) return prev
      const next = new Map(prev)
      next.delete(currentStepIndex)
      return next
    })
    setPhase('step')
  }, [currentStepIndex])

  const handleContinue = useCallback(() => {
    // Only a first-time completion (not a forward re-walk after reviewing
    // earlier steps) may inject a remediation step — otherwise re-answering-
    // by-viewing the same feedback screen on the way back forward would
    // splice a duplicate copy into the queue.
    const isReviewing = currentStepIndex < maxIndexReached
    if (!isReviewing) {
      const injected = currentStep && latestResult ? pickInjectedStep(currentStep, latestResult) : null

      if (injected) {
        const targetIndex = currentStepIndex + 1
        setDynamicSteps((prev) => {
          const next = [...prev]
          next.splice(targetIndex, 0, injected)
          return next
        })
        setCurrentStepIndex(targetIndex)
        setMaxIndexReached((m) => Math.max(m, targetIndex))
        setLatestResult(null)
        setPhase('step')
        return
      }
    }

    advanceStep()
  }, [currentStep, currentStepIndex, latestResult, advanceStep, maxIndexReached])

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

  useEffect(() => {
    onStepIndexChange?.(currentStepIndex)
    // Deliberately only tracking currentStepIndex — `onStepIndexChange`
    // itself is a caller-supplied callback for a cosmetic indicator (e.g.
    // header progress dots), not a dependency that should re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex])

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
        isSubmitting={isCompletionPending}
        submitError={completionError}
        onRetry={() => {
          lessonFinishedFiredRef.current = false
          setResults([])
          setTotalXP(0)
          setDynamicSteps(lesson.steps)
          setCurrentStepIndex(0)
          setMaxIndexReached(0)
          setAnsweredSteps(new Map())
          setLatestResult(null)
          setPhase('intro')
        }}
        onCoachReview={() => {
          try {
            const review = buildLessonReviewContext(lesson, results, totalXP)
            sessionStorage.setItem(COACH_REVIEW_STORAGE_KEY, JSON.stringify(review))
          } catch {
            // Best-effort — the Coach page still works as general chat without a review payload.
          }
          window.location.href = '/coach?review=1'
        }}
      />
    )
  }

  // ── Step / Feedback ────────────────────────────────────────────────────────
  if (!currentStep) return null

  // decision_spot and table_decision steps with a hero_position now render the shared
  // PreflopTable visualization themselves (see DecisionSpot.tsx / TableDecision.tsx),
  // which carries the same position/stack/ante/action-before-hero facts the text-pill
  // PokerContextBar would otherwise restate right above it — showing both is exactly
  // the redundant "HAND / UTG / 60bb, then UTG, 60bb effective..." duplication the
  // preflop table redesign removes. Steps that also carry a `board` are postflop spots
  // (hero_position is reused there for framing) and must keep the text context bar,
  // matching DecisionSpot.tsx's own `!board` gate exactly. Every other step type is
  // untouched.
  const rendersOwnPreflopTable =
    (currentStep.type === 'decision_spot' ||
      currentStep.type === 'table_decision' ||
      (currentStep.type === 'concept_reveal' && currentStep.visual === 'table')) &&
    !!currentStep.hero_position &&
    !currentStep.board?.length

  const hasContext =
    !rendersOwnPreflopTable &&
    (currentStep.board?.length ||
      currentStep.hero_position ||
      currentStep.villain_position ||
      currentStep.pot_bb != null ||
      currentStep.effective_stack_bb != null ||
      currentStep.table_size != null ||
      currentStep.ante_bb != null ||
      (currentStep.action_before_hero?.length ?? 0) > 0)

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
          tableSize={currentStep.table_size}
          anteBb={currentStep.ante_bb}
          actionBeforeHero={currentStep.action_before_hero}
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

      {/* Step card — dense visualization steps (full 13x13 range grids) get reduced
          horizontal padding below `sm:` (640px) to reclaim room for the grid at the
          narrowest supported widths; every other step type keeps the standard p-6 at
          all sizes. Vertical padding (py-6) never changes, and a small px-3 (12px)
          gutter is always kept — the card must never touch the viewport edge. */}
      <div
        className={cn(
          'rounded-2xl border border-border/50 bg-card/60 py-6',
          currentStep.type === 'range_collision' || currentStep.type === 'range_xray'
            ? 'px-3 sm:px-6'
            : 'px-6',
        )}
      >
        {phase === 'step' && (
          <StepRenderer
            step={currentStep}
            currentXP={runningXP}
            onResult={handleResult}
            steps={dynamicSteps}
            resultsByStepId={resultsByStepId}
          />
        )}

        {phase === 'feedback' && latestResult && (
          <StepFeedback
            result={latestResult}
            onContinue={handleContinue}
            onRetry={handleRetry}
            isLast={isLastStep}
            onPrevious={canGoPrevious ? handlePrevious : undefined}
          />
        )}
      </div>

      {/* Standalone Previous control for the 'step' phase — it has no existing
          Continue control to sit next to (the step's own interactive UI serves
          that role), so Previous stands alone here. */}
      {canGoPrevious && phase === 'step' && (
        <div>
          <PreviousButton onClick={handlePrevious} />
        </div>
      )}
    </div>
  )
}
