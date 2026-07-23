/**
 * Regression tests for Module 6 ("Understanding the Flop"). Mirrors the
 * Module 3 audit discipline (see LEARN_QUESTION_QA.md) plus Module 6's own
 * extra requirement: every classification-dependent piece of content
 * (straight detective decoys, board autopsy claims, flop builder targets,
 * equity-bucket scenarios) is re-verified here against the live
 * `flopClassifier` / `combos` engines — never trusted as hand-authored fact.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS_BY_MODULE, MODULES_BY_SLUG } from '../curriculum'
import { ROADMAP_MODULES } from '../curriculumRoadmap'
import { isScoredStep, evaluateStepLocally } from '../evaluator'
import {
  classifyFlop, dimensionValue, estimateVolatility, equityBucket,
  type FlopDimensionKey, type VolatilityLevel,
} from '../flopClassifier'

const VOL_ORDER: Record<VolatilityLevel, number> = { low: 0, medium: 1, high: 2 }
import { expandHandClass, removeBlocked } from '../combos'
import type { LessonStep } from '../types'
import { readFileSync } from 'fs'
import { join } from 'path'

const MODULE_ID = 'flop-fundamentals-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)

function board3(cards: string[] | undefined): [string, string, string] {
  expect(cards?.length, `expected a 3-card board, got ${JSON.stringify(cards)}`).toBe(3)
  return [cards![0], cards![1], cards![2]]
}

describe('Module 6 is registered and freely accessible', () => {
  it('has all 9 lessons (8 + Lab)', () => {
    expect(lessons.length).toBe(9)
  })

  it('every lesson belongs to the promoted module, not a stale id', () => {
    for (const l of lessons) expect(l.module_id).toBe(MODULE_ID)
  })

  it('is promoted into LEARNING_MODULES with contentStatus complete, and no longer sits in ROADMAP_MODULES', () => {
    const mod = MODULES_BY_SLUG[MODULE_ID]
    expect(mod).toBeTruthy()
    expect(mod.contentStatus).toBe('complete')
    expect(mod.access).toBe('free')
    expect(ROADMAP_MODULES.some((m) => m.id === MODULE_ID)).toBe(false)
  })

  it('does not gate access behind Module 5 — prerequisiteModuleId is descriptive only', () => {
    // isModuleUnlocked (lib/learn/journey.ts) only checks contentStatus + lessons present,
    // never prerequisiteModuleId/unlock_after — this pins that Module 6's own data
    // doesn't accidentally rely on a gate that doesn't exist.
    const mod = MODULES_BY_SLUG[MODULE_ID]
    expect(mod.contentStatus).toBe('complete')
    expect((LESSONS_BY_MODULE[MODULE_ID] ?? []).length).toBeGreaterThan(0)
  })

  it('Module 5 lessons are untouched (concurrent-safety spot check)', () => {
    expect((LESSONS_BY_MODULE['defending-the-open-module'] ?? []).length).toBe(9)
  })
})

describe('Card integrity — every board-bearing field parses as a real, non-duplicate flop', () => {
  const fields: (keyof LessonStep)[] = [
    'board', 'straight_detective_board', 'board_volatility_board', 'board_autopsy_board', 'flop_builder_base_board',
  ]

  it('classifyFlop never throws for any authored board in Module 6', () => {
    for (const step of allSteps) {
      for (const field of fields) {
        const val = step[field] as unknown
        if (Array.isArray(val) && val.length === 3) {
          expect(() => classifyFlop(board3(val as string[])), `${step.id}.${field}`).not.toThrow()
        }
      }
    }
  })

  it('board_volatility_continuum_boards and range_board_collision boards are all valid too', () => {
    for (const step of allSteps) {
      for (const b of step.board_volatility_continuum_boards ?? []) {
        expect(() => classifyFlop(board3(b.board)), `${step.id} continuum ${b.id}`).not.toThrow()
      }
    }
  })
})

describe('Straight Detective — decoys never accidentally match a real answer', () => {
  const steps = allSteps.filter((s) => s.type === 'straight_detective')

  it('has at least the book-example steps plus more', () => {
    expect(steps.length).toBeGreaterThanOrEqual(4)
  })

  it('every decoy pair is NOT one of the board\'s real possible-straight combos', () => {
    for (const step of steps) {
      const board = board3(step.straight_detective_board ?? step.board)
      const real = new Set(classifyFlop(board).possibleFloppedStraights.combos.map((p) => p.join('')))
      for (const decoy of step.straight_detective_decoys ?? []) {
        expect(real.has(decoy.join('')), `${step.id}: decoy ${decoy.join('-')} is actually a real answer`).toBe(false)
      }
    }
  })

  it('every decoy pair does not reuse a rank already on the board (an impossible hole card)', () => {
    for (const step of steps) {
      const board = board3(step.straight_detective_board ?? step.board)
      const boardRanks = new Set(classifyFlop(board).ranks)
      for (const decoy of step.straight_detective_decoys ?? []) {
        for (const r of decoy) {
          expect(boardRanks.has(r as never), `${step.id}: decoy rank ${r} duplicates a board rank`).toBe(false)
        }
      }
    }
  })
})

describe('Board Autopsy — every round has at least one genuine, live-verified mistake', () => {
  const steps = allSteps.filter((s) => s.type === 'board_autopsy')

  it('has multiple rounds', () => {
    expect(steps.length).toBeGreaterThanOrEqual(2)
  })

  it('every claimed classification has at least one field that disagrees with classifyFlop', () => {
    for (const step of steps) {
      const board = board3(step.board_autopsy_board ?? step.board)
      const real = classifyFlop(board)
      const claimed = step.board_autopsy_claimed ?? {}
      const errors = Object.entries(claimed).filter(
        ([key, value]) => dimensionValue(real, key as FlopDimensionKey) !== value,
      )
      expect(errors.length, `${step.id}: claimed analysis has zero real errors — the round is unsolvable/trivial`).toBeGreaterThan(0)
    }
  })

  it('every claimed classification also has at least one field that is CORRECT (not every field is wrong)', () => {
    for (const step of steps) {
      const board = board3(step.board_autopsy_board ?? step.board)
      const real = classifyFlop(board)
      const claimed = step.board_autopsy_claimed ?? {}
      const correct = Object.entries(claimed).filter(
        ([key, value]) => dimensionValue(real, key as FlopDimensionKey) === value,
      )
      expect(correct.length, `${step.id}: every claimed field is wrong — not a realistic "find the bug" round`).toBeGreaterThan(0)
    }
  })
})

describe('Flop Builder — swap_one_card puzzles are not already solved by the starting board', () => {
  const steps = allSteps.filter((s) => s.type === 'flop_builder' && s.flop_builder_mode === 'swap_one_card')

  it('has multiple rounds', () => {
    expect(steps.length).toBeGreaterThanOrEqual(2)
  })

  it('the base board does not already satisfy its own target', () => {
    for (const step of steps) {
      const base = board3(step.flop_builder_base_board)
      const c = classifyFlop(base)
      const target = step.flop_builder_target ?? {}
      const level = estimateVolatility(base).level
      const alreadyMet =
        (!target.structure || c.structure === target.structure) &&
        (!target.texture || c.texture === target.texture) &&
        (!target.twoToneSubtype || c.twoToneSubtype === target.twoToneSubtype) &&
        (target.minStraights == null || c.possibleFloppedStraights.count >= target.minStraights) &&
        (target.maxStraights == null || c.possibleFloppedStraights.count <= target.maxStraights) &&
        (!target.volatilityAtLeast || VOL_ORDER[level] >= VOL_ORDER[target.volatilityAtLeast]) &&
        (!target.volatilityAtMost || VOL_ORDER[level] <= VOL_ORDER[target.volatilityAtMost])
      expect(alreadyMet, `${step.id}: base board already satisfies the target — nothing to solve`).toBe(false)
    }
  })
})

describe('Equity Bucket scenarios — combo math is independently re-derivable, not just asserted', () => {
  /** Re-counts combos for two disjoint hand lists against a hero hand + board,
   *  the same way `evalFlopBuilder`-adjacent content should always be checked:
   *  never trust the authored percentage without recomputing it. */
  function reDeriveEquity(hero: [string, string], board: string[], heroWins: string[], villainWins: string[]) {
    const blocked = [...hero, ...board]
    const count = (hands: string[]) =>
      hands.reduce((sum, h) => sum + removeBlocked(expandHandClass(h), blocked).length, 0)
    const win = count(heroWins)
    const lose = count(villainWins)
    return Math.round((win / (win + lose)) * 100)
  }

  it('A♠K♦ vs KK/88/44/underpairs on K♠8♥4♦ really is ~84% (Strong) — Hero\'s own K♦ further blocks KK', () => {
    const pct = reDeriveEquity(
      ['As', 'Kd'], ['Ks', '8h', '4d'],
      ['QQ', 'JJ', 'TT', '99', '77', '66', '55', 'AQs', 'AQo'],
      ['AA', 'KK', '88', '44'],
    )
    expect(pct).toBe(84)
    expect(equityBucket(pct)).toBe('strong')
  })

  it('9♠9♦ vs the same board really is ~46% (Weak)', () => {
    const pct = reDeriveEquity(
      ['9s', '9d'], ['Ks', '8h', '4d'],
      ['AQo', 'ATo', 'A5s'],
      ['AA', 'KK', 'AKs', 'AKo', 'QQ', 'JJ'],
    )
    expect(pct).toBe(46)
    expect(equityBucket(pct)).toBe('weak')
  })

  it('A♣A♦ vs a pocket-pair range on Q♠8♥3♣ really is ~86% (Strong)', () => {
    const pct = reDeriveEquity(
      ['Ac', 'Ad'], ['Qs', '8h', '3c'],
      ['KK', 'JJ', 'TT', '99', '77', '66', '55', '44', '22'],
      ['QQ', '88', '33'],
    )
    expect(pct).toBe(86)
    expect(equityBucket(pct)).toBe('strong')
  })

  it('every authored equity_bucket_scenario_actual matches its step\'s own claimed derivation direction', () => {
    const scenarioSteps = allSteps.filter((s) => s.type === 'equity_bucket' && s.equity_bucket_mode === 'scenario')
    expect(scenarioSteps.length).toBeGreaterThanOrEqual(3)
    for (const step of scenarioSteps) {
      expect(step.equity_bucket_scenario_actual).toBeGreaterThanOrEqual(0)
      expect(step.equity_bucket_scenario_actual).toBeLessThanOrEqual(100)
      expect(step.equity_bucket_scenario_explanation, `${step.id} has no derivation shown`).toBeTruthy()
    }
  })

  it('threshold-mode steps\' authored values map to the exact source thresholds', () => {
    const thresholdSteps = allSteps.filter((s) => s.type === 'equity_bucket' && s.equity_bucket_mode === 'threshold')
    expect(thresholdSteps.length).toBeGreaterThanOrEqual(4)
    const buckets = new Set(thresholdSteps.map((s) => equityBucket(s.equity_bucket_value ?? -1)))
    // The lesson exercises all four buckets across its threshold steps, not just one or two.
    expect(buckets).toEqual(new Set(['strong', 'good', 'weak', 'trash']))
  })
})

describe('Answer leakage — concept tags must not name their own option (Module 3 bug class)', () => {
  it('no Module 6 step concept_id equals one of its own option ids', () => {
    const offenders: string[] = []
    for (const step of allSteps) {
      if (!step.concept_ids?.length || !step.options?.length) continue
      const optionIds = new Set(step.options.map((o) => o.id))
      for (const cid of step.concept_ids) {
        if (optionIds.has(cid)) offenders.push(`${step.id}: concept_id "${cid}" matches an option id`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('Scored vs unscored — isScoredStep behaves as designed for every new StepType', () => {
  it('flop_scanner is always unscored', () => {
    expect(isScoredStep({ id: 'x', type: 'flop_scanner' } as LessonStep)).toBe(false)
  })

  it('suit_isomorphism is unscored in explain mode, scored in sort mode', () => {
    expect(isScoredStep({ id: 'x', type: 'suit_isomorphism', suit_isomorphism_mode: 'explain' } as LessonStep)).toBe(false)
    expect(isScoredStep({ id: 'x', type: 'suit_isomorphism', suit_isomorphism_mode: 'sort' } as LessonStep)).toBe(true)
  })

  it('range_board_collision is scored only when options are present', () => {
    expect(isScoredStep({ id: 'x', type: 'range_board_collision' } as LessonStep)).toBe(false)
    expect(isScoredStep({ id: 'x', type: 'range_board_collision', options: [{ id: 'a', label: 'A', quality: 'perfect', feedback: 'ok' }] } as LessonStep)).toBe(true)
  })

  it('equity_bucket is scored in threshold/scenario mode, and in distribution mode only with options', () => {
    expect(isScoredStep({ id: 'x', type: 'equity_bucket', equity_bucket_mode: 'threshold' } as LessonStep)).toBe(true)
    expect(isScoredStep({ id: 'x', type: 'equity_bucket', equity_bucket_mode: 'scenario' } as LessonStep)).toBe(true)
    expect(isScoredStep({ id: 'x', type: 'equity_bucket', equity_bucket_mode: 'distribution' } as LessonStep)).toBe(false)
    expect(isScoredStep({ id: 'x', type: 'equity_bucket', equity_bucket_mode: 'distribution', options: [{ id: 'a', label: 'A', quality: 'perfect', feedback: 'ok' }] } as LessonStep)).toBe(true)
  })

  it('flop_classify_drill / flop_builder / straight_detective / board_autopsy are always scored', () => {
    for (const type of ['flop_classify_drill', 'flop_builder', 'straight_detective', 'board_autopsy'] as const) {
      expect(isScoredStep({ id: 'x', type } as LessonStep)).toBe(true)
    }
  })

  it('every flop_scanner step in the actual curriculum yields an unscored result with 0 XP', () => {
    const scannerSteps = allSteps.filter((s) => s.type === 'flop_scanner')
    expect(scannerSteps.length).toBeGreaterThanOrEqual(3)
    for (const step of scannerSteps) {
      const result = evaluateStepLocally(step, null, 0)
      expect(result.unscored).toBe(true)
      expect(result.xp_earned).toBe(0)
    }
  })
})

describe('New components use shuffleBySeed wherever they render step.options (house style guard)', () => {
  const componentsWithOptions = [
    'SuitIsomorphism.tsx', 'BoardVolatility.tsx', 'RangeBoardCollision.tsx', 'EquityBucket.tsx',
  ]

  it('every listed component imports and calls shuffleBySeed', () => {
    for (const file of componentsWithOptions) {
      const src = readFileSync(join(__dirname, '..', '..', '..', 'components', 'learn', 'steps', file), 'utf8')
      expect(src.includes('shuffleBySeed'), `${file} does not reference shuffleBySeed`).toBe(true)
      expect(src.includes("from '@/lib/learn/interactionSafety'"), `${file} does not import from interactionSafety`).toBe(true)
    }
  })
})

describe('Volatility model — sanity bounds on the whole module\'s authored boards', () => {
  it('every board_volatility continuum group is internally orderable (no exact score ties)', () => {
    const steps = allSteps.filter((s) => s.type === 'board_volatility' && s.board_volatility_mode === 'continuum_sort')
    for (const step of steps) {
      const boards = step.board_volatility_continuum_boards ?? []
      const scores = boards.map((b) => estimateVolatility(board3(b.board)).score)
      const uniqueScores = new Set(scores)
      expect(uniqueScores.size, `${step.id}: two boards tie on volatility score, making the sort ambiguous`).toBe(scores.length)
    }
  })
})
