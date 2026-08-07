import { describe, it, expect } from 'vitest'
import { LESSONS, LESSONS_BY_MODULE, LEARNING_MODULES } from '../curriculum'
import { PUSH_FOLD_ITERATION, INDIFFERENCE_EXAMPLE, CLAIRVOYANCE_GAME, HALF_POT_ALPHA_MDF_EXAMPLE } from '../gameTheoryContent'
import { clairvoyanceEquilibrium, alpha, mdf } from '../gameTheoryEngine'
import type { LessonStep } from '../types'

const MODULE_ID = 'game-theory-foundations-module'

// 9, not 10: the original Lessons 1-2 ("Your Move Changes Mine" /
// "Find the Best Response") were merged into a single lesson that kept
// Lesson 1's id, so progress already recorded against it survives the merge.
const MODULE_10_LESSON_IDS = [
  'your-move-changes-mine',
  'the-exploit-has-a-cost',
  'the-strategy-loop',
  'when-neither-player-can-improve',
  'make-them-indifferent',
  'the-clairvoyance-game',
  'how-much-must-you-defend',
  'mdf-is-not-a-commandment',
  'equilibrium-lab',
]

function allModule10Steps(): LessonStep[] {
  const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
  return lessons.flatMap((l) => l.steps)
}

describe('Module 10 (Game Theory Foundations) — registration', () => {
  it('the module is registered as complete content, not a roadmap placeholder', () => {
    const mod = LEARNING_MODULES.find((m) => m.id === MODULE_ID)
    expect(mod).toBeDefined()
    expect(mod!.contentStatus).toBe('complete')
    expect(mod!.stageId).toBe('game-theory')
    expect(mod!.order).toBe(10)
    expect(mod!.prerequisiteModuleId).toBe('blockers-module')
  })

  it('all 9 lessons are registered, with contiguous sort_order 1..9', () => {
    const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
    expect(lessons.map((l) => l.id).sort()).toEqual([...MODULE_10_LESSON_IDS].sort())
    const orders = lessons.map((l) => l.sort_order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("the module's advertised lesson count matches the lessons actually registered", () => {
    const mod = LEARNING_MODULES.find((m) => m.id === MODULE_ID)!
    expect(mod.estimatedLessons).toBe((LESSONS_BY_MODULE[MODULE_ID] ?? []).length)
  })

  it('the merged Lesson 1 teaches both halves and carries both lessons\' XP, so Module 10\'s total is unchanged', () => {
    const merged = LESSONS.find((l) => l.id === 'your-move-changes-mine')!
    expect(merged.sort_order).toBe(1)
    // Both concepts, in their original teaching order.
    expect(merged.concept_ids).toEqual(['strategy_interdependence', 'maximally_exploitative_strategy'])
    // 130 (old Lesson 1) + 140 (old Lesson 2), so the module total does not move.
    expect(merged.xp_reward).toBe(270)
    // Same step XP total as the two lessons had between them (68 + 83).
    const stepXp = merged.steps.reduce((sum, s) => sum + (s.xp ?? 10), 0)
    expect(stepXp).toBe(151)
    // Continues into what used to be Lesson 3.
    expect(merged.next_lesson_teaser).toBe('The Exploit Has a Cost')
  })

  it('no lesson still points at the removed "find-the-best-response" lesson', () => {
    expect(LESSONS.some((l) => l.id === 'find-the-best-response')).toBe(false)
    for (const l of LESSONS) {
      expect(l.next_lesson_teaser).not.toBe('Find the Best Response')
    }
  })

  it('every "Lesson 10.N" cross-reference points at a lesson that actually has sort_order N', () => {
    const bySortOrder = new Map(
      (LESSONS_BY_MODULE[MODULE_ID] ?? []).map((l) => [l.sort_order, l]),
    )
    const refs = new Set<number>()
    for (const step of allModule10Steps()) {
      const text = JSON.stringify(step)
      for (const m of text.matchAll(/Lessons? 10\.(\d)(?:-10\.(\d))?/g)) {
        refs.add(Number(m[1]))
        if (m[2]) refs.add(Number(m[2]))
      }
    }
    expect(refs.size).toBeGreaterThan(0)
    for (const n of refs) {
      expect(bySortOrder.has(n), `Lesson 10.${n} is referenced but no lesson has sort_order ${n}`).toBe(true)
    }
  })

  it('every Module 10 lesson has id === slug and module_id set correctly', () => {
    for (const l of LESSONS_BY_MODULE[MODULE_ID] ?? []) {
      expect(l.id).toBe(l.slug)
      expect(l.module_id).toBe(MODULE_ID)
    }
  })

  it('every Module 10 lesson has globally unique, non-empty step ids', () => {
    const seen = new Set<string>()
    for (const l of LESSONS_BY_MODULE[MODULE_ID] ?? []) {
      const ids = l.steps.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) {
        expect(id.length).toBeGreaterThan(0)
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
  })

  it('no Module 10 lesson id/step id collides with any lesson/step id elsewhere in the curriculum', () => {
    const module10Ids = new Set(allModule10Steps().map((s) => s.id))
    const otherSteps = LESSONS.filter((l) => l.module_id !== MODULE_ID).flatMap((l) => l.steps)
    for (const s of otherSteps) {
      expect(module10Ids.has(s.id)).toBe(false)
    }
  })
})

describe('Module 10 — tendency_summary integrity', () => {
  it("equilibrium-lab's tendency_summary only references step ids that exist earlier in the same lesson", () => {
    const lesson = LESSONS.find((l) => l.id === 'equilibrium-lab')
    expect(lesson).toBeDefined()
    const summaryStep = lesson!.steps.find((s) => s.type === 'tendency_summary')
    expect(summaryStep).toBeDefined()
    const stepIds = new Set(lesson!.steps.map((s) => s.id))
    for (const refId of summaryStep!.summary_source_step_ids ?? []) {
      expect(stepIds.has(refId)).toBe(true)
    }
    expect((summaryStep!.summary_source_step_ids ?? []).length).toBeGreaterThan(0)
  })

  it('every referenced tendency step actually carries a tendency_tag', () => {
    const lesson = LESSONS.find((l) => l.id === 'equilibrium-lab')!
    const byId = new Map(lesson.steps.map((s) => [s.id, s]))
    const summaryStep = lesson.steps.find((s) => s.type === 'tendency_summary')!
    for (const refId of summaryStep.summary_source_step_ids ?? []) {
      const step = byId.get(refId)
      expect(step?.tendency_tag).toBeTruthy()
      expect(step?.tendency_tag_label).toBeTruthy()
    }
  })
})

describe('Module 10 — source-lock: push/fold iteration data (AF)', () => {
  it('the-strategy-loop and equilibrium-lab walk the exact, unmodified PUSH_FOLD_ITERATION sequence', () => {
    for (const lessonId of ['the-strategy-loop', 'equilibrium-lab']) {
      const lesson = LESSONS.find((l) => l.id === lessonId)!
      const iterStep = lesson.steps.find((s) => s.type === 'strategy_response_lab' && s.strategy_response_lab_mode === 'iterate')!
      expect(iterStep.strategy_response_lab_iteration_ids).toEqual(PUSH_FOLD_ITERATION.map((s) => s.id))
    }
  })

  it('source-cited push/fold values are exactly as specified: 100%/66.21%/13.77, 46.61%/8.48, 58.3%/37.4%/10.45', () => {
    const byId = Object.fromEntries(PUSH_FOLD_ITERATION.map((s) => [s.id, s]))
    expect(byId['iter-1-bn'].freq).toBeCloseTo(1.0, 6)
    expect(byId['iter-1-bb'].freq).toBeCloseTo(0.6621, 6)
    expect(byId['iter-1-bb'].bbEV).toBeCloseTo(13.77, 6)
    expect(byId['iter-2-bn'].freq).toBeCloseTo(0.4661, 6)
    expect(byId['iter-2-bb-stale'].freq).toBeCloseTo(0.6621, 6)
    expect(byId['iter-2-bb-stale'].bbEV).toBeCloseTo(8.48, 6)
    expect(byId['equilibrium-bn'].freq).toBeCloseTo(0.583, 6)
    expect(byId['equilibrium-bb'].freq).toBeCloseTo(0.374, 6)
    expect(byId['equilibrium-bb'].bbEV).toBeCloseTo(10.45, 6)
  })

  it("the-strategy-loop's narrative recap cites the exact same numbers as PUSH_FOLD_ITERATION (no prose drift)", () => {
    const lesson = LESSONS.find((l) => l.id === 'the-strategy-loop')!
    const recap = lesson.steps.find((s) => s.id === 'sl-s3')!.narrative ?? ''
    expect(recap).toContain('66.21%')
    expect(recap).toContain('13.77')
    expect(recap).toContain('46.61%')
    expect(recap).toContain('8.48')
    expect(recap).toContain('58.3%')
    expect(recap).toContain('37.4%')
    expect(recap).toContain('10.45')
  })
})

describe('Module 10 — source-lock: Indifference Principle worked example (AF)', () => {
  it('43s pushes 74%/folds 26%; Q6s calls 39%/folds 61% — exact, unmodified', () => {
    expect(INDIFFERENCE_EXAMPLE.bottomPushingHand.hand).toBe('43s')
    expect(INDIFFERENCE_EXAMPLE.bottomPushingHand.freqA).toBeCloseTo(0.74, 6)
    expect(INDIFFERENCE_EXAMPLE.bottomPushingHand.freqB).toBeCloseTo(0.26, 6)
    expect(INDIFFERENCE_EXAMPLE.bottomCallingHand.hand).toBe('Q6s')
    expect(INDIFFERENCE_EXAMPLE.bottomCallingHand.freqA).toBeCloseTo(0.39, 6)
    expect(INDIFFERENCE_EXAMPLE.bottomCallingHand.freqB).toBeCloseTo(0.61, 6)
    expect(INDIFFERENCE_EXAMPLE.bnEquilibriumPush).toBeCloseTo(0.583, 6)
    expect(INDIFFERENCE_EXAMPLE.bbEquilibriumCall).toBeCloseTo(0.374, 6)
  })

  it('make-them-indifferent renders the exact sourced 43s/Q6s frequencies in its content', () => {
    const lesson = LESSONS.find((l) => l.id === 'make-them-indifferent')!
    const s43 = lesson.steps.find((s) => s.id === 'mti-s4')!
    const items43 = s43.concept_structured_items ?? []
    expect(items43.find((i) => i.term === 'Push')?.description).toBe('74%')
    expect(items43.find((i) => i.term === 'Fold')?.description).toBe('26%')

    const sQ6 = lesson.steps.find((s) => s.id === 'mti-s5')!
    const itemsQ6 = sQ6.concept_structured_items ?? []
    expect(itemsQ6.find((i) => i.term === 'Call')?.description).toBe('39%')
    expect(itemsQ6.find((i) => i.term === 'Fold')?.description).toBe('61%')
  })
})

describe('Module 10 — source-lock: Clairvoyance Game (AF)', () => {
  it('the game constants match the source exactly: pot $100, bet $100, board, 50/50 AA/QQ prior', () => {
    expect(CLAIRVOYANCE_GAME.pot).toBe(100)
    expect(CLAIRVOYANCE_GAME.bet).toBe(100)
    expect(CLAIRVOYANCE_GAME.stacks).toBe(100)
    expect(CLAIRVOYANCE_GAME.probAA).toBeCloseTo(0.5, 6)
    expect(CLAIRVOYANCE_GAME.board).toEqual(['3s', '3h', '3c', '2d', '2s'])
  })

  it('the computed equilibrium reproduces AA 100% / QQ 50% / KK 50% exactly', () => {
    const eq = clairvoyanceEquilibrium(CLAIRVOYANCE_GAME.pot, CLAIRVOYANCE_GAME.bet)
    expect(eq.aaBetFreq).toBeCloseTo(1, 6)
    expect(eq.qqBetFreq).toBeCloseTo(0.5, 6)
    expect(eq.kkCallFreq).toBeCloseTo(0.5, 6)
  })

  it("the-clairvoyance-game's equilibrium reveal cites the exact sourced values ($75/$25)", () => {
    const lesson = LESSONS.find((l) => l.id === 'the-clairvoyance-game')!
    const reveal = lesson.steps.find((s) => s.id === 'cvg-s7')!
    const items = reveal.concept_structured_items ?? []
    expect(items.find((i) => i.term === 'AA')?.description).toContain('100%')
    expect(items.find((i) => i.term === 'QQ')?.description).toContain('50%')
    expect(items.find((i) => i.term === 'KK vs a bet')?.description).toContain('50%')
    expect(items.find((i) => i.term === 'Game EV')?.description).toContain('$75')
    expect(items.find((i) => i.term === 'Game EV')?.description).toContain('$25')
  })
})

describe('Module 10 — source-lock: half-pot Alpha/MDF example (AE/AF)', () => {
  it('half-pot bet (pot 100, bet 50) gives alpha 33.33%, MDF 66.67% — exact formula match', () => {
    expect(alpha(HALF_POT_ALPHA_MDF_EXAMPLE.pot, HALF_POT_ALPHA_MDF_EXAMPLE.bet) * 100).toBeCloseTo(HALF_POT_ALPHA_MDF_EXAMPLE.alphaPct, 1)
    expect(mdf(HALF_POT_ALPHA_MDF_EXAMPLE.pot, HALF_POT_ALPHA_MDF_EXAMPLE.bet) * 100).toBeCloseTo(HALF_POT_ALPHA_MDF_EXAMPLE.mdfPct, 1)
  })

  it("how-much-must-you-defend's mdf_slider target matches the sourced 66.67% exactly", () => {
    const lesson = LESSONS.find((l) => l.id === 'how-much-must-you-defend')!
    const step = lesson.steps.find((s) => s.id === 'hmd-s4')!
    expect(step.mdf_slider_target).toBeCloseTo(HALF_POT_ALPHA_MDF_EXAMPLE.mdfPct, 6)
  })

  it('value/bluff ratio (75%/25%) is cited exactly as sourced', () => {
    expect(HALF_POT_ALPHA_MDF_EXAMPLE.valuePct).toBe(75)
    expect(HALF_POT_ALPHA_MDF_EXAMPLE.bluffPct).toBe(25)
  })
})

describe('Module 10 — data authenticity: every step carries a classified source where it makes a theory claim', () => {
  it('every concept_reveal, strategy_response_lab, clairvoyance_lab, ev_indifference_balance, unilateral_deviation_test, and mdf_slider step with an explicit source uses a valid SourceEvidenceType', () => {
    const valid = new Set(['exact_derived', 'source_reconstructed', 'pedagogical_model'])
    for (const step of allModule10Steps()) {
      if (step.source) {
        expect(valid.has(step.source.type)).toBe(true)
        expect(step.source.book.length).toBeGreaterThan(0)
        expect(step.source.section.length).toBeGreaterThan(0)
      }
    }
  })

  it('no step type is labeled "Nash" or "equilibrium" via a GTO/solver claim without a source or a live-derived engine step', () => {
    // Every concept_reveal step whose content mentions "Nash equilibrium" as a defined term
    // must either cite a source, or be a step that follows a live unilateral_deviation_test /
    // clairvoyance_lab step earlier in the SAME lesson (i.e. it's a derived reveal, not an assertion).
    for (const lesson of LESSONS_BY_MODULE[MODULE_ID] ?? []) {
      lesson.steps.forEach((step, idx) => {
        const text = `${step.concept_content ?? ''} ${step.narrative ?? ''}`
        if (/Nash equilibrium/i.test(text) && step.type === 'concept_reveal') {
          const precededByDerivation = lesson.steps
            .slice(0, idx)
            .some((s) => s.type === 'unilateral_deviation_test' || s.type === 'clairvoyance_lab' || s.type === 'strategy_response_lab')
          const hasSource = !!step.source
          expect(precededByDerivation || hasSource).toBe(true)
        }
      })
    }
  })
})

describe('Module 10 — QA: strategy_response_lab / clairvoyance_lab / ev_indifference_balance / unilateral_deviation_test steps carry required fields', () => {
  it('every strategy_response_lab step declares a mode', () => {
    for (const step of allModule10Steps()) {
      if (step.type === 'strategy_response_lab') {
        expect(step.strategy_response_lab_mode).toBeTruthy()
      }
    }
  })

  it("every strategy_response_lab 'counter_exploit' step has at least 2 distinct, non-empty options", () => {
    for (const step of allModule10Steps()) {
      if (step.type === 'strategy_response_lab' && step.strategy_response_lab_mode === 'counter_exploit') {
        const ids = (step.options ?? []).map((o) => o.id)
        expect(new Set(ids).size).toBeGreaterThanOrEqual(2)
        for (const opt of step.options ?? []) {
          expect(opt.label.length).toBeGreaterThan(0)
          expect(opt.feedback.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('every unilateral_deviation_test step declares a player and a candidate equilibrium', () => {
    for (const step of allModule10Steps()) {
      if (step.type === 'unilateral_deviation_test') {
        expect(step.unilateral_deviation_test_player).toMatch(/^[AB]$/)
        expect(step.unilateral_deviation_test_equilibrium).toBeDefined()
      }
    }
  })

  it("every 'find_equilibrium' clairvoyance_lab step has at least one editable frequency", () => {
    for (const step of allModule10Steps()) {
      if (step.type === 'clairvoyance_lab' && step.clairvoyance_lab_mode === 'find_equilibrium') {
        expect((step.clairvoyance_lab_editable ?? []).length).toBeGreaterThan(0)
      }
    }
  })
})
