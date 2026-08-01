/**
 * Module 4 ("Preflop Aggression") regression guard: whenever a decision_spot
 * step's post-answer range reveal shows HERO's own strategy chart
 * (`'defend'`/`'3bet'`/`'facing_3bet'` — i.e. the same action space the step
 * actually grades), the highlighted hand's DOMINANT action in that chart must
 * match the step's own `quality: 'perfect'` option. If it doesn't, the
 * visualization contradicts the feedback text and the evaluator's own answer
 * key — exactly the bug reported for tb-s6c (76s shown as a pure 3-bet in the
 * reveal while "Call" was the graded correct answer; see the "CORRECTION" note
 * in bbDefenseComplete.ts for the root cause and fix).
 *
 * `'opener'`-direction reveals are deliberately excluded: they show VILLAIN's own
 * opening range (a raise/fold action space), a different decision than Hero's
 * call/3bet/fold response, so there is no meaningful match to check there.
 *
 * Scoped to `preflop-aggression-module` only, matching this exact audit's
 * request — other modules' reveal charts (e.g. Module 5's other stack-depth
 * tiers) have not been individually re-verified against the book yet and are
 * out of scope here; extending this same sweep module-by-module as each is
 * audited is the natural next step, not a blanket curriculum-wide check today.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { evaluateStepLocally } from '../evaluator'
import { dominantAction } from '../rangeStrategy'
import type { LessonStep } from '../types'

const MODULE_ID = 'preflop-aggression-module'

const ALL_STEPS: { lessonId: string; step: LessonStep }[] = LESSONS.filter(
  (l) => l.module_id === MODULE_ID,
).flatMap((l) => l.steps.map((step) => ({ lessonId: l.id, step })))

const HERO_RESPONSE_DIRECTIONS = new Set<LessonStep['range_reveal_direction']>([
  undefined, 'defend', '3bet', 'facing_3bet',
])

describe('range reveal highlight consistency — highlighted hand always matches the actual correct action', () => {
  const candidates = ALL_STEPS.filter(({ step }) => {
    if (step.type !== 'decision_spot') return false
    if (!HERO_RESPONSE_DIRECTIONS.has(step.range_reveal_direction)) return false
    return !!step.options?.some((o) => o.quality === 'perfect')
  })

  it('found a substantial number of candidate steps (sanity guard against an empty/broken sweep)', () => {
    expect(candidates.length).toBeGreaterThan(5)
  })

  it.each(candidates.map(({ lessonId, step }) => [lessonId, step.id] as const))(
    '%s / %s: reveal\'s dominant action for the highlighted hand matches the perfect option',
    (_lessonId, stepId) => {
      const { step } = candidates.find((c) => c.step.id === stepId)!
      const perfectOpt = step.options!.find((o) => o.quality === 'perfect')!

      const result = evaluateStepLocally(step, perfectOpt.id, 0)
      const reveal = result.range_reveal
      if (!reveal) return // no canonical data to back a reveal — nothing to check

      const mix = reveal.strategies[reveal.highlightHand]
      if (!mix) return // hand absent from an action_slice/complete chart — no claim being made either way

      const dominant = dominantAction(mix)
      if (dominant === undefined) return

      expect(
        dominant,
        `${step.id}: reveal highlights ${reveal.highlightHand} as dominantly "${dominant}" ` +
          `(mix=${JSON.stringify(mix)}), but the graded correct answer is "${perfectOpt.id}"`,
      ).toBe(perfectOpt.id)
    },
  )
})
