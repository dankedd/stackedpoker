import { describe, expect, it } from 'vitest'
import { validateAllLessons, validateStep } from '../handDescriptionValidator'
import { LESSONS } from '../curriculum'
import type { Lesson, LessonStep } from '../types'

function makeLesson(step: Partial<LessonStep> & { id: string; type: LessonStep['type'] }): Lesson {
  return {
    id: 'test-lesson', module_id: 'test-module', slug: 'test-lesson', title: 'Test Lesson',
    subtitle: '', lesson_type: 'micro', concept_ids: [], estimated_min: 1, xp_reward: 1, sort_order: 1,
    steps: [step as LessonStep],
  } as Lesson
}

describe('handDescriptionValidator', () => {
  it('flags a wrong overcard count (the exact pce-s2 bug, pre-fix)', () => {
    const lesson = makeLesson({
      id: 's1', type: 'decision_spot',
      narrative: 'Hero holds K♦J♦ — two overcards, backdoor draw, not enough to bet confidently.',
      hero_hand: ['Kd', 'Jd'], board: ['Qs', '7d', '3c'],
    })
    const issues = validateStep(lesson, lesson.steps[0])
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some((i) => i.message.includes('overcard'))).toBe(true)
  })

  it('does not flag the corrected version of the same hand', () => {
    const lesson = makeLesson({
      id: 's1', type: 'decision_spot',
      narrative: 'Hero holds K♦J♦ — one overcard (K), a backdoor flush draw, and some backdoor straight potential, not enough to bet confidently.',
      hero_hand: ['Kd', 'Jd'], board: ['Qs', '7d', '3c'],
    })
    expect(validateStep(lesson, lesson.steps[0])).toEqual([])
  })

  it('flags a flush-draw claim that is actually only a backdoor flush draw', () => {
    const lesson = makeLesson({
      id: 's1', type: 'decision_spot',
      narrative: 'Hero has a flush draw here.',
      hero_hand: ['Kd', 'Jd'], board: ['Qs', '7d', '3c'],
    })
    const issues = validateStep(lesson, lesson.steps[0])
    expect(issues.some((i) => i.message.includes('backdoor'))).toBe(true)
  })

  it('does not flag prose with no checkable claims', () => {
    const lesson = makeLesson({
      id: 's1', type: 'decision_spot',
      narrative: 'BTN opens, BB calls. Board: A♠9♦3♣.',
      hero_hand: ['Kd', 'Jd'], board: ['As', '9d', '3c'],
    })
    expect(validateStep(lesson, lesson.steps[0])).toEqual([])
  })

  it('the full curriculum has no remaining hand-description mismatches', () => {
    const report = validateAllLessons(LESSONS)
    if (report.issues.length > 0) {
      const summary = report.issues
        .map((i) => `[${i.lessonId}/${i.stepId}${i.scenarioLabel ? `/${i.scenarioLabel}` : ''}] (${i.field}): ${i.message}`)
        .join('\n')
      throw new Error(`${report.issues.length} hand-description issue(s) found:\n${summary}`)
    }
    expect(report.totalStepsChecked).toBeGreaterThan(0)
  })
})
