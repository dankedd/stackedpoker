/**
 * Regression tests for the visual↔answer binding rule (see
 * `interactionSafety.bindVisualOptions`): whenever a question shows two or
 * more visual alternatives side by side — hole-card combos, 13x13 ranges,
 * etc. — the selection control for each one must be physically attached to
 * the visual it represents, and the platform-wide anti-position-bias shuffle
 * must never be able to separate an answer from its visual.
 *
 * Bug this guards against: `card_compare` (EquityRealizationVisualizer) and
 * `range_compare` (RangeCompare) used to render a fixed-order visual row and
 * a SEPARATELY shuffled option list underneath it — the two orderings could
 * (and did) diverge, so an answer button could render under the wrong visual.
 */
import { describe, it, expect } from 'vitest'
import { bindVisualOptions, shuffleBySeed } from '../interactionSafety'
import { evaluateStepLocally } from '../evaluator'
import { LESSONS } from '../curriculum'
import type { LessonStep, StepOption } from '../types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => [
  ...l.steps,
  ...l.steps.flatMap((s) => s.remediation_ladder ?? []),
])

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

// ── 1. bindVisualOptions — unit behavior ───────────────────────────────────────

describe('bindVisualOptions', () => {
  const options: StepOption[] = [
    { id: 'a', label: 'Option A', quality: 'perfect', feedback: 'a' },
    { id: 'b', label: 'Option B', quality: 'mistake', feedback: 'b' },
  ]

  it('pairs each visual with the option its option_id names', () => {
    const visuals = [{ name: 'left', option_id: 'a' }, { name: 'right', option_id: 'b' }]
    const units = bindVisualOptions(visuals, options, 'seed-1')!
    expect(units).not.toBeNull()
    for (const { visual, option } of units) {
      if (visual.name === 'left') expect(option.id).toBe('a')
      if (visual.name === 'right') expect(option.id).toBe('b')
    }
  })

  it('shuffles visual+option as one atomic unit — the pairing survives reordering', () => {
    const visuals = [{ name: 'left', option_id: 'a' }, { name: 'right', option_id: 'b' }]
    for (const seed of ['s1', 's2', 's3', 'eqr-s7', 'l5-s12', 'zzz']) {
      const units = bindVisualOptions(visuals, options, seed)!
      for (const { visual, option } of units) {
        const expected = visual.name === 'left' ? 'a' : 'b'
        expect(option.id).toBe(expected)
      }
    }
  })

  it('returns null when any visual lacks an option_id (conceptual, non-per-visual question)', () => {
    const visuals = [{ name: 'left', option_id: 'a' }, { name: 'right' as string | undefined }]
    expect(bindVisualOptions(visuals as { option_id?: string }[], options, 'seed')).toBeNull()
  })

  it('returns null when an option_id has no matching option (authoring error, fail safe not silently mispair)', () => {
    const visuals = [{ option_id: 'a' }, { option_id: 'does-not-exist' }]
    expect(bindVisualOptions(visuals, options, 'seed')).toBeNull()
  })

  it('returns null for an empty visual or option list', () => {
    expect(bindVisualOptions([], options, 'seed')).toBeNull()
    expect(bindVisualOptions([{ option_id: 'a' }], [], 'seed')).toBeNull()
  })

  it('does not mutate the input visuals or options arrays', () => {
    const visuals = [{ option_id: 'a' }, { option_id: 'b' }]
    const visualsCopy = visuals.slice()
    const optionsCopy = options.slice()
    bindVisualOptions(visuals, options, 'some-seed')
    expect(visuals).toEqual(visualsCopy)
    expect(options).toEqual(optionsCopy)
  })

  it('the bound unit set is not position-predictable across many different seeds', () => {
    // Same distribution check as shuffleBySeed's own regression test, but through
    // the bound-pair path specifically — proves binding doesn't reintroduce a
    // fixed-position bias for the correct answer.
    const visuals = [{ option_id: 'a' }, { option_id: 'b' }]
    const positions = { 0: 0, 1: 0 }
    for (let i = 0; i < 200; i++) {
      const units = bindVisualOptions(visuals, options, `seed-${i}`)!
      const idx = units.findIndex((u) => u.option.id === 'a')
      positions[idx as 0 | 1] += 1
    }
    expect(positions[0]).toBeGreaterThan(60)
    expect(positions[1]).toBeGreaterThan(60)
  })
})

// ── 2. Curriculum audit — every bound card_compare / range_compare step is fully wired ──

const cardCompareSteps = ALL_STEPS.filter(
  (s) => s.type === 'equity_realization' && s.equity_realization_mode === 'card_compare' && s.equity_realization_hands,
)
const rangeCompareSteps = ALL_STEPS.filter((s) => s.type === 'range_compare' && s.range_compare_a && s.range_compare_b)

describe('Curriculum audit — card_compare (equity_realization_hands)', () => {
  it('sanity: fixture steps exist', () => {
    expect(cardCompareSteps.length).toBeGreaterThan(0)
  })

  it('no step declares option_id on SOME hands but not others (no partial binding)', () => {
    const offenders: string[] = []
    for (const step of cardCompareSteps) {
      const hands = step.equity_realization_hands!
      const withId = hands.filter((h) => h.option_id).length
      if (withId > 0 && withId < hands.length) offenders.push(step.id)
    }
    expect(offenders).toEqual([])
  })

  it('every declared option_id matches a real option id on the same step', () => {
    const offenders: string[] = []
    for (const step of cardCompareSteps) {
      const hands = step.equity_realization_hands!
      if (!hands.every((h) => h.option_id)) continue
      const optionIds = new Set((step.options ?? []).map((o) => o.id))
      for (const h of hands) {
        if (!optionIds.has(h.option_id!)) offenders.push(`${step.id}: option_id "${h.option_id}" has no matching option`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('a direct "which hand is X" question (eqr-s7) is bound end to end via bindVisualOptions', () => {
    const step = findStep('eqr-s7')
    const units = bindVisualOptions(step.equity_realization_hands!, step.options!, step.id)!
    expect(units).not.toBeNull()
    expect(units).toHaveLength(2)
    const suited = units.find((u) => u.option.id === 'suited')!
    const offsuit = units.find((u) => u.option.id === 'offsuit')!
    expect(suited.visual.label).toBe('A♠5♠ (suited)')
    expect(offsuit.visual.label).toBe('A♠5♦ (offsuit)')
  })
})

describe('Curriculum audit — range_compare (range_compare_a / range_compare_b)', () => {
  it('sanity: fixture steps exist', () => {
    expect(rangeCompareSteps.length).toBeGreaterThan(0)
  })

  it('no step sets option_id on only one of the two sides (no partial binding)', () => {
    const offenders: string[] = []
    for (const step of rangeCompareSteps) {
      const aHas = !!step.range_compare_a!.option_id
      const bHas = !!step.range_compare_b!.option_id
      if (aHas !== bHas) offenders.push(step.id)
    }
    expect(offenders).toEqual([])
  })

  it('every declared option_id matches a real option id on the same step', () => {
    const offenders: string[] = []
    for (const step of rangeCompareSteps) {
      const a = step.range_compare_a!
      const b = step.range_compare_b!
      if (!a.option_id || !b.option_id) continue
      const optionIds = new Set((step.options ?? []).map((o) => o.id))
      if (!optionIds.has(a.option_id)) offenders.push(`${step.id}: range_compare_a option_id "${a.option_id}" unmatched`)
      if (!optionIds.has(b.option_id)) offenders.push(`${step.id}: range_compare_b option_id "${b.option_id}" unmatched`)
    }
    expect(offenders).toEqual([])
  })

  it('a direct "which range is X" question (l5-s12) is bound end to end via bindVisualOptions', () => {
    const step = findStep('l5-s12')
    const units = bindVisualOptions([step.range_compare_a!, step.range_compare_b!], step.options!, step.id)!
    expect(units).not.toBeNull()
    const bb = units.find((u) => u.option.id === 'bb')!
    const tight = units.find((u) => u.option.id === 'tight')!
    expect(bb.visual.label).toContain('BB')
    expect(tight.visual.label).toContain('tight')
  })
})

// ── 3. Scoring is unaffected by shuffled visual/answer position ────────────────

describe('Scoring uses the correct underlying answer id, independent of visual position', () => {
  it('card_compare (eqr-s7): selecting "suited" scores perfect no matter how the pair shuffled', () => {
    const step = findStep('eqr-s7')
    const result = evaluateStepLocally(step, 'suited', 0)
    expect(result.quality).toBe('perfect')
  })

  it('card_compare (eqr-s7): selecting "offsuit" scores mistake', () => {
    const step = findStep('eqr-s7')
    const result = evaluateStepLocally(step, 'offsuit', 0)
    expect(result.quality).toBe('mistake')
  })

  it('range_compare (l5-s12): selecting "bb" (the wider range) scores perfect', () => {
    const step = findStep('l5-s12')
    const result = evaluateStepLocally(step, 'bb', 0)
    expect(result.quality).toBe('perfect')
  })

  it('range_compare (l5-s12): selecting "tight" scores mistake', () => {
    const step = findStep('l5-s12')
    const result = evaluateStepLocally(step, 'tight', 0)
    expect(result.quality).toBe('mistake')
  })
})

// ── 4. The correct answer is not position-predictable across bound questions ──

describe('Bound visual-comparison questions do not favor a fixed screen position for the correct answer', () => {
  it('across all bound card_compare + range_compare steps, the perfect option lands on both sides roughly evenly', () => {
    const positions = { 0: 0, 1: 0 }

    for (const step of cardCompareSteps) {
      const hands = step.equity_realization_hands!
      if (!hands.every((h) => h.option_id)) continue
      const units = bindVisualOptions(hands, step.options!, step.id)
      if (!units) continue
      const idx = units.findIndex((u) => u.option.quality === 'perfect')
      if (idx >= 0) positions[idx as 0 | 1] += 1
    }

    for (const step of rangeCompareSteps) {
      const a = step.range_compare_a!
      const b = step.range_compare_b!
      if (!a.option_id || !b.option_id) continue
      const units = bindVisualOptions([a, b], step.options!, step.id)
      if (!units) continue
      const idx = units.findIndex((u) => u.option.quality === 'perfect')
      if (idx >= 0) positions[idx as 0 | 1] += 1
    }

    const total = positions[0] + positions[1]
    expect(total).toBeGreaterThan(0)
    // Neither side should be a landslide (e.g. "perfect is always on the right").
    expect(positions[0]).toBeGreaterThan(0)
    expect(positions[1]).toBeGreaterThan(0)
  })
})

// ── 5. shuffleBySeed alone (the pre-fix mechanism) is confirmed NOT sufficient ──

describe('Regression: independently shuffling options can desync from a fixed-order visual row', () => {
  it('demonstrates the original bug class — shuffling options alone can reorder relative to an unshuffled visual list', () => {
    // This is exactly what the old EquityRealizationVisualizer/RangeCompare did:
    // visuals rendered in authored order, options shuffled independently.
    const visualOrder = ['suited', 'offsuit'] // authored order, never reshuffled
    const options: StepOption[] = [
      { id: 'suited', label: 'suited', quality: 'perfect', feedback: '' },
      { id: 'offsuit', label: 'offsuit', quality: 'mistake', feedback: '' },
    ]
    let foundMismatch = false
    for (let i = 0; i < 50; i++) {
      const shuffledOptions = shuffleBySeed(options, `probe-${i}`)
      if (shuffledOptions.map((o) => o.id).join(',') !== visualOrder.join(',')) {
        foundMismatch = true
        break
      }
    }
    // At least one seed reorders the options relative to the fixed visual order —
    // proving the old approach could (and did) misalign visual and answer.
    expect(foundMismatch).toBe(true)

    // bindVisualOptions never has this failure mode: the "visual order" IS the
    // option order, because they're shuffled together as one unit.
    const visuals = [{ option_id: 'suited' }, { option_id: 'offsuit' }]
    for (let i = 0; i < 50; i++) {
      const units = bindVisualOptions(visuals, options, `probe-${i}`)!
      for (const { visual, option } of units) {
        expect(visual.option_id).toBe(option.id)
      }
    }
  })
})
