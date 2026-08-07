import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS_BY_ID } from '../curriculum'
import type { LessonStep } from '../types'

// Module 9's graded steps used to answer a wrong or partial response with a
// bare tally — "Partial credit — missed 1 tier.", "Close — ...", "Roughly
// right, but has leaks". These tests lock the replacement: every non-perfect
// answer now names what the learner picked, what the answer was, WHY, why the
// near-miss still counted, and the rule to carry forward.

const MODULE_9_LESSON_IDS = [
  'from-hands-to-combos', 'block-the-value',
  'same-strength-different-cards', 'the-nut-blocker', 'a-blocker-is-not-always-good',
  'blockers-when-calling', 'read-the-removal', 'blocker-lab',
]

/** The exact phrasings the old generic feedback produced. None of them may
 *  survive on a Module 9 graded step. */
const GENERIC_PHRASES = [
  'Partial credit —',
  'Close — a couple',
  'Review the board —',
  'Roughly right, but has leaks',
  'Roughly right, but several boards',
  'Good sort —',
  'Several hands are in the wrong bucket',
]

function stepById(lessonId: string, stepId: string): LessonStep {
  const step = LESSONS_BY_ID[lessonId].steps.find((s) => s.id === stepId)
  if (!step) throw new Error(`${lessonId}/${stepId} not found`)
  return step
}

describe('Module 9 — Lesson 9.5 "A Blocker Is Not Always Good", the K♥ pyramid', () => {
  const step = stepById('a-blocker-is-not-always-good', 'bnag-s2')

  // The reported case: learner taps only the tier the king "lives in" and gets
  // 67/100 with no idea what they missed.
  const partial = evaluateStepLocally(step, ['K'], 0)

  it('still scores the same — the coaching layer changes presentation, not grading', () => {
    expect(partial.quality).toBe('acceptable')
    expect(partial.score).toBe(67)
  })

  it('names the learner\'s answer and the correct answer side by side', () => {
    expect(partial.answer_reveal).toBeDefined()
    expect(partial.answer_reveal!.yours).toContain('K-high')
    expect(partial.answer_reveal!.correct).toContain('nut (A-high)')
    expect(partial.answer_reveal!.correct).toContain('K-high')
  })

  it('explains WHY the nut tier belongs — the exact combo and the structural reason', () => {
    expect(partial.feedback).toContain('A♥K♥')
    expect(partial.feedback).toContain('1 of its 9 combos disappears (A♥K♥)')
    expect(partial.feedback).toMatch(/named for its HIGH card/)
    // ...and that the rest of the trap survives, which is the strategic point.
    expect(partial.feedback).toContain('The other 8 are untouched')
  })

  it('credits what the learner got right instead of only marking them down', () => {
    const terms = (partial.structured_points ?? []).map((p) => p.term)
    expect(terms).toContain('Why')
    expect(terms).toContain('Why you earned partial credit')
    expect(terms).toContain('Key takeaway')

    const credit = partial.structured_points!.find((p) => p.term === 'Why you earned partial credit')!
    expect(credit.description).toContain('K-high')
    expect(credit.description).toMatch(/natural first pass/)
  })

  it('ends on a portable rule, not a score', () => {
    const takeaway = partial.structured_points!.find((p) => p.term === 'Key takeaway')!
    expect(takeaway.description).toMatch(/only worth something if it removes/)
  })

  it('a fully correct answer keeps the authored explanation and gets no "you were wrong" reveal', () => {
    const perfect = evaluateStepLocally(step, ['nut', 'K'], 0)
    expect(perfect.quality).toBe('perfect')
    expect(perfect.score).toBe(100)
    expect(perfect.answer_reveal).toBeUndefined()
    expect(perfect.feedback).toContain('8 of')
  })

  it('over-selection is explained too — which tiers survive in full, and by how much', () => {
    const over = evaluateStepLocally(step, ['nut', 'K', 'Q'], 0)
    expect(over.quality).not.toBe('perfect')
    expect(over.feedback).toContain('The Q-high tier does not belong')
    expect(over.feedback).toContain('that tier survives in full')
  })
})

describe('Module 9 — the nut blocker pyramid (A♥) teaches its own exception', () => {
  const step = stepById('the-nut-blocker', 'tnb-s3')

  it('a learner who marks extra tiers is told exactly which ones survive, and why the ace is different', () => {
    const result = evaluateStepLocally(step, ['nut', 'K'], 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.feedback).toContain('The K-high tier does not belong')
    expect(result.feedback).toContain('A♥')

    const credit = result.structured_points!.find((p) => p.term === 'Why you earned partial credit')!
    expect(credit.description).toMatch(/sound instinct/)
    expect(credit.description).toMatch(/nothing outranks it/)
  })
})

describe('Module 9 — combo removal explains the collision, not just the count', () => {
  it('names the missed combos and the known card that kills them', () => {
    const step = stepById('from-hands-to-combos', 'fhtc-s6') // AA vs Hero's A♠
    const result = evaluateStepLocally(step, ['As-Ah'], 0)

    expect(result.quality).not.toBe('perfect')
    expect(result.feedback).toContain('A♠')
    // The two combos the learner missed are named, and share one grouped reason.
    expect(result.feedback).toMatch(/belong in the answer — A♠ is already accounted for/)
    expect(result.answer_reveal!.term).toBe('Impossible combinations')

    const terms = (result.structured_points ?? []).map((p) => p.term)
    expect(terms).toContain('Key takeaway')
  })

  it('a wrongly-flagged combo is told it shares no card with anything known', () => {
    const step = stepById('read-the-removal', 'rtr-s2') // AA vs Hero's A♣
    const result = evaluateStepLocally(step, ['Ac-Ah', 'Ac-Ad', 'Ac-As', 'Ad-Ah'], 0)

    expect(result.quality).not.toBe('perfect')
    expect(result.feedback).toContain('does not belong')
    expect(result.feedback).toContain('nothing there collides with A♣')
  })
})

describe('Module 9 — sorting steps explain the ordering they graded', () => {
  it('board_rank_sort names both orders and what separates the misplaced hands', () => {
    const step = stepById('same-strength-different-cards', 'ssdc-s2')
    const result = evaluateStepLocally(step, ['ac-6c', 'ac-7c', 'act-td'], 0)

    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal!.correct).toBe('A♣T♦ → A♣7♣ → A♣6♣')
    expect(result.answer_reveal!.yours).toBe('A♣6♣ → A♣7♣ → A♣T♦')
    const terms = (result.structured_points ?? []).map((p) => p.term)
    expect(terms).toContain('Key takeaway')
    expect(terms.some((t) => t.startsWith('A♣T♦'))).toBe(true)
  })

  it('range_bucket explains each misplaced hand instead of only naming it', () => {
    const step = stepById('block-the-value', 'btv-s2')
    const result = evaluateStepLocally(
      step,
      { AA: 'value', A9s: 'value', '94s': 'value', '76s': 'value', '87s': 'not_value', '65s': 'not_value' },
      0,
    )

    expect(result.quality).not.toBe('perfect')
    const note = result.structured_points!.find((p) => p.term === '76s')!
    expect(note.description).toContain('Belongs in Not Value, not Value.')
    expect(note.description).toMatch(/still loses to top pair aces/)
  })
})

describe('Module 9 audit — no graded step falls back to a bare tally', () => {
  // Every response shape below is deliberately wrong-but-plausible, so each
  // step is forced down its non-perfect feedback path.
  function wrongResponseFor(step: LessonStep): unknown {
    switch (step.type) {
      case 'combo_removal':
      case 'flush_pyramid':
        return []
      case 'board_rank_sort':
        return [...(step.board_rank_sort_target ?? [])].reverse()
      case 'range_bucket': {
        const categories = step.range_bucket_categories ?? []
        const wrong = Object.fromEntries(
          (step.range_bucket_pool ?? []).map((hand) => {
            const correct = step.range_bucket_correct?.[hand]
            const other = categories.find((c) => c.id !== correct)?.id
            return [hand, other ?? correct]
          }),
        )
        return wrong
      }
      default:
        return null
    }
  }

  const SET_SELECTION_TYPES = new Set(['combo_removal', 'flush_pyramid', 'board_rank_sort', 'range_bucket'])

  for (const lessonId of MODULE_9_LESSON_IDS) {
    const lesson = LESSONS_BY_ID[lessonId]
    for (const step of lesson.steps) {
      if (!SET_SELECTION_TYPES.has(step.type)) continue

      it(`${lessonId}/${step.id} (${step.type}) teaches on a wrong answer`, () => {
        const result = evaluateStepLocally(step, wrongResponseFor(step), 0)
        expect(result.quality).not.toBe('perfect')

        for (const phrase of GENERIC_PHRASES) {
          expect(result.feedback, `still generic: "${result.feedback}"`).not.toContain(phrase)
        }

        // Every one of these steps must end on a rule the learner can reuse.
        const terms = (result.structured_points ?? []).map((p) => p.term)
        expect(terms, `${step.id} has no key takeaway`).toContain('Key takeaway')
      })
    }
  }
})

describe('steps outside Module 9 keep their original grading and feedback', () => {
  it('a set-selection step with no authored coaching still returns the shared tally', () => {
    // straight_detective (Module 6) never opted in — its evaluator passes no
    // coaching, so the original `evalIdSetSelection` prose is untouched.
    const step: LessonStep = {
      id: 'sd-regression',
      type: 'straight_detective',
      straight_detective_board: ['9h', '8d', '7c'],
    } as LessonStep

    const result = evaluateStepLocally(step, [], 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.structured_points).toBeUndefined()
    expect(result.answer_reveal).toBeUndefined()
  })
})
