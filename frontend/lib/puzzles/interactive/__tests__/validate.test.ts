import { describe, expect, it } from 'vitest'
import { assertPublishable, PuzzleValidationError, validatePuzzle } from '../validate'
import type { InteractivePuzzle, OptionVerdict, PuzzleDecision } from '../types'

/**
 * Validator tests.
 *
 * Each case is one way an author could ship a claim nobody can check. The
 * fixture below is deliberately valid so every test can break exactly one rule
 * and assert that rule fires — a fixture that failed several rules at once
 * would make these assertions pass for the wrong reason.
 */

const decision = (over: Partial<PuzzleDecision> = {}): PuzzleDecision => ({
  id: 'flop',
  street: 'flop',
  board: ['6c', '5d', '4s'],
  potBb: 5.6,
  effectiveStackBb: 27.5,
  situation: 'situation',
  question: 'question?',
  options: [
    { id: 'a', label: 'A', verdict: 'best', shortWhy: 'because', sources: ['donk.654r-is-highest'] },
    { id: 'b', label: 'B', verdict: 'defensible', shortWhy: 'because', sources: ['donk.654r-is-highest'] },
    { id: 'c', label: 'C', verdict: 'mistake', shortWhy: 'because', sources: ['donk.654r-is-highest'] },
  ],
  bestOptionId: 'a',
  explanation: 'explanation',
  theory: [{ id: 't', title: 'T', body: 'body', sources: ['donk.654r-is-highest'] }],
  ...over,
})

const valid = (over: Partial<InteractivePuzzle> = {}): InteractivePuzzle => ({
  id: 'fixture',
  slug: 'fixture-puzzle',
  number: 99,
  title: 'Fixture',
  topic: 'Test',
  difficulty: 'intermediate',
  description: 'desc',
  setup: {
    format: '30bb effective',
    heroSeat: 'BB',
    villainSeat: 'BN',
    heroCards: ['7s', '6s'],
    effectiveStackBb: 30,
  },
  decisions: [decision()],
  ranges: [],
  takeawayHeadline: 'headline',
  headlineSources: ['donk.654r-is-highest'],
  takeaways: [{ text: 'takeaway', sources: ['donk.654r-is-highest'] }],
  xp: 50,
  endsEarlyBecause: 'the source stops here',
  ...over,
})

describe('validatePuzzle', () => {
  it('accepts a well-formed puzzle', () => {
    expect(validatePuzzle(valid())).toEqual([])
  })

  it('rejects fewer than three answer choices', () => {
    const issues = validatePuzzle(
      valid({ decisions: [decision({ options: decision().options.slice(0, 2) })] })
    )
    expect(issues.join(' ')).toMatch(/at least 3 are required/)
  })

  it('rejects more than five answer choices', () => {
    const opts = decision().options
    const six = [...opts, ...opts].map((o, i) => ({
      ...o,
      id: `o${i}`,
      verdict: (i === 0 ? 'best' : 'mistake') as OptionVerdict,
    }))
    const issues = validatePuzzle(
      valid({ decisions: [decision({ options: six, bestOptionId: 'o0' })] })
    )
    expect(issues.join(' ')).toMatch(/at most 5/)
  })

  it('rejects a decision with no correct answer', () => {
    const options = decision().options.map((o) => ({ ...o, verdict: 'defensible' as const }))
    const issues = validatePuzzle(valid({ decisions: [decision({ options })] }))
    expect(issues.join(' ')).toMatch(/no option marked 'best'/)
  })

  it('rejects two correct answers', () => {
    const options = decision().options.map((o, i) =>
      i < 2 ? { ...o, verdict: 'best' as const } : o
    )
    const issues = validatePuzzle(valid({ decisions: [decision({ options })] }))
    expect(issues.join(' ')).toMatch(/2 options marked 'best'/)
  })

  it('rejects a bestOptionId that disagrees with the graded option', () => {
    const issues = validatePuzzle(valid({ decisions: [decision({ bestOptionId: 'b' })] }))
    expect(issues.join(' ')).toMatch(/but the option marked 'best' is "a"/)
  })

  it('rejects an option with no source reference', () => {
    const options = decision().options.map((o, i) => (i === 0 ? { ...o, sources: [] } : o))
    const issues = validatePuzzle(valid({ decisions: [decision({ options })] }))
    expect(issues.join(' ')).toMatch(/no source reference/)
  })

  it('rejects a citation to a source that does not exist', () => {
    const options = decision().options.map((o, i) =>
      i === 0 ? { ...o, sources: ['made.up.source'] } : o
    )
    const issues = validatePuzzle(valid({ decisions: [decision({ options })] }))
    expect(issues.join(' ')).toMatch(/unknown source id "made\.up\.source"/)
  })

  it('rejects an unsourced theory bullet', () => {
    const theory = [
      {
        id: 't',
        title: 'T',
        body: 'body',
        bullets: [{ text: 'a claim with no evidence', sources: [] }],
        sources: ['donk.654r-is-highest'],
      },
    ]
    const issues = validatePuzzle(valid({ decisions: [decision({ theory })] }))
    expect(issues.join(' ')).toMatch(/bullet #1: no source reference/)
  })

  it('rejects a statistic exhibit with no scope', () => {
    const theory = [
      {
        id: 't',
        title: 'T',
        body: 'body',
        exhibit: {
          caption: 'Frequencies',
          scope: '   ',
          rows: [{ label: 'Strong', value: '73%', pct: 73 }],
          sources: ['family.high-donk-bucket-frequencies'],
        },
        sources: ['donk.654r-is-highest'],
      },
    ]
    const issues = validatePuzzle(valid({ decisions: [decision({ theory })] }))
    expect(issues.join(' ')).toMatch(/empty scope/)
  })

  it('rejects an unsourced range', () => {
    const issues = validatePuzzle(
      valid({
        ranges: [
          {
            id: 'r',
            label: 'BB range',
            headline: '64%',
            kind: 'aggregate',
            seat: 'hero',
            description: 'desc',
            sources: [],
          },
        ],
      })
    )
    expect(issues.join(' ')).toMatch(/no source reference/)
  })

  it('rejects an aggregate range with no headline percentage', () => {
    const issues = validatePuzzle(
      valid({
        ranges: [
          {
            id: 'r',
            label: 'BB range',
            kind: 'aggregate',
            seat: 'hero',
            description: 'desc',
            sources: ['preflop.bn-open-bb-call-30bb'],
          },
        ],
      })
    )
    expect(issues.join(' ')).toMatch(/requires a headline percentage/)
  })

  it('rejects an unsourced takeaway', () => {
    const issues = validatePuzzle(valid({ takeaways: [{ text: 'claim', sources: [] }] }))
    expect(issues.join(' ')).toMatch(/takeaway #1: no source reference/)
  })

  it('rejects a hand that stops before the river without saying why', () => {
    const issues = validatePuzzle(valid({ endsEarlyBecause: '' }))
    expect(issues.join(' ')).toMatch(/endsEarlyBecause is empty/)
  })

  it('rejects a board that does not match its street', () => {
    const issues = validatePuzzle(valid({ decisions: [decision({ board: ['6c', '5d'] })] }))
    expect(issues.join(' ')).toMatch(/needs 3 board card\(s\), found 2/)
  })

  it('rejects streets that run backwards', () => {
    const issues = validatePuzzle(
      valid({
        decisions: [
          decision(),
          decision({ id: 'pre', street: 'preflop', board: [] }),
        ],
      })
    )
    expect(issues.join(' ')).toMatch(/goes backwards/)
  })

  it('assertPublishable throws with every issue listed', () => {
    expect(() => assertPublishable(valid({ takeaways: [] }))).toThrow(PuzzleValidationError)
  })
})
