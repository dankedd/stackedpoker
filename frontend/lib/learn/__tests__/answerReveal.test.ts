/**
 * Regression tests for the global "reveal the correct answer" requirement:
 * any scored step that isn't fully correct must expose a structured
 * `answer_reveal` (term/correct/yours/alsoAccepted) computed from the SAME
 * data used to score the response — never a separately hand-authored key.
 *
 * A perfect answer must never get an unnecessary "you were wrong"
 * comparison, and step types with their own richer item-by-item reveal
 * (range_bucket, hand_ranking_order, board_rank_sort, straight_detective,
 * board_autopsy, range_build, range_heatmap) must NOT get a redundant
 * generic reveal bolted on top.
 */
import { describe, it, expect } from 'vitest'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

describe('1. Option-based (decision_spot) — incorrect single-answer question reveals the correct play', () => {
  const step = findStep('ev-s6') // RAISE=perfect, CALL=mistake, FOLD=punt

  it('picking the wrong option (CALL) reveals "Correct play: RAISE" and echoes the learner\'s own pick', () => {
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.quality).toBe('mistake')
    expect(result.answer_reveal).toBeDefined()
    expect(result.answer_reveal!.term).toBe('Correct play')
    expect(result.answer_reveal!.correct).toBe('RAISE')
    expect(result.answer_reveal!.yours).toBe('CALL')
  })

  it('picking the worst option (FOLD) still reveals the correct play, not just "you were wrong"', () => {
    const result = evaluateStepLocally(step, 'fold', 0)
    expect(result.quality).toBe('punt')
    expect(result.answer_reveal?.correct).toBe('RAISE')
  })

  it('an unrecognized/missing response still reveals the correct play', () => {
    const result = evaluateStepLocally(step, undefined, 0)
    expect(result.answer_reveal?.correct).toBe('RAISE')
  })
})

describe('2. Correct answer — no unnecessary "you were wrong" comparison', () => {
  it('picking the perfect option (RAISE) on ev-s6 gets no answer_reveal at all', () => {
    const step = findStep('ev-s6')
    const result = evaluateStepLocally(step, 'raise', 0)
    expect(result.quality).toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })

  it('an exact numeric match on poc-s3 (pot odds, correct=25%) gets no answer_reveal', () => {
    const step = findStep('poc-s3')
    const result = evaluateStepLocally(step, 25, 0)
    expect(result.quality).toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })
})

describe('3. Numeric partial credit — preferred/correct answer visible alongside the learner\'s own answer', () => {
  const step = findStep('poc-s3') // pot_odds_correct = 25, tolerance = 2

  it('a close-but-not-exact answer (28, "good" tier) shows both "yours" and "correct"', () => {
    const result = evaluateStepLocally(step, 28, 0)
    expect(result.quality).toBe('good')
    expect(result.answer_reveal).toBeDefined()
    expect(result.answer_reveal!.term).toBe('Correct required equity')
    expect(result.answer_reveal!.correct).toBe('25%')
    expect(result.answer_reveal!.yours).toBe('28%')
  })

  it('a far-off answer ("mistake" tier) also shows the correct value', () => {
    const result = evaluateStepLocally(step, 90, 0)
    expect(result.quality).toBe('mistake')
    expect(result.answer_reveal?.correct).toBe('25%')
    expect(result.answer_reveal?.yours).toBe('90%')
  })
})

describe('4. Multi-item reveal step types are NOT given a redundant generic answer_reveal', () => {
  it('range_bucket (l5-s10, Pair/Suited/Offsuit) has its own per-hand reveal component — evaluator adds no generic answer_reveal', () => {
    const step = findStep('l5-s10')
    const wrongAssignments = { AA: 'suited', KQs: 'pair', JTo: 'suited', 77: 'pair', AKo: 'suited', QQ: 'pair', T9s: 'pair', '84o': 'suited' }
    const result = evaluateStepLocally(step, wrongAssignments, 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })

  it('hand_ranking_order (l1-s11) has its own per-slot reveal component — evaluator adds no generic answer_reveal', () => {
    const step = findStep('l1-s11')
    const correctOrder = (step.hand_ranking_order_items ?? []).map((i) => i.id)
    const reversed = [...correctOrder].reverse()
    const result = evaluateStepLocally(step, reversed, 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })

  it('board_rank_sort (csd-s3) has its own per-slot reveal component — evaluator adds no generic answer_reveal', () => {
    const step = findStep('csd-s3')
    const target = step.board_rank_sort_target ?? []
    const reversed = [...target].reverse()
    const result = evaluateStepLocally(step, reversed, 0)
    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })

  it('straight_detective (fl4-s7) has its own per-candidate reveal component — evaluator adds no generic answer_reveal', () => {
    const step = findStep('fl4-s7')
    const result = evaluateStepLocally(step, ['J8'], 0) // the decoy, not the real Q-J combo
    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })

  it('board_autopsy (fl8-s7) has its own per-claim reveal component — evaluator adds no generic answer_reveal', () => {
    const step = findStep('fl8-s7')
    const result = evaluateStepLocally(step, [], 0) // flags nothing, misses the real errors
    expect(result.quality).not.toBe('perfect')
    expect(result.answer_reveal).toBeUndefined()
  })
})

describe('5. Accepted-alternative questions never falsely claim a single exclusive answer', () => {
  const step: LessonStep = {
    id: 'fixture-tied-options',
    type: 'decision_spot',
    options: [
      { id: 'a', label: 'Bet 33%', quality: 'perfect', feedback: 'Great sizing.' },
      { id: 'b', label: 'Bet 50%', quality: 'perfect', feedback: 'Also great sizing.' },
      { id: 'c', label: 'Check', quality: 'mistake', feedback: 'Too passive here.' },
    ],
  } as LessonStep

  it('lists BOTH tied-for-best options when the learner picks a lower tier, joined rather than showing only one', () => {
    const result = evaluateStepLocally(step, 'c', 0)
    expect(result.answer_reveal?.correct).toBe('Bet 33% or Bet 50%')
  })

  it('picking either tied-for-best option counts as fully correct — no reveal for either', () => {
    expect(evaluateStepLocally(step, 'a', 0).answer_reveal).toBeUndefined()
    expect(evaluateStepLocally(step, 'b', 0).answer_reveal).toBeUndefined()
  })
})

describe('6. Scenario tree — optimal line reveal derived from the tree\'s own leaf outcomes', () => {
  const step: LessonStep = {
    id: 'fixture-scenario',
    type: 'scenario_tree',
    scenario_root: 'root',
    scenario_nodes: [
      {
        id: 'root',
        label: 'Facing a bet',
        children: [
          { option_label: 'Fold', node_id: 'fold_out' },
          { option_label: 'Raise', node_id: 'raise_out' },
        ],
      },
      { id: 'fold_out', label: 'Folded', outcome: { ev_bb: 0, label: 'Give up the pot', quality: 'mistake', explanation: 'Folding forfeits a +EV spot.' } },
      { id: 'raise_out', label: 'Raised', outcome: { ev_bb: 5, label: 'Raise for value', quality: 'perfect', explanation: 'Highest-EV line.' } },
    ],
  } as LessonStep

  it('taking the losing line (Fold) reveals the optimal line by its option-label trail', () => {
    const result = evaluateStepLocally(step, { quality: 'mistake', explanation: 'Folding forfeits a +EV spot.' }, 0)
    expect(result.answer_reveal?.term).toBe('Optimal line')
    expect(result.answer_reveal?.correct).toBe('Raise')
  })

  it('taking the optimal line (Raise) gets no reveal', () => {
    const result = evaluateStepLocally(step, { quality: 'perfect', explanation: 'Highest-EV line.' }, 0)
    expect(result.answer_reveal).toBeUndefined()
  })
})

describe('7. Scoring/XP are unaffected by answer_reveal — same score as before this feature existed', () => {
  it('ev-s6 CALL mistake still earns exactly the mistake-tier score/xp regardless of the reveal', () => {
    const step = findStep('ev-s6')
    const result = evaluateStepLocally(step, 'call', 0)
    expect(result.score).toBe(35) // QUALITY_SCORES.mistake
    expect(result.xp_earned).toBe(Math.round((step.xp ?? 10) * 0.2))
  })
})
