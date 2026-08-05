/**
 * The Language of Bet Sizing (Module 12) — source-consistency lock for `module12Content.ts`,
 * following `module11Content.test.ts`'s existing pattern: every constant carries a valid source
 * classification, and every numeric claim Lessons 1-5's content depends on stays internally
 * consistent with the book-cited totals it's derived from.
 */
import { describe, it, expect } from 'vitest'
import {
  HAND_RANGE_POOL,
  RANGE_COMPRESSION_EXAMPLE_A,
  RANGE_COMPRESSION_EXAMPLE_B,
  RANGE_COMPRESSION_EXAMPLE_C,
  RANGE_COMPRESSION_EXAMPLE_D,
  RANGE_COMPRESSION_STATES,
  HAND_RANGE_337_340_SOURCE,
  TOY_GAME_A,
  TOY_GAME_B,
  TOY_GAME_C,
  TOY_GAME_D,
  TOY_GAME_E,
  TOY_GAMES_A_TO_E_SOURCE,
  SPR_TABLE_90,
  SPR_TABLE_90_SOURCE,
  MISCONCEPTION_BY_CONCEPT_ID,
  MENTAL_MODEL_AUDIT,
} from '../module12Content'
import type { SourceEvidenceType } from '../types'

const VALID_TYPES: SourceEvidenceType[] = ['exact_derived', 'source_reconstructed', 'pedagogical_model']

describe('Module 12 content sources carry a valid, non-empty classification', () => {
  for (const [name, source] of Object.entries({ HAND_RANGE_337_340_SOURCE, TOY_GAMES_A_TO_E_SOURCE })) {
    it(`${name} has a valid type + non-empty section`, () => {
      expect(VALID_TYPES).toContain(source.type)
      expect(source.section.length).toBeGreaterThan(0)
      expect(source.book).toBe('Modern Poker Theory')
    })
  }
})

describe('HAND_RANGE_POOL — the fixed 10-combo [0-1] Toy Game pool', () => {
  it('is exactly AA down through 55, no duplicates', () => {
    expect(HAND_RANGE_POOL).toEqual(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55'])
    expect(new Set(HAND_RANGE_POOL).size).toBe(10)
  })
})

function assertEveryPoolHandCovered(strategies: Record<string, Record<string, number>>) {
  for (const hand of HAND_RANGE_POOL) {
    expect(strategies[hand], `${hand} missing an entry`).toBeDefined()
    const total = Object.values(strategies[hand]).reduce((s, f) => s + f, 0)
    expect(total, `${hand}'s mix should sum to ~1`).toBeCloseTo(1, 6)
  }
}

describe('Range Compression Examples A-D — every pool hand has a complete, valid mix', () => {
  it.each([
    ['Example A', RANGE_COMPRESSION_EXAMPLE_A],
    ['Example B', RANGE_COMPRESSION_EXAMPLE_B],
    ['Example C', RANGE_COMPRESSION_EXAMPLE_C],
    ['Example D', RANGE_COMPRESSION_EXAMPLE_D],
  ])('%s: all 10 pool hands present, each mix sums to 1', (_label, example) => {
    assertEveryPoolHandCovered(example.strategies)
  })

  it('Example A: AA uses only full_pot (the biggest size, per the book\'s own described structure)', () => {
    expect(RANGE_COMPRESSION_EXAMPLE_A.strategies.AA).toEqual({ full_pot: 1 })
  })

  it('Example A: JJ-77 always check', () => {
    for (const h of ['JJ', 'TT', '99', '88', '77']) {
      expect(RANGE_COMPRESSION_EXAMPLE_A.strategies[h]).toEqual({ check: 1 })
    }
  })

  it('Example B: the exposed 1/3-pot size is abandoned entirely — QQ moves fully to 2/3-pot, not partially', () => {
    expect(RANGE_COMPRESSION_EXAMPLE_B.strategies.QQ).toEqual({ two_thirds_pot: 1 })
    // No pool hand should have any one_third_pot weight left in Example B — the central
    // "abandonment, not reduced usage" teaching point this lesson exists to prove.
    for (const hand of HAND_RANGE_POOL) {
      expect(RANGE_COMPRESSION_EXAMPLE_B.strategies[hand].one_third_pot ?? 0).toBe(0)
    }
  })

  it('Example C: matches Table 89\'s own exact aggregate (30% full-pot, 70% check) combo-weighted across the 10-hand pool', () => {
    let fullPotShare = 0
    let checkShare = 0
    for (const hand of HAND_RANGE_POOL) {
      const mix = RANGE_COMPRESSION_EXAMPLE_C.strategies[hand]
      fullPotShare += (mix.full_pot ?? 0) / HAND_RANGE_POOL.length
      checkShare += (mix.check ?? 0) / HAND_RANGE_POOL.length
    }
    expect(fullPotShare * 100).toBeCloseTo(30, 6)
    expect(checkShare * 100).toBeCloseTo(70, 6)
  })

  it('Example D: reproduces the book\'s exact quoted percentages (AA 42%/58%, 55 26%/74%, KK 100% full-pot)', () => {
    expect(RANGE_COMPRESSION_EXAMPLE_D.strategies.AA.all_in).toBeCloseTo(0.42, 6)
    expect(RANGE_COMPRESSION_EXAMPLE_D.strategies.AA.full_pot).toBeCloseTo(0.58, 6)
    expect(RANGE_COMPRESSION_EXAMPLE_D.strategies[55].all_in).toBeCloseTo(0.26, 6)
    expect(RANGE_COMPRESSION_EXAMPLE_D.strategies[55].full_pot).toBeCloseTo(0.74, 6)
    expect(RANGE_COMPRESSION_EXAMPLE_D.strategies.KK).toEqual({ full_pot: 1 })
  })

  it('EV declines A -> B, matching the book\'s own stated EV drop from adding raise pressure', () => {
    expect(RANGE_COMPRESSION_EXAMPLE_A.ev_label).toContain('56.11')
    expect(RANGE_COMPRESSION_EXAMPLE_B.ev_label).toContain('54.98')
  })

  it('RANGE_COMPRESSION_STATES is exactly the four examples, in A-B-C-D order', () => {
    expect(RANGE_COMPRESSION_STATES.map((s) => s.id)).toEqual(['example_a', 'example_b', 'example_c', 'example_d'])
  })
})

describe('Toy Games A-E — every Equity Bucket distribution sums to 100', () => {
  it.each([
    ['A', TOY_GAME_A],
    ['B', TOY_GAME_B],
    ['C', TOY_GAME_C],
    ['D', TOY_GAME_D],
    ['E', TOY_GAME_E],
  ])('Game %s: hero and villain buckets each sum to ~100', (_label, game) => {
    // Each bucket was independently rounded to 1 decimal place, so the sum can be off by a
    // few tenths without indicating a real data error — toBeCloseTo(100, 0) allows +/-0.5.
    const heroSum = game.hero.strong + game.hero.good + game.hero.weak + game.hero.trash
    const villainSum = game.villain.strong + game.villain.good + game.villain.weak + game.villain.trash
    expect(heroSum).toBeCloseTo(100, 0)
    expect(villainSum).toBeCloseTo(100, 0)
  })

  it('Game A: Hero has a big polarization DISADVANTAGE — fewer Strong combos than Villain', () => {
    expect(TOY_GAME_A.hero.strong).toBeLessThan(TOY_GAME_A.villain.strong)
  })

  it('Game C: ranges are symmetric — Hero and Villain buckets are identical', () => {
    expect(TOY_GAME_C.hero).toEqual({ ...TOY_GAME_C.villain, label: TOY_GAME_C.hero.label })
  })

  it('Game E: Hero has a big polarization ADVANTAGE — more Strong combos than Villain (mirror of Game A)', () => {
    expect(TOY_GAME_E.hero.strong).toBeGreaterThan(TOY_GAME_E.villain.strong)
    // Game E is the exact mirror of Game A (roles swapped, same underlying hand lists).
    expect(TOY_GAME_E.hero.strong).toBeCloseTo(TOY_GAME_A.villain.strong, 1)
    expect(TOY_GAME_E.villain.strong).toBeCloseTo(TOY_GAME_A.hero.strong, 1)
  })

  it('The A-through-E progression is monotonic: Hero\'s Strong-bucket share never decreases as the games advance', () => {
    const heroStrong = [TOY_GAME_A, TOY_GAME_B, TOY_GAME_C, TOY_GAME_D, TOY_GAME_E].map((g) => g.hero.strong)
    for (let i = 1; i < heroStrong.length; i++) {
      expect(heroStrong[i]).toBeGreaterThanOrEqual(heroStrong[i - 1])
    }
  })
})

describe('SPR_TABLE_90 — the four SPR bands (Ch.10 pp.609-610)', () => {
  it('has a valid source classification', () => {
    expect(['exact_derived', 'source_reconstructed', 'pedagogical_model']).toContain(SPR_TABLE_90_SOURCE.type)
    expect(SPR_TABLE_90_SOURCE.book).toBe('Modern Poker Theory')
  })

  it('is exactly the four book-cited bands, in ascending-SPR order, each non-empty', () => {
    expect(SPR_TABLE_90.map((b) => b.id)).toEqual(['spr_1_or_below', 'spr_1_to_2', 'spr_3', 'spr_5_to_10'])
    for (const b of SPR_TABLE_90) {
      expect(b.band.length).toBeGreaterThan(0)
      expect(b.description.length).toBeGreaterThan(10)
    }
  })

  it('only the two lowest bands include all-in', () => {
    expect(SPR_TABLE_90[0].band.toLowerCase()).toContain('all-in')
    expect(SPR_TABLE_90[1].band.toLowerCase()).toContain('all-in')
    expect(SPR_TABLE_90[2].band.toLowerCase()).not.toContain('all-in')
    expect(SPR_TABLE_90[3].band.toLowerCase()).not.toContain('all-in')
  })
})

describe('MISCONCEPTION_BY_CONCEPT_ID — every Lesson 1-5 concept_id used by this phase has a traceability entry', () => {
  it.each([
    'sizing_as_action_abstraction',
    'alpha_size_dependence',
    'size_abandonment_mechanism',
    'simplification_ev_cost',
    'one_size_fits_board_caveat',
    'polarization_sizing_direction',
  ])('%s is present and non-empty', (id) => {
    expect(MISCONCEPTION_BY_CONCEPT_ID[id]).toBeTruthy()
  })
})

describe('MENTAL_MODEL_AUDIT — Lessons 1-5 each have exactly one Before/After row, referencing a real conceptId', () => {
  it('covers lessons 1 through 5, in order, no duplicates', () => {
    expect(MENTAL_MODEL_AUDIT.map((r) => r.lesson)).toEqual([1, 2, 3, 4, 5])
  })

  it('every row\'s conceptId is a real, traceable entry in MISCONCEPTION_BY_CONCEPT_ID', () => {
    for (const row of MENTAL_MODEL_AUDIT) {
      expect(MISCONCEPTION_BY_CONCEPT_ID[row.conceptId], `lesson ${row.lesson}'s conceptId "${row.conceptId}"`).toBeTruthy()
    }
  })

  it('every row has non-empty before/after text (a real, stated belief revision, not a placeholder)', () => {
    for (const row of MENTAL_MODEL_AUDIT) {
      expect(row.before.length).toBeGreaterThan(10)
      expect(row.after.length).toBeGreaterThan(10)
      expect(row.before).not.toBe(row.after)
    }
  })
})
