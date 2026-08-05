/**
 * The single, canonical audit of "does the range visualization agree with the
 * declared correct answer?" across every Learn decision_spot that gets an
 * automatic post-answer range reveal of HERO'S OWN strategy (defend/3bet/
 * facing_3bet — never 'opener', which shows Villain's range, not Hero's answer).
 *
 * Rule (per the Module 5 Lesson 2 "AJo call vs fold" and "76s call vs 3bet"
 * incidents this was built to make permanently unrepresentable): the range
 * visualization is authoritative. A step's 'perfect'/'good' option(s) must
 * agree with the chart's own dominant action for the hand actually highlighted
 * — resolved from the SAME `hero_hand` cards via the SAME `cardsToHandClass`
 * the reveal itself uses, so a suited/offsuit labeling typo (e.g. authoring
 * ['As','Jh'] while calling it "AJs" in prose) is caught too, not just a
 * chart/answer disagreement on an already-correctly-classified hand.
 *
 * Used by both `scripts/validateRangeAnswers.ts` (a standalone report) and
 * `__tests__/rangeAnswerValidation.test.ts` (wired into the normal test
 * suite) — one validator, two callers, mirroring scenarioValidator.ts's own
 * pattern.
 */
import type { Lesson, LessonStep, StepOption } from './types'
import { resolveDefendRangeReveal } from './defendRangeReveal'
import { resolveThreebetRangeReveal } from './threebetRangeReveal'
import { resolveFacingThreebetRangeReveal } from './facingThreebetRangeReveal'
import { dominantAction } from './rangeStrategy'

export interface RangeAnswerIssue {
  lessonId: string
  lessonTitle: string
  stepId: string
  hand: string
  chartAction: string
  chartLabel: string
  acceptableOptionIds: string[]
  mistakeOptionIds: string[]
}

/** Resolves whichever reveal (if any) shows HERO'S OWN strategy for this step —
 *  mirrors evaluator.ts's own `range_reveal_direction` dispatch exactly, minus
 *  the 'opener' branch (villain's range carries no "correct answer" to check). */
function resolveHeroOwnReveal(step: LessonStep) {
  if (step.range_reveal_direction === '3bet') return resolveThreebetRangeReveal(step)
  if (step.range_reveal_direction === 'facing_3bet') return resolveFacingThreebetRangeReveal(step)
  if (step.range_reveal_direction === 'opener') return undefined
  return resolveDefendRangeReveal(step)
}

function actionMatchesOption(action: string, option: StepOption): boolean {
  const hay = `${option.id} ${option.label}`.toLowerCase()
  switch (action) {
    case '3bet': return /3.?bet|threebet/.test(hay)
    case 'jam': return /jam|all-?in|shove/.test(hay)
    case 'call': return /\bcall\b/.test(hay)
    case 'raise': return /raise/.test(hay) && !/3.?bet|4.?bet/.test(hay)
    case 'fold': return /\bfold\b/.test(hay)
    default: return false
  }
}

/** Validates one step. Empty array for a step with nothing to check (no
 *  resolvable reveal, no options, or genuinely consistent) — never a
 *  "no issues" placeholder. */
export function validateRangeAnswerStep(lesson: Lesson, step: LessonStep): RangeAnswerIssue[] {
  if (step.type !== 'decision_spot') return []
  if (!step.hero_hand || step.hero_hand.length !== 2) return []
  if (!step.options?.length) return []

  const reveal = resolveHeroOwnReveal(step)
  if (!reveal) return []

  const mix = reveal.strategies[reveal.highlightHand]
  const isComplete = reveal.strategySemantics.kind !== 'action_slice'
  let chartAction: string | undefined
  if (mix) {
    chartAction = dominantAction(mix)
  } else if (isComplete) {
    chartAction = 'fold'
  } else {
    return [] // action_slice + absent hand: genuinely untracked, nothing to check
  }
  if (!chartAction) return []

  const acceptable = step.options.filter((o) => o.quality === 'perfect' || o.quality === 'good')
  const mistakes = step.options.filter((o) => o.quality === 'mistake')
  if (acceptable.length === 0) return []

  const matchesAcceptable = acceptable.some((o) => actionMatchesOption(chartAction!, o))
  const matchesMistake = mistakes.some((o) => actionMatchesOption(chartAction!, o))

  if (matchesAcceptable || !matchesMistake) return []

  return [{
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    stepId: step.id,
    hand: reveal.highlightHand,
    chartAction,
    chartLabel: reveal.label,
    acceptableOptionIds: acceptable.map((o) => o.id),
    mistakeOptionIds: mistakes.map((o) => o.id),
  }]
}

export interface RangeAnswerReport {
  totalChecked: number
  issues: RangeAnswerIssue[]
}

export function validateAllRangeAnswers(lessons: Lesson[]): RangeAnswerReport {
  const issues: RangeAnswerIssue[] = []
  let totalChecked = 0
  for (const lesson of lessons) {
    for (const step of lesson.steps) {
      if (step.type !== 'decision_spot' || !step.hero_hand || step.hero_hand.length !== 2 || !step.options?.length) continue
      const stepIssues = validateRangeAnswerStep(lesson, step)
      if (resolveHeroOwnReveal(step)) totalChecked++
      issues.push(...stepIssues)
    }
  }
  return { totalChecked, issues }
}
