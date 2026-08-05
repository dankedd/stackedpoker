import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { validateAllRangeAnswers, validateRangeAnswerStep } from '../rangeAnswerValidator'

/**
 * The permanent CI gate for "the range visualization agrees with the declared
 * correct answer." Built after the Module 5 Lesson 2 incidents where a step's
 * feedback declared AJo/76s "CALL"/"3-BET" while the actual range chart (the
 * same one shown to the learner) resolved the same hand to FOLD/CALL. The
 * range visualization is authoritative — see rangeAnswerValidator.ts's own
 * doc comment for the exact rule and how it's checked.
 */
describe('Range answer validation — sanity guard against an empty/broken sweep', () => {
  it('found a substantial number of steps with a resolvable Hero-own-strategy reveal', () => {
    const report = validateAllRangeAnswers(LESSONS)
    expect(report.totalChecked).toBeGreaterThan(20)
  })
})

describe('Range answer validation — every decision_spot with a Hero-own range reveal', () => {
  const report = validateAllRangeAnswers(LESSONS)

  it('has zero disagreements between the range visualization and the declared correct answer', () => {
    if (report.issues.length > 0) {
      const details = report.issues
        .map((i) => `  ${i.lessonId} / ${i.stepId}: hand ${i.hand} — chart ("${i.chartLabel}") says "${i.chartAction}", which matches a MISTAKE option (${i.mistakeOptionIds.join(',')}) not an acceptable one (${i.acceptableOptionIds.join(',')})`)
        .join('\n')
      throw new Error(`${report.issues.length} range/answer mismatch(es) found:\n${details}`)
    }
    expect(report.issues).toEqual([])
  })
})

describe('validateRangeAnswerStep — synthetic regression fixtures', () => {
  const lesson = { id: 'l', title: 'L', module_id: 'm', slug: 's', lesson_type: 'micro' as const, concept_ids: [], steps: [], estimated_min: 1, xp_reward: 1, sort_order: 1 }

  it('flags a hand whose chart action matches a MISTAKE option, not the declared correct one', () => {
    // AJo (offsuit, per the actual card suits) vs UTG at 60bb: HJ_vs_UTG_60BB has no
    // AJo entry at all (implicit fold), so a step declaring CALL correct here is exactly
    // the historical "AJo call vs fold" bug.
    const issues = validateRangeAnswerStep(lesson, {
      id: 'x', type: 'decision_spot', table_size: 9, effective_stack_bb: 60,
      hero_position: 'HJ', villain_position: 'UTG',
      action_before_hero: ['UTG raises to 2.2bb', 'UTG+1 folds', 'LJ folds'],
      hero_hand: ['As', 'Jh'], // offsuit — different suits
      options: [
        { id: 'call', label: 'CALL', quality: 'perfect', feedback: 'x' },
        { id: 'fold', label: 'FOLD', quality: 'mistake', feedback: 'x' },
      ],
    })
    expect(issues.length).toBe(1)
    expect(issues[0].chartAction).toBe('fold')
  })

  it('does NOT flag the same spot once the cards are genuinely suited (AJs really does call)', () => {
    const issues = validateRangeAnswerStep(lesson, {
      id: 'x', type: 'decision_spot', table_size: 9, effective_stack_bb: 60,
      hero_position: 'HJ', villain_position: 'UTG',
      action_before_hero: ['UTG raises to 2.2bb', 'UTG+1 folds', 'LJ folds'],
      hero_hand: ['As', 'Js'], // suited
      options: [
        { id: 'call', label: 'CALL', quality: 'perfect', feedback: 'x' },
        { id: 'fold', label: 'FOLD', quality: 'mistake', feedback: 'x' },
      ],
    })
    expect(issues).toEqual([])
  })

  it('never flags a step with no resolvable reveal (no fabricated ground truth)', () => {
    const issues = validateRangeAnswerStep(lesson, {
      id: 'x', type: 'decision_spot', table_size: 6, effective_stack_bb: 40,
      hero_position: 'CO', villain_position: 'SB', // no charted CO-vs-SB matchup
      hero_hand: ['Ts', '9s'],
      options: [
        { id: 'call', label: 'CALL', quality: 'perfect', feedback: 'x' },
        { id: 'fold', label: 'FOLD', quality: 'mistake', feedback: 'x' },
      ],
    })
    expect(issues).toEqual([])
  })
})
