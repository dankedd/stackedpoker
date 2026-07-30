/**
 * Module 11 (Polarization & Range Construction) — source-consistency lock for
 * `module11Content.ts`, following `module10Content.test.ts`'s existing pattern:
 * every constant carries a valid source classification, and every numeric claim
 * this file's Lessons 1-5 content depends on stays internally consistent.
 */
import { describe, it, expect } from 'vitest'
import {
  CAPPED_NOT_CONDENSED_EXAMPLE,
  RANGE_MIRROR,
  PROTECTION_SURGERY_BOARD,
  MISCONCEPTION_BY_CONCEPT_ID,
} from '../module11Content'
import type { SourceEvidenceType } from '../types'

const VALID_TYPES: SourceEvidenceType[] = ['exact_derived', 'source_reconstructed', 'pedagogical_model']

describe('Every Module 11 content constant carries a valid, non-empty source classification', () => {
  for (const [name, entry] of Object.entries({
    CAPPED_NOT_CONDENSED_EXAMPLE,
    RANGE_MIRROR,
    PROTECTION_SURGERY_BOARD,
  })) {
    it(`${name}.source has a valid type + non-empty section`, () => {
      expect(VALID_TYPES).toContain(entry.source.type)
      expect(entry.source.section.length).toBeGreaterThan(0)
      expect(entry.source.book).toBe('Modern Poker Theory')
    })
  }
})

describe('CAPPED_NOT_CONDENSED_EXAMPLE — Ch.1 p.83 counter-example', () => {
  it('is classified exact_derived (a direct book counter-example, not a coined illustration)', () => {
    expect(CAPPED_NOT_CONDENSED_EXAMPLE.source.type).toBe('exact_derived')
  })
})

describe('RANGE_MIRROR — the frozen center range never implied to change', () => {
  it('is classified pedagogical_model — no single book-cited numeric example exists for this exact comparison', () => {
    expect(RANGE_MIRROR.source.type).toBe('pedagogical_model')
  })

  it('the SAME centerStrong % is used for both opponent comparisons (the whole pedagogical point)', () => {
    // There is only one centerStrong field, referenced by both panels — this test exists so a
    // future edit can't accidentally introduce two diverging "center range" numbers per opponent,
    // which would silently break the lesson's central claim that the range itself never changes.
    expect(RANGE_MIRROR.centerStrong).toBeGreaterThan(0)
    expect(RANGE_MIRROR.opponentA.strong).toBeLessThan(RANGE_MIRROR.centerStrong)
    expect(RANGE_MIRROR.opponentB.strong).toBeCloseTo(RANGE_MIRROR.centerStrong, -1)
  })
})

describe('PROTECTION_SURGERY_BOARD — pool entries are real, parseable hand-class notation', () => {
  it('every pool entry is a pair (len 2), or ends in "s"/"o" — so range_bucket\'s combo weighting is accurate', () => {
    for (const hand of PROTECTION_SURGERY_BOARD.pool) {
      const isPair = hand.length === 2
      const isSuitedOrOffsuit = hand.endsWith('s') || hand.endsWith('o')
      expect(isPair || isSuitedOrOffsuit, `"${hand}" is not valid hand-class notation`).toBe(true)
    }
  })

  it('strongHands is a strict subset of pool', () => {
    for (const hand of PROTECTION_SURGERY_BOARD.strongHands) {
      expect(PROTECTION_SURGERY_BOARD.pool).toContain(hand)
    }
  })

  it('naiveSplit bets every strong hand (0% checked back) — the broken starting point the lesson diagnoses', () => {
    for (const hand of PROTECTION_SURGERY_BOARD.strongHands) {
      expect(PROTECTION_SURGERY_BOARD.naiveSplit[hand]).toBe('bet')
    }
  })

  it('correctSplit checks back at least one strong hand — the protected fix', () => {
    const checkedStrong = PROTECTION_SURGERY_BOARD.strongHands.filter(
      (h) => PROTECTION_SURGERY_BOARD.correctSplit[h] === 'check',
    )
    expect(checkedStrong.length).toBeGreaterThan(0)
    expect(checkedStrong.length).toBeLessThan(PROTECTION_SURGERY_BOARD.strongHands.length)
  })

  it('min/max check-strong-share band is a sane, non-degenerate range', () => {
    expect(PROTECTION_SURGERY_BOARD.minCheckStrongShare).toBeGreaterThan(0)
    expect(PROTECTION_SURGERY_BOARD.maxCheckStrongShare).toBeLessThan(1)
    expect(PROTECTION_SURGERY_BOARD.minCheckStrongShare).toBeLessThan(PROTECTION_SURGERY_BOARD.maxCheckStrongShare)
  })
})

describe('MISCONCEPTION_BY_CONCEPT_ID — every Lesson 1-5 concept_id used by this phase has a traceability entry', () => {
  it.each([
    'informational_advantage',
    'relative_range_shape',
    'capped_vs_condensed',
    'range_composition',
    'bluff_to_value_ratio',
    'protected_checking_range',
  ])('%s is present and non-empty', (id) => {
    expect(MISCONCEPTION_BY_CONCEPT_ID[id]).toBeTruthy()
  })
})
