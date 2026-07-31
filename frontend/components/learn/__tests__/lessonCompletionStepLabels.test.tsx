/**
 * Step Breakdown labels — regression coverage for resolveStepLabel in
 * LessonCompletionScreen.tsx. Two "decision_spot" steps must no longer both
 * render as "decision spot"; the label should reflect the concept each step
 * actually tested, sourced from existing curriculum metadata (concept_ids ->
 * the CONCEPT_DATA registry, or a step's own concept_title), never a
 * hardcoded/invented string.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonCompletionScreen } from '../LessonCompletionScreen'
import type { Lesson, LessonStep, StepResult } from '@/lib/learn/types'

function baseResult(overrides: Partial<StepResult>): StepResult {
  return {
    score: 70,
    quality: 'good',
    ev_loss_bb: 0,
    feedback: 'ok',
    xp_earned: 2,
    level_before: 0,
    level_after: 0,
    leveled_up: false,
    evaluation_source: 'theory_engine',
    confidence: 'high',
    evaluation_valid: true,
    fallback_used: false,
    unscored: false,
    ...overrides,
  }
}

function baseStep(overrides: Partial<LessonStep>): LessonStep {
  return {
    id: 'step',
    type: 'decision_spot',
    ...overrides,
  } as LessonStep
}

function baseLesson(overrides: Partial<Lesson>): Lesson {
  return {
    id: 'lesson',
    module_id: 'module',
    slug: 'lesson-slug',
    title: 'Test Lesson',
    lesson_type: 'micro',
    concept_ids: [],
    steps: [],
    estimated_min: 5,
    xp_reward: 100,
    sort_order: 1,
    ...overrides,
  }
}

const noop = () => {}

describe('LessonCompletionScreen — Step Breakdown labels reflect the concept, not the step type', () => {
  it('two decision_spot steps with different concept_ids get distinct, human concept titles', () => {
    const lesson = baseLesson({
      concept_ids: ['pot_odds', 'three_bet'],
      steps: [
        baseStep({ id: 's1', type: 'decision_spot', concept_ids: ['pot_odds'] }),
        baseStep({ id: 's2', type: 'decision_spot', concept_ids: ['three_bet'] }),
      ],
    })
    const results = [baseResult({ score: 40 }), baseResult({ score: 90 })]
    const html = renderToStaticMarkup(
      <LessonCompletionScreen lesson={lesson} results={results} totalXP={10} onContinue={noop} />,
    )
    expect(html).toContain('>Pot Odds<')
    expect(html).toContain('>3-Bet<')
    expect(html).not.toMatch(/decision spot/i)
  })

  it('a step with no concept_ids falls back to the LESSON-level concept_ids (same fallback already used for concept mastery)', () => {
    const lesson = baseLesson({
      concept_ids: ['rfi'],
      steps: [baseStep({ id: 's1', type: 'decision_spot' })],
    })
    const html = renderToStaticMarkup(
      <LessonCompletionScreen lesson={lesson} results={[baseResult({ score: 60 })]} totalXP={5} onContinue={noop} />,
    )
    expect(html).toContain('Raise First In')
  })

  it("a concept_reveal-style step's own authored concept_title is used when its concept_ids don't resolve in the registry", () => {
    const lesson = baseLesson({
      concept_ids: [],
      steps: [
        baseStep({
          id: 's1',
          type: 'decision_spot',
          concept_ids: ['not_a_real_registry_id'],
          concept_title: 'Board Texture Reads',
        }),
      ],
    })
    const html = renderToStaticMarkup(
      <LessonCompletionScreen lesson={lesson} results={[baseResult({ score: 60 })]} totalXP={5} onContinue={noop} />,
    )
    expect(html).toContain('Board Texture Reads')
  })

  it('falls back to the humanized step type (today\'s existing behavior) when no concept metadata exists at all', () => {
    const lesson = baseLesson({
      concept_ids: [],
      steps: [baseStep({ id: 's1', type: 'cards_identify' })],
    })
    const html = renderToStaticMarkup(
      <LessonCompletionScreen lesson={lesson} results={[baseResult({ score: 60 })]} totalXP={5} onContinue={noop} />,
    )
    expect(html).toMatch(/cards identify/i)
  })

  it('unscored steps are still skipped entirely (label resolution never runs for them) — unchanged from before', () => {
    const lesson = baseLesson({
      concept_ids: ['pot_odds'],
      steps: [
        baseStep({ id: 's1', type: 'concept_reveal', concept_title: 'Pot Odds Intro' }),
        baseStep({ id: 's2', type: 'decision_spot', concept_ids: ['pot_odds'] }),
      ],
    })
    const results = [baseResult({ unscored: true }), baseResult({ score: 88 })]
    const html = renderToStaticMarkup(
      <LessonCompletionScreen lesson={lesson} results={results} totalXP={5} onContinue={noop} />,
    )
    expect(html).not.toContain('Pot Odds Intro')
    expect(html).toContain('>Pot Odds<')
  })
})
