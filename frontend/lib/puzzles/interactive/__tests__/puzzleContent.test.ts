import { describe, expect, it } from 'vitest'
import { PUZZLES, getPuzzle } from '../data'
import { DONK_BET_654R } from '../data/donk-bet-654r'
import { SOURCES } from '../sources'
import { validatePuzzle } from '../validate'
import type { InteractivePuzzle, SourceId } from '../types'

/**
 * Content tests for shipped puzzles.
 *
 * The structural rules are already enforced at module load by
 * `assertPublishable`, so these tests mostly guard the things a schema cannot:
 * that citations point where they claim to, that the source's own scoping is
 * respected, and — most importantly — that the specific factual traps in this
 * spot stay fixed. The 654r puzzle has two of those (7♠6♠ is not a straight;
 * the famous per-category numbers are a BB vs UTG sim), and both are the kind
 * of error that would look completely plausible if it crept back in.
 */

function allSourceIds(puzzle: InteractivePuzzle): SourceId[] {
  const ids: SourceId[] = [...puzzle.headlineSources]
  puzzle.takeaways.forEach((t) => ids.push(...t.sources))
  puzzle.ranges.forEach((r) => {
    ids.push(...r.sources)
    r.unsourced?.forEach((n) => ids.push(...(n.nearestSources ?? [])))
  })
  puzzle.decisions.forEach((d) => {
    d.options.forEach((o) => ids.push(...o.sources))
    d.unsourced?.forEach((n) => ids.push(...(n.nearestSources ?? [])))
    d.theory.forEach((b) => {
      ids.push(...b.sources)
      b.bullets?.forEach((bl) => ids.push(...bl.sources))
      if (b.exhibit) ids.push(...b.exhibit.sources)
      b.unsourced?.forEach((n) => ids.push(...(n.nearestSources ?? [])))
    })
  })
  return ids
}

describe('puzzle registry', () => {
  it('publishes at least one puzzle', () => {
    expect(PUZZLES.length).toBeGreaterThan(0)
  })

  it('every puzzle passes content validation', () => {
    for (const puzzle of PUZZLES) {
      expect(validatePuzzle(puzzle), `${puzzle.id} has content errors`).toEqual([])
    }
  })

  it('slugs are unique and resolvable', () => {
    const slugs = PUZZLES.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(getPuzzle(slug)).toBeDefined()
  })

  it('every referenced source id exists', () => {
    for (const puzzle of PUZZLES) {
      for (const id of allSourceIds(puzzle)) {
        expect(SOURCES[id], `${puzzle.id} references unknown source "${id}"`).toBeDefined()
      }
    }
  })

  it('every decision offers at least three answer choices', () => {
    for (const puzzle of PUZZLES) {
      for (const decision of puzzle.decisions) {
        expect(decision.options.length, `${puzzle.id}/${decision.id}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('does not put the correct answer in the same position every time', () => {
    for (const puzzle of PUZZLES) {
      if (puzzle.decisions.length < 2) continue
      const positions = puzzle.decisions.map((d) => d.options.findIndex((o) => o.id === d.bestOptionId))
      expect(new Set(positions).size, `${puzzle.id} always answers at index ${positions[0]}`).toBeGreaterThan(1)
    }
  })
})

describe('source registry', () => {
  it('every source carries a page, a locator and a scope', () => {
    for (const [id, ref] of Object.entries(SOURCES)) {
      expect(ref.id, `${id} id mismatch`).toBe(id)
      expect(ref.page, `${id} page`).toBeGreaterThan(0)
      expect(ref.locator.trim().length, `${id} locator`).toBeGreaterThan(0)
      expect(ref.scope.trim().length, `${id} scope`).toBeGreaterThan(0)
    }
  })

  it('marks the BB vs UTG walkthrough as UTG-scoped so it cannot be read as BB vs BN', () => {
    // The single likeliest fabrication in this chapter: lifting the 77/70/61%
    // figures — which are a UTG simulation — into a button spot.
    for (const id of ['example.654r-utg-buckets', 'example.654r-utg-top-pair', 'example.654r-utg-straights']) {
      expect(SOURCES[id].scope, `${id} must name UTG in its scope`).toMatch(/UTG/)
    }
  })

  it('marks the high-donk bucket frequencies as a board-family aggregate, not a per-hand figure', () => {
    expect(SOURCES['family.high-donk-bucket-frequencies'].scope).toMatch(/not a per-hand|NOT a per-hand/i)
  })
})

describe('654r puzzle — poker content', () => {
  const puzzle = DONK_BET_654R
  const flop = puzzle.decisions.find((d) => d.street === 'flop')!

  it('is the BB vs BN 30bb spot the book states the 49%/64% ranges for', () => {
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('BN')
    expect(puzzle.setup.effectiveStackBb).toBe(30)
    expect(SOURCES['preflop.bn-open-bb-call-30bb'].quote).toContain('49% opening range')
    expect(SOURCES['preflop.bn-open-bb-call-30bb'].quote).toContain('64% GTO range')
  })

  it('deals 7♠6♠ on a 654 rainbow flop', () => {
    expect(puzzle.setup.heroCards).toEqual(['7s', '6s'])
    expect(flop.board).toEqual(['6c', '5d', '4s'])
    // Rainbow: three distinct suits on the board.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3)
  })

  it('never calls the hand a straight — it is top pair plus an open-ender', () => {
    // The source enumerates the straights on 654r as 32, 87 and 73. Calling 76
    // a straight would move it from the 'good' bucket (bet 64%) into 'strong'
    // (bet 73%) and make the whole explanation cite the wrong figure.
    const prose = [
      puzzle.description,
      flop.situation,
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ].join(' ')

    expect(prose).not.toMatch(/\byou (?:have|flop(?:ped)?) a straight\b/i)
    expect(prose).not.toMatch(/\bflops? a straight\b/i)
    expect(flop.situation).toMatch(/top pair/i)
    expect(flop.situation).toMatch(/open-ended straight draw/i)
    expect(SOURCES['example.654r-utg-straights'].quote).toContain('32')
    expect(SOURCES['example.654r-utg-straights'].quote).toContain('87')
  })

  it('answers the flop with the small lead the source prefers at this depth', () => {
    expect(flop.bestOptionId).toBe('donk-25')
    const best = flop.options.find((o) => o.id === flop.bestOptionId)!
    expect(best.label).toMatch(/25% pot/)
    // 1/4 of the book's own 5.6bb pot.
    expect(flop.potBb).toBe(5.6)
    expect(best.detail).toContain('1.4bb')
  })

  it('grades checking and the big lead as defensible rather than wrong', () => {
    // The source has good hands checking 36% of the time here and using the
    // 2/3-pot size ~5% of the time. Marking either a "mistake" would teach
    // something the book contradicts.
    expect(flop.options.find((o) => o.id === 'check')!.verdict).toBe('defensible')
    expect(flop.options.find((o) => o.id === 'donk-67')!.verdict).toBe('defensible')
  })

  it('states plainly that no exact combo frequency exists for this hand', () => {
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.some((n) => /does not provide an exact frequency/i.test(n.answer))).toBe(true)
  })

  it('offers no per-hand grid, and says why', () => {
    // The book prints BB vs BN charts at 25bb and 40bb but not 30bb, and the
    // repo's extracted chart data is 100bb-only by its own file's instruction.
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
    const preflopRanges = puzzle.ranges.filter((r) => r.kind === 'aggregate')
    expect(preflopRanges.length).toBe(2)
    expect(preflopRanges.some((r) => (r.unsourced ?? []).some((n) => /13×13|per-hand/i.test(n.question)))).toBe(true)
  })

  it('ends on the flop and explains that the source stops there', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['preflop', 'flop'])
    expect(puzzle.endsEarlyBecause).toMatch(/turn|river/i)
  })
})
