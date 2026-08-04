import { describe, expect, it } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import type { LessonStep } from '../types'

/** A `cbet_frequency_size` step's response (`${frequencyId}|${sizingId}`) is built
 *  from two independent picker widgets (see FrequencySizeLab.tsx) — not every
 *  combination the pickers can produce is necessarily hand-authored as its own
 *  `options[]` entry, so this response class is the one real way to reach the
 *  "unlisted option" fallback path in evalOptionBased. Regression coverage for
 *  the fix that replaced its old bare "Response not recognised." text. */
function makeCbetStep(): LessonStep {
  return {
    id: 'test-cbet-step',
    type: 'cbet_frequency_size',
    concept_ids: [],
    narrative: 'Cash game, 100bb effective. BTN opens, BB calls, BTN is in position. Board: A♠9♦3♣.',
    board: ['As', '9d', '3c'],
    cbet_frequency_size_frequency_options: [
      { id: 'check_heavy', label: 'Check-Heavy (≈0–15%)' },
      { id: 'low', label: 'Low (≈15–40%)' },
      { id: 'medium', label: 'Medium (≈40–65%)' },
      { id: 'high', label: 'High (≈65–85%)' },
      { id: 'near_range', label: 'Near-Range Bet (≈85–100%)' },
    ],
    cbet_frequency_size_sizing_options: [
      { id: 'check', label: 'Check' },
      { id: 'small', label: 'Small (~25-33%)' },
      { id: 'medium', label: 'Medium (~50-67%)' },
    ],
    options: [
      {
        id: 'near_range|small', label: 'Near-Range Bet (≈85–100%) + Small', quality: 'perfect',
        feedback: "BTN's range advantage here is about as lopsided as it gets, which is why near-range betting at a small size is correct.",
      },
      {
        id: 'medium|medium', label: 'Medium Frequency (≈40–65%) + Medium', quality: 'mistake',
        feedback: 'This undersells the range advantage.',
      },
    ],
    xp: 20,
  } as LessonStep
}

describe('evalOptionBased — unlisted cbet_frequency_size combination', () => {
  it('never shows the old bare technical fallback text', () => {
    const step = makeCbetStep()
    // 'low|check' is a real, pickable combination in the UI (both halves are
    // authored picker options) but was never hand-authored as its own `options[]`
    // entry — exactly the case that used to fall through to the generic fallback.
    const result = evaluateStepLocally(step, 'low|check', 0)
    expect(result.feedback).not.toMatch(/response not recognised/i)
    expect(result.feedback).not.toMatch(/unknown response/i)
    expect(result.feedback).not.toMatch(/invalid response/i)
  })

  it('names what the learner actually chose, in real labels not raw ids', () => {
    const step = makeCbetStep()
    const result = evaluateStepLocally(step, 'low|check', 0)
    expect(result.feedback).toContain('Low (≈15–40%)')
    expect(result.feedback).toContain('Check')
  })

  it('reuses the step\'s own correct-answer reasoning rather than inventing new theory', () => {
    const step = makeCbetStep()
    const result = evaluateStepLocally(step, 'low|check', 0)
    expect(result.feedback).toContain("BTN's range advantage here is about as lopsided as it gets")
  })

  it('still scores as a mistake and reveals the real correct answer', () => {
    const step = makeCbetStep()
    const result = evaluateStepLocally(step, 'low|check', 0)
    expect(result.quality).toBe('mistake')
    expect(result.answer_reveal?.correct).toContain('Near-Range Bet')
  })

  it('an authored option id still resolves through the normal path, unaffected', () => {
    const step = makeCbetStep()
    const result = evaluateStepLocally(step, 'near_range|small', 0)
    expect(result.quality).toBe('perfect')
    expect(result.feedback).toBe("BTN's range advantage here is about as lopsided as it gets, which is why near-range betting at a small size is correct.")
  })
})
