/**
 * Factory that assembles a full position-mastery lesson (Understand -> Predict -> Build ->
 * Compare -> Transform -> Drill x N -> Review) from a small config object, so UTG+1/UTG+2/
 * LJ/HJ don't need hundreds of hand-authored lines each (per the structural redesign's
 * "shared configuration/data rather than copy-pasted logic" requirement).
 *
 * Every strategy claim (Predict options, Build/Transform targets, Drill questions) is
 * generated from MTT_RFI_CHARTS via the existing generators — only position-specific prose
 * (Understand theory, Compare prompt/options) is hand-authored config, since that's genuinely
 * editorial content, not strategy data.
 */
import type { Lesson, LessonStep } from './types'
import { MTT_RFI_CHARTS, type MttPositionKey, type MttStackBB } from './mttRfiBaselines'
import { buildHandDecisionOptions, buildTableDecisionStep } from './mttRfiLabPool'
import { selectDrillQuestions } from './mttBoundarySelector'
import { canonicalCombo } from './combos'
import { recordCoverage } from './mttRfiCoverage'
import { positionsBeforeHero } from './preflopTableState'

const FIXED_ANTE_BB = 0.125
const BUILD_STACK_BB: MttStackBB = 60

export interface PositionLessonConfig {
  positionKey: MttPositionKey
  id: string
  title: string
  subtitle: string
  sort_order: number
  /** Where the Transformation Challenge grades against (source is always the 60bb build). */
  transformTargetStackBB: MttStackBB
  understandTitle: string
  understandContent: string
  /** 4 hand classes chosen to reveal the range's shape (spans obvious/boundary/edge) — the
   *  Predict phase's options/feedback are still generated from real chart data, only the
   *  choice of WHICH hands to ask about is authored. */
  predictHands: [string, string, string, string]
  comparePrompt: string
  compareOptions: { id: string; label: string; correct: boolean; feedback: string }[]
  reviewContent: string
  /** Named MTT_RFI_FOUNDATIONS key for the 60bb Build step, when one exists. */
  foundationKey?: string
  drillQuestionCount?: number
  xp_reward: number
  estimated_min: number
  next_lesson_teaser?: string
}

function buildChartKey(positionKey: MttPositionKey, stackBB: MttStackBB): string {
  return `${positionKey}_RFI_${stackBB}BB`
}

export function buildPositionLesson(config: PositionLessonConfig): Lesson {
  const {
    positionKey, id, title, subtitle, sort_order, transformTargetStackBB,
    understandTitle, understandContent, predictHands, comparePrompt, compareOptions,
    reviewContent, foundationKey, drillQuestionCount = 12, xp_reward, estimated_min, next_lesson_teaser,
  } = config

  const buildChart = MTT_RFI_CHARTS[buildChartKey(positionKey, BUILD_STACK_BB)]
  const heroPositionLabel = buildChart.position
  const conceptId = conceptForPositionKey(positionKey)
  // Every position-mastery lesson teaches a first-in (RFI) spot — derive who
  // actually folded before Hero from real seat order, never hand-author it.
  const actionBeforeHero = positionsBeforeHero(heroPositionLabel, 9).map((pos) => `${pos} folds`)

  const steps: LessonStep[] = []

  // ── Understand ──
  steps.push({
    id: `${id}-understand`,
    type: 'concept_reveal',
    concept_ids: [conceptId],
    concept_title: understandTitle,
    visual: 'table',
    hero_position: heroPositionLabel,
    effective_stack_bb: BUILD_STACK_BB,
    table_size: 9,
    ante_bb: FIXED_ANTE_BB,
    action_before_hero: actionBeforeHero,
    concept_content: understandContent,
    xp: 8,
  })

  // ── Predict (4 quick, low-stakes gut checks) ──
  predictHands.forEach((hand, i) => {
    const options = buildHandDecisionOptions(buildChart, hand, `${id}-predict-${i}`).map((o) => ({
      ...o,
      // Predict is explicitly low-stakes ("do not heavily penalize") — soften mistake/acceptable
      // down one notch so a wrong gut-check doesn't feel like a real strategic error yet.
      quality: o.quality === 'mistake' ? ('acceptable' as const) : o.quality,
    }))
    const cards = canonicalCombo(hand)
    steps.push({
      id: `${id}-predict-${i + 1}`,
      type: 'decision_spot',
      concept_ids: [conceptId],
      hero_hand: cards,
      hero_position: heroPositionLabel,
      effective_stack_bb: BUILD_STACK_BB,
      table_size: 9,
      ante_bb: FIXED_ANTE_BB,
      action_before_hero: actionBeforeHero,
      decision_spot_question: 'What does the baseline strategy do here? (Quick guess — no pressure.)',
      options,
      xp: 4,
    })
  })

  // ── Build (60bb, minimal/no prefill) ──
  steps.push({
    id: `${id}-build`,
    type: 'range_build_multi',
    concept_ids: [conceptId, 'range_construction'],
    narrative: foundationKey
      ? `Build ${heroPositionLabel}'s complete 60bb opening strategy.`
      : `Build ${heroPositionLabel}'s complete 60bb opening strategy from scratch.`,
    hero_position: heroPositionLabel,
    effective_stack_bb: BUILD_STACK_BB,
    table_size: 9,
    ante_bb: FIXED_ANTE_BB,
    range_build_multi_chart: buildChartKey(positionKey, BUILD_STACK_BB),
    range_build_multi_prefilled_key: foundationKey,
    range_build_multi_prefilled_note: foundationKey
      ? "We've already filled in the obvious core of the opening range. Complete the more marginal hands yourself."
      : undefined,
    range_build_multi_show_diff: true,
    xp: 24,
  })

  // ── Compare (4-stop slider vs. the 60bb build) ──
  steps.push({
    id: `${id}-compare`,
    type: 'mtt_stack_depth_compare',
    concept_ids: [conceptId, 'stack_depth_preflop'],
    narrative: `Here's ${heroPositionLabel}'s real strategy at all four canonical depths. Slide through them, then tap "Compare" to see exactly what changes relative to your 60bb build.`,
    mtt_stack_depth_compare_position: positionKey,
    mtt_stack_depth_compare_reference_bb: BUILD_STACK_BB,
    mtt_stack_depth_compare_prompt: comparePrompt,
    options: compareOptions.map((o) => ({
      id: o.id,
      label: o.label,
      quality: o.correct ? ('perfect' as const) : ('mistake' as const),
      feedback: o.feedback,
    })),
    xp: 10,
  })

  // ── Transform (Transformation Challenge: 60bb -> transformTargetStackBB) ──
  steps.push({
    id: `${id}-transform`,
    type: 'range_build_multi',
    concept_ids: [conceptId, 'range_construction', conceptForStackBB(transformTargetStackBB)],
    narrative: `Transformation Challenge: this grid starts from your 60bb build. Edit only the hands whose action changes at ${transformTargetStackBB}bb.`,
    hero_position: heroPositionLabel,
    effective_stack_bb: transformTargetStackBB,
    table_size: 9,
    ante_bb: FIXED_ANTE_BB,
    range_build_multi_chart: buildChartKey(positionKey, transformTargetStackBB),
    range_build_multi_transform_from_chart: buildChartKey(positionKey, BUILD_STACK_BB),
    range_build_multi_show_diff: true,
    xp: 22,
  })

  // ── Drill (boundary-heavy, stratified across all 4 depths) ──
  const drillRefs = selectDrillQuestions(positionKey, drillQuestionCount, `${id}-drill`)
  drillRefs.forEach((ref, i) => {
    steps.push(buildTableDecisionStep(`${id}-drill-${i + 1}`, ref.chartKey, ref.hand))
  })

  // ── Review ──
  steps.push({
    id: `${id}-review`,
    type: 'concept_reveal',
    concept_ids: [conceptId],
    concept_title: `${heroPositionLabel} Mastery, Reviewed`,
    concept_content: reviewContent,
    xp: 10,
  })

  // Coverage bookkeeping — Build/Transform charts are covered directly by scored steps;
  // Compare only displays the other 2 depths (unscored beyond the reasoning question), so
  // record them explicitly here to keep the "every chart taught or drilled" test honest.
  for (const stackBB of [15, 25, 40, 60] as MttStackBB[]) {
    recordCoverage(buildChartKey(positionKey, stackBB), { lessonId: id })
  }

  return {
    id,
    module_id: 'preflop-foundation-module',
    slug: id,
    title,
    subtitle,
    lesson_type: 'micro',
    concept_ids: [conceptId, 'position_rfi', 'range_construction', 'stack_depth_preflop'],
    estimated_min,
    xp_reward,
    sort_order,
    next_lesson_teaser,
    steps,
  }
}

function conceptForPositionKey(positionKey: MttPositionKey): string {
  switch (positionKey) {
    case 'UTG': return 'utg_rfi'
    case 'UTG1': return 'utg1_rfi'
    case 'UTG2': return 'utg2_rfi'
    case 'LJ': return 'lj_rfi'
    case 'HJ': return 'hj_rfi'
    case 'CO': return 'co_rfi'
    case 'BTN': return 'btn_rfi'
    default: return 'sb_first_in'
  }
}

function conceptForStackBB(stackBB: MttStackBB): string {
  if (stackBB <= 15) return 'shallow_stack_rfi'
  if (stackBB <= 25) return 'mid_stack_rfi'
  return 'deep_stack_rfi'
}
