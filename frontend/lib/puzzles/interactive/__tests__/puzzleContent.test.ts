import { describe, expect, it } from 'vitest'
import { PUZZLES, getPuzzle } from '../data'
import { DONK_BET_654R } from '../data/donk-bet-654r'
import { SOURCES } from '../sources'
import { validatePuzzle } from '../validate'
import { STREET_ORDER } from '../types'
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
    // 'BTN' is the label lib/replay/positions.ts#normalizePosition understands,
    // and what the Learn tables render. The book writes the seat as "BN".
    expect(puzzle.setup.villainSeat).toBe('BTN')
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
    // The displayed pot is what the action on the felt adds up to: 2.5 from the
    // button, 2.5 called, plus the folded SB's 0.5. The book prints 5.6 for this
    // spot without giving the open size behind it; the 0.1bb gap is disclosed in
    // the preflop step rather than closed by inventing a 2.55bb open.
    expect(flop.potBb).toBe(5.5)
  })

  it('never prints a bb amount on an action button', () => {
    // "CALL 2.5bb" is wrong whenever Hero has already posted: the button opens
    // TO 2.5, the blind is in for 1, and the call is 1.5. The button carries the
    // verb; the amounts live in the hand-info panel.
    for (const p of PUZZLES) {
      for (const d of p.decisions) {
        for (const o of d.options) {
          expect(o.label, `${p.id}/${d.id}: "${o.label}"`).not.toMatch(/\d\s*bb/i)
        }
      }
    }
  })

  it('computes every call amount as bet-faced minus already-invested', () => {
    for (const p of PUZZLES) {
      for (const d of p.decisions) {
        if (d.facingBetBb === undefined || d.heroInvestedBb === undefined) continue
        const expected = Math.round((d.facingBetBb - d.heroInvestedBb) * 100) / 100
        expect(d.toCallBb, `${p.id}/${d.id}`).toBe(expected)
        // And the pot must contain the bet Hero is facing.
        expect(d.potBb, `${p.id}/${d.id} pot`).toBeGreaterThanOrEqual(d.facingBetBb)
      }
    }
  })

  it('reveals the board one street at a time and never ahead of the learner', () => {
    for (const p of PUZZLES) {
      const expected = { preflop: 0, flop: 3, turn: 4, river: 5 }
      p.decisions.forEach((d, i) => {
        expect(d.board.length, `${p.id}/${d.id}`).toBe(expected[d.street])
        // Each street's board must extend the previous one, never replace it.
        if (i > 0) {
          const prev = p.decisions[i - 1].board
          expect(d.board.slice(0, prev.length), `${p.id}/${d.id} rewrites earlier cards`).toEqual(prev)
        }
      })
    }
  })

  it('never shows a history line from a street the decision has not reached', () => {
    for (const p of PUZZLES) {
      for (const d of p.decisions) {
        const reached = STREET_ORDER.slice(0, STREET_ORDER.indexOf(d.street) + 1)
        for (const line of d.history ?? []) {
          expect(reached, `${p.id}/${d.id} leaks ${line.street}`).toContain(line.street)
        }
      }
    }
  })

  it('renders on a six-handed table so the dead small blind is accounted for', () => {
    // Heads-up would drop the folded SB's 0.5 and make the pot on screen wrong.
    expect(puzzle.setup.tableSize).toBe(6)
    const preflop = puzzle.decisions.find((d) => d.street === 'preflop')!
    expect(preflop.actionBeforeHero).toContain('SB folds')
    expect(preflop.actionBeforeHero).toContain('BTN raises to 2.5bb')
    // Hero is first to act on the flop — an empty array, not an absent one.
    expect(flop.postflopAction).toEqual([])
  })

  it('discloses the 5.5 vs 5.6 pot gap rather than hiding it', () => {
    const preflop = puzzle.decisions.find((d) => d.street === 'preflop')!
    const notes = preflop.unsourced ?? []
    expect(notes.some((n) => /5\.5/.test(n.answer) && /5\.6/.test(n.answer))).toBe(true)
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

describe('BB vs BN puzzle — one preflop idea, and no more evidence than exists', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'bb-defends-wide-vs-btn')!
  const preflop = puzzle.decisions[0]

  it('is preflop only, with the reason it stops there', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['preflop'])
    expect(preflop.board).toEqual([])
    expect(puzzle.endsEarlyBecause).toMatch(/preflop/i)
  })

  it('deals a hand from a class the source names as a call, and says which class', () => {
    // The source names classes, never combos: "most suited hands, offsuit Ax,
    // connectors and broadways". A♥7♣ is chosen because "offsuit Ax" is a class
    // the book prints in words — the chart itself is an image.
    expect(puzzle.setup.heroCards).toEqual(['Ah', '7c'])
    expect(preflop.situation).toMatch(/offsuit ace/i)
    expect(SOURCES['bb100.linear-3bet'].quote).toContain('offsuit Ax')
    expect(SOURCES['bb100.linear-3bet'].quote).toContain('very linear')
  })

  it('answers Call, with folding and 3-betting both unsupported', () => {
    expect(preflop.bestOptionId).toBe('call')
    expect(preflop.options.find((o) => o.id === 'fold')!.verdict).toBe('mistake')
    expect(preflop.options.find((o) => o.id === 'three-bet')!.verdict).toBe('mistake')
    expect(SOURCES['bb100.hr82-aggregates'].quote).toContain('Call 43.4%')
  })

  it('states no frequency for the specific combo', () => {
    // The one fabrication this puzzle is exposed to: turning "offsuit Ax calls"
    // into a decimal for A7o. Only aggregates are printed; the chart is an image.
    const notes = [...(preflop.unsourced ?? []), ...preflop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /Exact combo frequency is not specified in the source/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('charges 1.5bb to call a 2.5bb open, into a 4bb pot', () => {
    expect(preflop.facingBetBb).toBe(2.5)
    expect(preflop.heroInvestedBb).toBe(1)
    expect(preflop.toCallBb).toBe(1.5)
    expect(preflop.potBb).toBe(4) // 2.5 + 1 + the folded SB's 0.5
  })

  it('discloses that the bet-sizes come from the book’s game assumptions, not these pages', () => {
    expect((preflop.unsourced ?? []).some((n) => /179-180/.test(n.answer))).toBe(true)
  })

  it('keeps the Ch.12 figures scoped to their own 20-40bb MTT-range simulations', () => {
    // p.657's "the BN's ~44% range" is the likeliest fabrication in this spot:
    // it reads exactly like the missing 100bb cash opening range and is not one.
    // p.655 states the section's dataset, so every Ch.12 ref must carry it.
    for (const id of ['position.ip-range-advantage', 'position.ip-over-realizes']) {
      expect(SOURCES[id].scope, `${id} must name its stack depths`).toMatch(/20bb\/30bb\/40bb/)
      expect(SOURCES[id].scope, `${id} must name MTT ranges`).toMatch(/MTT/)
    }
    expect(SOURCES['position.ch12-sim-scope'].quote).toContain('MTT starting ranges')
    // And the puzzle must say so where a reader would otherwise reach for it.
    const btnRange = puzzle.ranges.find((r) => r.seat === 'villain')!
    expect((btnRange.unsourced ?? []).some((n) => /44%/.test(n.answer))).toBe(true)
  })
})

describe('984 puzzle — a complete four-street hand', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'turn-donk-984')!

  it('plays all four streets', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['preflop', 'flop', 'turn', 'river'])
    // A full hand needs no "why it stopped early" note.
    expect(puzzle.endsEarlyBecause).toBeUndefined()
  })

  it('deals the turn and river as single additional cards', () => {
    const [, flop, turn, river] = puzzle.decisions
    expect(flop.board).toEqual(['9h', '8h', '4d'])
    expect(turn.board).toEqual(['9h', '8h', '4d', '5c'])
    expect(river.board).toEqual(['9h', '8h', '4d', '5c', '2c'])
  })

  it('picks the turn card the source names as the best in the deck', () => {
    expect(SOURCES['ex3.turn-best-card-is-five'].quote).toMatch(/best cards are offsuit 5s/)
    expect(SOURCES['ex3.turn-donk-best-cards'].quote).toMatch(/7, 6, 5 that complete straights/)
  })

  it('makes the straight on the turn, not the flop', () => {
    // 7s6s on 9h8h4d is an open-ender; the 5c completes 9-8-7-6-5.
    const flop = puzzle.decisions.find((d) => d.street === 'flop')!
    expect(flop.situation).toMatch(/open-ended straight draw/i)
    const turn = puzzle.decisions.find((d) => d.street === 'turn')!
    expect(turn.situation).toMatch(/9-8-7-6-5/)
  })

  it('labels the turn sizing and the river node as not solved in the source', () => {
    const turn = puzzle.decisions.find((d) => d.street === 'turn')!
    const river = puzzle.decisions.find((d) => d.street === 'river')!
    const text = (d: typeof turn) => (d.unsourced ?? []).map((n) => `${n.question} ${n.answer}`).join(' ')
    expect(text(turn)).toMatch(/bet-size|sizing/i)
    expect(text(river)).toMatch(/abstract model|model/i)
  })

  it('keeps the money consistent across streets', () => {
    const [pf, flop, turn, river] = puzzle.decisions
    expect(pf.potBb).toBe(4)       // 2.5 + 1 + 0.5
    expect(flop.potBb).toBe(9.2)   // 5.5 + UTG's 3.7
    expect(turn.potBb).toBe(12.9)  // 5.5 + 3.7 + 3.7
    expect(river.potBb).toBe(30.1) // 12.9 + 8.6 + 8.6
    // Stacks only ever shrink.
    const stacks = puzzle.decisions.map((d) => d.effectiveStackBb)
    expect(stacks).toEqual([...stacks].sort((a, b) => b - a))
  })
})
