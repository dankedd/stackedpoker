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
        if (i > 0) {
          const prev = p.decisions[i - 1]
          if (prev.street === d.street) {
            // Two decisions on the SAME street are a re-deal, not a continuing
            // hand: the puzzle holds everything fixed and varies exactly ONE
            // thing — the board ('cbet-by-top-card'), or the opener's seat
            // ('boundary-moves-by-opener', where the whole lesson is how far
            // the answer moves when only the raiser changes). Either shape has
            // to be authored as such, and the varied thing has to actually
            // differ, otherwise the puzzle is asking the same question twice.
            const boardChanged = d.board.join(',') !== prev.board.join(',')
            const openerChanged =
              (d.villainSeat ?? p.setup.villainSeat) !== (prev.villainSeat ?? p.setup.villainSeat)
            const stackChanged = d.effectiveStackBb !== prev.effectiveStackBb

            expect(
              boardChanged || openerChanged || stackChanged,
              `${p.id}/${d.id} repeats the previous board, opener and stack — the same question twice`
            ).toBe(true)

            if (boardChanged) {
              expect(
                p.comparesAlternativeBoards?.trim(),
                `${p.id}/${d.id} re-deals the board without saying so`
              ).toBeTruthy()
            }
            // An opener swap on an unchanged board is the one re-deal that is
            // invisible on the felt, so it has to be declared in words.
            if (openerChanged && !boardChanged) {
              expect(
                p.comparesAlternativeOpeners?.trim(),
                `${p.id}/${d.id} swaps the opener without saying so`
              ).toBeTruthy()
            }
          } else {
            // A later street's board must extend the previous one, never replace it.
            expect(d.board.slice(0, prev.board.length), `${p.id}/${d.id} rewrites earlier cards`).toEqual(prev.board)
          }
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

describe('J66 puzzle — one sizing idea, and 72% kept at range level', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'min-bet-paired-j66')!
  const flop = puzzle.decisions[0]

  it('is the BN vs BB 40bb spot the book works through on J♠6♥6♦', () => {
    expect(puzzle.setup.heroSeat).toBe('BTN')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(flop.board).toEqual(['Js', '6h', '6d'])
    // The board must actually be paired — the entire lesson is about that pair.
    expect(new Set(flop.board.map((c) => c[0])).size).toBe(2)
    expect(SOURCES['ex4.j66-headline'].quote).toContain('J♠6♥6♦ (40bbs)')
  })

  it('is flop-only, in position, after the big blind checks', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.postflopAction).toEqual(['BB checks'])
    // Hero is not facing a bet, so there is no call to compute.
    expect(flop.facingBetBb).toBeUndefined()
    expect(flop.potBb).toBe(5.5) // 2.5 opened + 2.5 called + the folded SB's 0.5
    expect(puzzle.endsEarlyBecause).toMatch(/flop/i)
  })

  it('answers min-bet, with the big size contradicted and the check merely defensible', () => {
    expect(flop.bestOptionId).toBe('min-bet')
    // 28% of the range checks: calling that a blunder would contradict the source.
    expect(flop.options.find((o) => o.id === 'check')!.verdict).toBe('defensible')
    // "the BN cannot use a large sizing" is as explicit as the book gets.
    expect(flop.options.find((o) => o.id === 'bet-two-thirds')!.verdict).toBe('mistake')
    expect(SOURCES['ex4.j66-cbet-72'].quote).toContain('cannot use a large sizing')
    expect(SOURCES['ex4.paired-boards-min-bet'].quote).toContain('frequently min-bet')
  })

  it('uses both sides of the range comparison the source prints', () => {
    // This spot is unusual in the chapter: the book gives BB and BN figures for
    // the same flop, and the argument only works if both are used.
    const quote = SOURCES['ex4.j66-range-comparison'].quote!
    expect(quote).toContain('14%')
    expect(quote).toContain('23%')
    expect(quote).toContain('8.9%')
    expect(quote).toContain('5%')
    const prose = [
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ].join(' ')
    for (const figure of ['14%', '23%', '8.9%', '5%', '52%', '72%']) {
      expect(prose, `the puzzle never uses ${figure}`).toContain(figure)
    }
  })

  it('never presents 72% as this hand’s frequency', () => {
    // The single likeliest fabrication in this spot: an OVERALL range c-bet
    // frequency re-read as "bet A♥Q♣ 72% of the time".
    expect(SOURCES['ex4.j66-cbet-72'].scope).toMatch(/OVERALL/)
    expect(SOURCES['ex4.j66-cbet-72'].scope).toMatch(/not the frequency of any single hand/i)
    const prose = [
      puzzle.description,
      flop.situation,
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
      ...puzzle.takeaways.map((t) => t.text),
    ].join(' ')
    expect(prose).not.toMatch(/(?:bet|c-bet)s? (?:this hand|A♥Q♣|AQ) 72%/i)
    // And it must say the distinction out loud, not merely avoid the error.
    expect(prose).toMatch(/overall/i)
    expect(prose).toMatch(/whole range|entire range/i)
  })

  it('claims no per-hand-class breakdown for the button on this board', () => {
    // p.690 prints one number for the whole range. The class breakdown that
    // exists (Table 116, pp.691-692) is out of scope, and the puzzle says so
    // rather than implying no such data exists anywhere.
    const notes = [
      ...(flop.unsourced ?? []),
      ...flop.theory.flatMap((t) => t.unsourced ?? []),
      ...puzzle.ranges.flatMap((r) => r.unsourced ?? []),
    ]
    expect(notes.some((n) => /691-692|Table 116/.test(n.answer))).toBe(true)
    expect(notes.some((n) => /per-hand|per-class|hand class/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('marks the 28% as derived arithmetic rather than a printed figure', () => {
    expect(SOURCES['ex4.j66-check-28'].derivation).toBe('exact_derived')
    expect(SOURCES['ex4.j66-cbet-72'].derivation).toBe('exact_transcription')
  })

  it('cites only p.690 and p.663', () => {
    // The hard constraint on this puzzle: two pages, no borrowing from the
    // surrounding chapter however well the numbers there would fit.
    for (const id of allSourceIds(puzzle)) {
      expect([690, 663], `${id} is p.${SOURCES[id].page}`).toContain(SOURCES[id].page)
    }
  })

  it('discloses that the preflop size is a game assumption, not from these pages', () => {
    expect((flop.unsourced ?? []).some((n) => /2\.5bb/.test(n.answer) && /assumption/i.test(n.answer))).toBe(true)
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

describe('A♥Q♦3♠ puzzle — a range result that must never be read as a hand result', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'cbet-simplify-aq3')!
  const flop = puzzle.decisions[0]

  it('is the book’s Flop Strategy Example 1, played from UTG’s seat', () => {
    expect(puzzle.setup.heroSeat).toBe('UTG')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(flop.board).toEqual(['Ah', 'Qd', '3s'])
    // Rainbow, so no flush draw is available to either range.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3)
    expect(SOURCES['aq3.example-header'].quote).toContain('A♥Q♦3♠')
    expect(SOURCES['aq3.example-header'].quote).toContain('40bb')
  })

  it('answers with the 2/3-pot bet the source says costs nothing to standardise on', () => {
    expect(flop.bestOptionId).toBe('bet-two-thirds')
    expect(flop.options.map((o) => o.label)).toEqual(['Check', 'Bet 1/3 pot', 'Bet 2/3 pot'])
    expect(SOURCES['aq3.simplification-ev'].quote).toContain('2/3-pot bet-size retains all of IP’s EV')
  })

  it('grades the small bet defensible and the check a mistake', () => {
    // 1/3-pot is a size the solver really uses, and the book's own fallback
    // advice (p.681) is to default to it when unsure — calling it a blunder
    // would contradict the source. Checking is different: p.683 says a 100%
    // c-bet at 2/3 retains ALL of IP's EV, so a checking range recovers nothing.
    expect(flop.options.find((o) => o.id === 'bet-third')!.verdict).toBe('defensible')
    expect(flop.options.find((o) => o.id === 'check')!.verdict).toBe('mistake')
    expect(SOURCES['cbet.default-third-pot'].quote).toContain('default to c-betting 1/3-')
  })

  it('never attaches the 1.07% / 6.6bb/100 figure to the hero hand', () => {
    // THE trap in this example. Both numbers measure a simplification applied
    // across IP's whole range; presenting either as "what checking/betting small
    // costs you with K♠J♠" would be a fabrication with a correct page number
    // under it. Wherever the figure appears, "range" must appear with it.
    const carriers = [
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
      ...puzzle.takeaways.map((t) => t.text),
      puzzle.takeawayHeadline,
    ]
    for (const text of carriers) {
      if (!/1\.07%|6\.6bb\/100/.test(text)) continue
      expect(text, `figure quoted without naming the range: "${text.slice(0, 80)}…"`).toMatch(
        /\brange\b|\bsimplif/i
      )
      // The hand may be named alongside the figure only to deny the link.
      if (/K♠J♠/.test(text)) {
        expect(text, `figure attached to the hero hand: "${text.slice(0, 80)}…"`).toMatch(
          /not to K♠J♠|never about K♠J♠|not the EV of/i
        )
      }
    }
    // And the source entry itself must carry the warning in its scope.
    expect(SOURCES['aq3.simplification-ev'].scope).toMatch(/ENTIRE RANGE/)
    expect(SOURCES['aq3.simplification-ev'].scope).toMatch(/NOT the EV loss of any individual hand/)
  })

  it('states plainly that no per-combo frequency exists for this flop', () => {
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /ENTIRE RANGE/.test(n.answer))).toBe(true)
    expect(notes.some((n) => /no combo-by-combo frequency/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('teaches that the overbet is used and still worth nothing', () => {
    // The point of including it: 14.45% is a frequency big enough to look like
    // evidence of value, and the source says in the same sentence that it isn't.
    const block = flop.theory.find((t) => t.id === 'used-is-not-profitable')!
    expect(block.body).toMatch(/14\.45%/)
    expect(SOURCES['aq3.simplification-ev'].quote).toContain('does not generate any extra EV')
  })

  it('keeps the two board-family aggregates out of this flop’s numbers', () => {
    // 96% is every Axx flop; 26bb/100 is every flop checked back. Both are
    // cited for direction and neither may be presented as an AQ3♠ measurement.
    expect(SOURCES['cbet.axx-96'].scope).toMatch(/ALL Axx flops/)
    expect(SOURCES['cbet.axx-96'].scope).toMatch(/not a measurement of A♥Q♦3♠/)
    expect(SOURCES['cbet.check-back-costs'].scope).toMatch(/whole Ch.12 dataset/)
    expect(SOURCES['cbet.check-back-costs'].scope).toMatch(/not a figure for A♥Q♦3♠/)
  })

  it('shows the BB range composition the source labels, and no more', () => {
    // p.726 names 70% trash and 10% weak and leaves the rest unlabelled. The
    // bars must not be topped up to 100% with an invented bucket.
    const bb = puzzle.ranges.find((r) => r.id === 'bb-range-aq3')!
    expect(bb.bars!.map((b) => b.pct)).toEqual([70, 10])
    expect((bb.unsourced ?? []).some((n) => /80%/.test(n.question))).toBe(true)
    expect(SOURCES['aq3.bb-trash-16-equity'].quote).toContain('70% trash hands and 10% weak hands')
  })

  it('is flop-only, with the pot the preflop action adds up to', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.potBb).toBe(5.5) // 2.5 open + 2.5 call + the folded SB's 0.5
    expect(flop.effectiveStackBb).toBe(37.5) // 40 less the 2.5 open
    // Hero is not facing a bet, so there is no call to mis-state.
    expect(flop.facingBetBb).toBeUndefined()
    expect(flop.postflopAction).toEqual(['BB checks'])
    expect(puzzle.endsEarlyBecause).toMatch(/turn/i)
  })
})

describe('position-flip puzzle — the book’s own modified simulation, labelled as one', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'position-flip-654r')!
  const flop = puzzle.decisions[0]

  it('is a single flop decision on 654r at 30bb, and says why it stops there', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.board).toEqual(['6c', '5d', '4s'])
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3) // rainbow
    expect(puzzle.setup.effectiveStackBb).toBe(30)
    expect(flop.potBb).toBe(5.5) // 2.5 + 2.5 + the folded SB's 0.5
    expect(puzzle.endsEarlyBecause).toMatch(/turn/i)
  })

  it('never lets the flipped solve read as a real spot', () => {
    // The single fabrication this puzzle is exposed to: a learner leaving with
    // "the button bets 654r 9.23% of the time". It is a hypothetical the book
    // builds to isolate position, and every surface has to say so.
    const prose = [
      puzzle.description,
      puzzle.setup.gameNotes ?? '',
      flop.situation,
      flop.explanation,
      ...flop.theory.map((t) => t.body),
    ].join(' ')
    expect(prose).toMatch(/modified|flip|thought experiment|hypothetical/i)
    expect(puzzle.setup.gameNotes).toMatch(/cannot happen at a table/i)
    expect(flop.situation).toMatch(/modified simulation/i)
    // And the citations carry it too, so it survives being read out of context.
    for (const id of [
      'flip.experiment-definition',
      'flip.hero-oop-with-bn-range',
      'flip.654r-oop-frequency',
      'flip.654r-oop-eqr',
    ]) {
      expect(SOURCES[id].scope, `${id} must name the modified sim`).toMatch(/MODIFIED|flipped|hypothetical/i)
    }
  })

  it('holds the range fixed and moves only the seat', () => {
    // Preflop is real — Hero opened the button — so the dealer button belongs on
    // Hero's seat. Only the flop acting order is flipped.
    expect(puzzle.setup.heroSeat).toBe('BTN')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(flop.actionBeforeHero).toContain('Hero raises to 2.5bb')
    expect(flop.actionBeforeHero).toContain('BB calls')
    // Hero first to act on the flop: an empty array, not an absent one.
    expect(flop.postflopAction).toEqual([])
    expect(flop.toCallBb).toBe(0)
    // The ranges are the ones the real preflop built, unchanged.
    const hero = puzzle.ranges.find((r) => r.id === 'hero-btn-range')!
    const villain = puzzle.ranges.find((r) => r.id === 'villain-bb-range')!
    expect(hero.headline).toBe('49%')
    expect(villain.headline).toBe('64%')
    expect(SOURCES['flip.hero-oop-with-bn-range'].quote).toContain('keep their original ranges')
  })

  it('keeps 48% and 9.23% as the same range priced twice, never as two strategies', () => {
    const exhibit = flop.theory.find((t) => t.id === 'the-experiment')!.exhibit!
    const values = exhibit.rows.map((r) => r.value)
    expect(values).toContain('48%')
    expect(values).toContain('9.23%')
    // The in-position figure is the real solve; mixing the two scopes is the
    // error this exhibit exists to prevent.
    expect(exhibit.scope).toMatch(/48%/)
    expect(exhibit.scope).toMatch(/9\.23%/)
    expect(SOURCES['position.654r-ip-cbet'].quote).toContain('48% of the time')
    expect(SOURCES['flip.654r-oop-frequency'].quote).toContain('9.23%')
    expect(SOURCES['flip.654r-oop-frequency'].scope).toMatch(/NOT how often a button c-bets/i)
  })

  it('answers Check, with the overbet defensible and the 2/3 size unsupported', () => {
    expect(flop.bestOptionId).toBe('check')
    // Betting is not deleted — it is compressed to ~9%, and when it happens the
    // book names the 125% overbet as the most used size. Grading that a mistake
    // would contradict the sentence the answer is built on.
    expect(flop.options.find((o) => o.id === 'overbet-125')!.verdict).toBe('defensible')
    expect(flop.options.find((o) => o.id === 'bet-67')!.verdict).toBe('mistake')
    expect(flop.explanation).toMatch(/9\.23%/)
    expect(flop.explanation).toMatch(/48%/)
    expect(flop.explanation).toMatch(/125%/)
    expect(SOURCES['flip.two-street-game'].quote).toContain('triple barrel')
  })

  it('states the cost of the seat in pot share, on both boards', () => {
    const exhibit = flop.theory.find((t) => t.id === 'what-position-costs')!.exhibit!
    const values = exhibit.rows.map((r) => r.value)
    expect(values).toContain('79%')
    expect(values).toContain('9.7% of the pot')
    expect(values).toContain('68.3%')
    expect(values).toContain('6.7% of the pot')
    expect(SOURCES['flip.654r-oop-eqr'].quote).toContain('from 100% to 79%')
    expect(SOURCES['flip.a76r-oop-cost'].quote).toContain('68.3%')
  })

  it('gives no per-combo frequency, and says the hand is illustrative', () => {
    // The source prints one aggregate for this node. Turning it into a figure
    // for AQo would be invented solver output.
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /The book does not say/i.test(n.answer))).toBe(true)
    expect(notes.some((n) => /no per-combo frequencies/i.test(n.answer))).toBe(true)
    expect(puzzle.setup.gameNotes).toMatch(/illustrative/i)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })
})

describe('top-card puzzle — two flops, one hand, one variable', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'cbet-by-top-card')!
  const [axx, low] = puzzle.decisions

  it('plays two flops and nothing else, and says why it stops', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop', 'flop'])
    expect(puzzle.endsEarlyBecause).toMatch(/turn|river/i)
    // The second decision is a re-deal, not a later street.
    expect(puzzle.endsEarlyBecause).toMatch(/same hand dealt a different flop/i)
  })

  it('holds everything except the board fixed', () => {
    // The whole design: if the hand, the seats, the pot or the stack moved
    // between the decisions, the learner could not attribute the change to the
    // board. Both flops are also rainbow, so suit texture is not a variable.
    expect(puzzle.setup.heroSeat).toBe('BTN')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.heroCards).toEqual(['Kc', 'Jd'])
    expect(axx.board).toEqual(['As', '8d', '3c'])
    expect(low.board).toEqual(['6s', '4d', '2c'])
    for (const d of [axx, low]) {
      expect(new Set(d.board.map((c) => c[1])).size, `${d.id} is not rainbow`).toBe(3)
      expect(d.potBb).toBe(5.5) // 2.5 open + 2.5 call + the folded SB's 0.5
      expect(d.effectiveStackBb).toBe(27.5) // 30 less the 2.5 open
      expect(d.postflopAction).toEqual(['BB checks'])
      expect(d.facingBetBb).toBeUndefined()
    }
    // And the hand misses both boards, so "my hand improved" can never be the
    // explanation for the difference.
    const heroRanks = puzzle.setup.heroCards.map((c) => c[0])
    for (const d of [axx, low]) {
      for (const card of d.board) expect(heroRanks).not.toContain(card[0])
    }
  })

  it('transcribes the top-card ranking exactly as the source prints it', () => {
    for (const fragment of ['222', '96%', '93%', '88%', '85%', '62%']) {
      expect(SOURCES['cbet.by-top-card'].quote, `missing ${fragment}`).toContain(fragment)
    }
    const table = axx.theory.find((t) => t.id === 'the-ranking')!.exhibit!
    expect(table.rows.map((r) => r.value)).toEqual(['100%', '96%', '93%', '88%', '85%', '62%'])
  })

  it('says in the flow that the figures are category averages, not this flop or this hand', () => {
    // The single likeliest misreading of this puzzle: treating 96% as the
    // frequency for A♠8♦3♣, or for K♣J♦ on it.
    expect(SOURCES['cbet.by-top-card'].scope).toMatch(/AVERAGE over every flop/)
    expect(SOURCES['cbet.by-top-card'].scope).toMatch(/not the frequency for one specific hand/i)
    const notes = puzzle.decisions.flatMap((d) => [
      ...(d.unsourced ?? []),
      ...d.theory.flatMap((t) => t.unsourced ?? []),
    ])
    expect(notes.some((n) => /does not provide an exact frequency/i.test(n.answer))).toBe(true)
    expect(notes.some((n) => /average across every flop whose highest card is a six/i.test(n.answer))).toBe(true)
  })

  it('bets both boards, and never invents a size ranking to do it', () => {
    // p.661 ranks FREQUENCY by top card and prints no sizing split, so the two
    // bet buttons carry no theory claim between them.
    expect(axx.bestOptionId).toBe('bet-small')
    expect(low.bestOptionId).toBe('bet-small')
    for (const d of [axx, low]) {
      expect(d.options.find((o) => o.id === 'bet-big')!.verdict).toBe('defensible')
    }
    const sizingNote = (axx.unsourced ?? []).find((n) => /bet small or big/i.test(n.question))!
    expect(sizingNote.answer).toMatch(/prints no sizing split/i)
    expect(SOURCES['cbet.sizes-by-stack-depth'].scope).toMatch(/not with the flop’s highest card/)
  })

  it('grades checking by what the source leaves for it on each board', () => {
    // 4% on Axx is abandoning the strategy; 38% on 6xx is a real branch of it.
    // Marking the second a mistake would contradict the book — and marking it
    // BEST would too, because 62% is still a majority.
    expect(axx.options.find((o) => o.id === 'check')!.verdict).toBe('mistake')
    expect(low.options.find((o) => o.id === 'check')!.verdict).toBe('defensible')
    expect(low.options.find((o) => o.id === 'check')!.shortWhy).toMatch(/38%/)
    expect(low.explanation).toMatch(/betting is still the majority|only just/i)
  })

  it('derives the checking share by subtraction and labels it as derived', () => {
    expect(SOURCES['cbet.check-share-derived'].derivation).toBe('exact_derived')
    expect(SOURCES['cbet.check-share-derived'].scope).toContain('100% − 96% = 4%')
    expect(SOURCES['cbet.check-share-derived'].scope).toContain('100% − 62% = 38%')
    const compare = low.theory.find((t) => t.id === 'what-actually-moved')!.exhibit!
    expect(compare.rows.map((r) => r.value)).toEqual(['96%', '4%', '62%', '38%'])
  })

  it('does not claim the top card is the best predictor of c-bet frequency', () => {
    // The book sorts the same flops several ways and never ranks the features
    // against each other, so the puzzle must not either.
    const notes = puzzle.decisions.flatMap((d) => d.theory.flatMap((t) => t.unsourced ?? []))
    const claim = notes.find((n) => /best single predictor/i.test(n.question))!
    expect(claim.answer).toMatch(/never says so/i)
    expect(SOURCES['cbet.straights-favor-bb'].quote).toContain('c-bet frequency decreases')
  })

  it('keeps the Ch.12 blend visible: 96% averages two different openers', () => {
    // Hero is the BN, and the book says UTG c-bets more often than the BN — so
    // the button's own Axx figure is not the printed 96%.
    const note = (axx.unsourced ?? []).find((n) => /button’s number/i.test(n.question))!
    expect(note.answer).toMatch(/MTT starting ranges/)
    expect(SOURCES['cbet.range-strength-drives-frequency'].quote).toMatch(/UTG’s c-bet frequency and bet-sizes are bigger/)
  })
})

describe('turn check-raise puzzle — one node, two whole-range numbers', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'turn-check-raise-all-in')!
  const turn = puzzle.decisions[0]

  it('is the turn node the book solves last on this board, and nothing else', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['turn'])
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('UTG')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(turn.board).toEqual(['9h', '8h', '4d', '2d'])
    // The earlier streets are history, never decisions.
    expect(turn.history!.some((h) => h.street === 'flop')).toBe(true)
    expect(turn.postflopAction).toEqual(['BB checks', 'UTG bets 8.6bb'])
  })

  it('answers check-raise all-in, with folding wrong and calling a real branch', () => {
    expect(turn.bestOptionId).toBe('check-raise-all-in')
    expect(turn.options.map((o) => o.id)).toEqual(['fold', 'call', 'check-raise-all-in'])
    expect(turn.options.find((o) => o.id === 'fold')!.verdict).toBe('mistake')
    // Over 40% folds and the x/c range is explicitly protected, so calling is a
    // real part of the strategy — grading it a blunder would contradict p.775.
    expect(turn.options.find((o) => o.id === 'call')!.verdict).toBe('defensible')
  })

  it('deals a semi-bluff the source names by name at the flop node it passed through', () => {
    expect(puzzle.setup.heroCards).toEqual(['Jh', 'Th'])
    expect(SOURCES['ex3.flop-combo-draws-jhth'].quote).toContain('J♥T♥')
    // And it must be described as a draw, never as a made hand.
    expect(turn.situation).toMatch(/flush draw/i)
    expect(turn.situation).toMatch(/open-ended straight draw/i)
  })

  it('states no per-combo turn frequency, and names the flop figure as the trap', () => {
    // The likeliest fabrication here: reusing the printed FLOP figure for J♥T♥
    // (x/r about 1/3) as a turn check-raise frequency. Same hand, same book,
    // different node.
    const notes = [...(turn.unsourced ?? []), ...turn.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /Exact combo frequency is not specified in the source/i.test(n.answer))).toBe(true)
    expect(notes.some((n) => /flop node/i.test(n.answer) && /third/i.test(n.answer))).toBe(true)
    expect(SOURCES['ex3.flop-combo-draws-jhth'].scope).toMatch(/FLOP node only/)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('keeps 14% and over-40% scoped as whole-range averages', () => {
    for (const id of ['ex3.turn-second-barrel-oop', 'ex3.turn-xr-all-in']) {
      expect(SOURCES[id].scope, `${id} must say the figures are whole-range`).toMatch(/WHOLE-RANGE/)
    }
    expect(SOURCES['ex3.turn-second-barrel-oop'].quote).toContain('over 40% vs a turn c-bet')
    expect(SOURCES['ex3.turn-xr-all-in'].quote).toContain('x/r the turn 14% of the time')
    expect(SOURCES['ex3.turn-xr-all-in'].quote).toContain('smaller raise size would commit too many chips')
  })

  it('shows the check-call share as a residual ceiling, not a solved frequency', () => {
    // 100 − 40 − 14 = 46, but the fold figure is "over 40%", so 46% is an upper
    // bound the book never prints. It must never be shown as a solved number.
    const range = puzzle.ranges.find((r) => r.id === 'oop-vs-second-barrel')!
    const xc = range.bars!.find((b) => b.label === 'Check-call')!
    expect(xc.note).toMatch(/residual/i)
    expect(xc.note).toMatch(/not printed/i)
    const notes = turn.theory.flatMap((t) => t.unsourced ?? [])
    expect(notes.some((n) => /ceiling/i.test(n.answer))).toBe(true)
  })

  it('labels the commitment arithmetic as ours, not the book’s', () => {
    const block = turn.theory.find((t) => t.id === 'why-the-raise-is-all-in')!
    expect(block.exhibit!.scope).toMatch(/NOT in the book/)
    expect((block.unsourced ?? []).some((n) => /raise size to compare/i.test(n.question))).toBe(true)
  })

  it('prices the raise as the whole stack, with the call correctly computed', () => {
    expect(turn.potBb).toBe(21.5) // 12.9 + UTG's 8.6 barrel
    expect(turn.facingBetBb).toBe(8.6)
    expect(turn.heroInvestedBb).toBe(0)
    expect(turn.toCallBb).toBe(8.6)
    expect(turn.effectiveStackBb).toBe(33.8)
    const jam = turn.options.find((o) => o.id === 'check-raise-all-in')!
    expect(jam.tableAction).toEqual({ label: 'All-in', betBb: 33.8 })
  })

  it('never extends to the river, and says the source stops there', () => {
    expect(puzzle.endsEarlyBecause).toMatch(/no printed river strategy/i)
    const prose = [
      puzzle.description,
      turn.situation,
      turn.explanation,
      ...turn.options.map((o) => o.shortWhy),
      ...turn.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
      ...puzzle.takeaways.map((t) => t.text),
    ].join(' ')
    expect(prose).not.toMatch(/\bthe river (?:is|comes|brings)\b/i)
  })
})

describe('25bb four-branch puzzle — the jam is a branch, not a panic', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'bb-four-defences-25bb')!
  const preflop = puzzle.decisions[0]

  it('is one preflop decision at 25bb, BB vs BTN, with the reason it stops there', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['preflop'])
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('BTN')
    expect(puzzle.setup.effectiveStackBb).toBe(25)
    expect(preflop.board).toEqual([])
    expect(puzzle.endsEarlyBecause).toMatch(/preflop/i)
  })

  it('offers all four branches the source prints, and answers with the jam', () => {
    // The whole point of the puzzle: at 25bb "3-bet" and "all-in" are two
    // different actions with two different frequencies. A three-option version
    // of this decision would teach the opposite of what p.386 says.
    expect(preflop.options.map((o) => o.id)).toEqual(['fold', 'call', 'three-bet', 'all-in'])
    expect(preflop.bestOptionId).toBe('all-in')
    expect(preflop.options.find((o) => o.id === 'all-in')!.tableAction).toEqual({
      label: 'All-in',
      betBb: 25,
    })
    expect(SOURCES['preflop.bb-vs-bn-25bb-chart'].quote).toContain('All-in 11.4%')
    expect(SOURCES['preflop.bb-vs-bn-25bb-chart'].quote).toContain('3-bet 8.2%')
  })

  it('never adds the two raising branches into one number', () => {
    // 8.2 + 11.4 = 19.6, a figure the book does not print and which would erase
    // the distinction these two pages exist to draw.
    const prose = [
      puzzle.description,
      preflop.situation,
      preflop.explanation,
      ...preflop.options.map((o) => o.shortWhy),
      ...preflop.theory.flatMap((t) => [
        t.body,
        ...(t.bullets ?? []).map((b) => b.text),
        ...(t.exhibit?.rows ?? []).map((r) => `${r.label} ${r.value}`),
      ]),
      ...puzzle.ranges.map((r) => r.description),
      ...puzzle.takeaways.map((t) => t.text),
    ].join(' ')
    expect(prose).not.toMatch(/19\.6/)
    // And the four branches stay four bars, never three.
    const composition = puzzle.ranges.find((r) => r.kind === 'composition')!
    expect(composition.bars!.map((b) => b.pct).sort((a, b) => b - a)).toEqual([65.9, 14.6, 11.4, 8.2])
  })

  it('deals a hand from the class the source names for the all-in, and says which class', () => {
    // The source names classes, never combos: "Pocket pairs and Axo really like
    // getting all-in." A middle pair is chosen because it is in that class and
    // in none of the four groups the non-all-in 3-bet is made of.
    expect(puzzle.setup.heroCards).toEqual(['8s', '8d'])
    expect(preflop.situation).toMatch(/pocket pair/i)
    expect(SOURCES['bb25.pairs-and-axo-jam'].quote).toContain('Pocket pairs and Axo really like getting all-in')
    expect(SOURCES['preflop.bb-3bet-composition-25bb'].quote).toContain('JJ+')
  })

  it('states no frequency for the specific combo', () => {
    const notes = [...(preflop.unsourced ?? []), ...preflop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /Exact combo frequency is not specified in the source/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('claims no sizing for the non-all-in 3-bet, on the felt or anywhere else', () => {
    const threeBet = preflop.options.find((o) => o.id === 'three-bet')!
    expect(threeBet.tableAction?.betBb).toBeUndefined()
    const notes = [...(preflop.unsourced ?? []), ...puzzle.ranges.flatMap((r) => r.unsourced ?? [])]
    expect(notes.some((n) => /size/i.test(n.question) || /size/i.test(n.answer))).toBe(true)
  })

  it('charges 1bb to call a 2bb min-raise, into a pot that contains the antes', () => {
    expect(preflop.facingBetBb).toBe(2)
    expect(preflop.heroInvestedBb).toBe(1)
    expect(preflop.toCallBb).toBe(1)
    // 2 (button) + 1 (posted blind) + 0.5 (folded SB) + 9 × 0.125 (antes).
    expect(puzzle.setup.tableSize).toBe(9)
    expect(puzzle.setup.anteBb).toBe(0.125)
    expect(preflop.potBb).toBe(4.625)
    expect(preflop.potBb).toBe(2 + 1 + 0.5 + puzzle.setup.anteBb! * puzzle.setup.tableSize)
  })

  it('discloses that the ante comes from Ch.7, not from the defence chapter', () => {
    expect((preflop.unsourced ?? []).some((n) => /293/.test(n.answer))).toBe(true)
    expect(SOURCES['mtt.solver-environment'].quote).toContain('9-max tables with a 12.5% ante')
    expect(SOURCES['mtt.solver-environment'].scope).toMatch(/Ch\.8|defence chapter/i)
  })

  it('imports no figure from another stack depth', () => {
    // Ch.8 solves 15bb, 25bb, 40bb and 60bb separately. The 15bb BB vs BN chart
    // one page earlier (All-in 18% / Call 58.2% / Fold 23.8%) has no non-all-in
    // 3-bet branch at all, so borrowing from it would delete this puzzle's idea.
    for (const id of allSourceIds(puzzle)) {
      const ref = SOURCES[id]
      if (ref.page === 293 || ref.page === 163 || ref.page === 360) continue // game setup, not strategy
      expect(ref.page, `${id} is outside the 25bb section`).toBeGreaterThanOrEqual(386)
      expect(ref.page, `${id} is outside the 25bb section`).toBeLessThanOrEqual(387)
    }
    expect(SOURCES['defence.chapter-depths'].quote).toContain('15bb, 25bb, 40bb and 60bb')
  })
})

describe('A76r puzzle — the mirror of 654r, and the numbers that must not swap places', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'no-donk-a76r')!
  const flop = puzzle.decisions[0]
  const prose = [
    puzzle.description,
    puzzle.takeawayHeadline,
    ...puzzle.takeaways.map((t) => t.text),
    flop.situation,
    flop.explanation,
    ...flop.options.map((o) => o.shortWhy),
    ...flop.theory.flatMap((t) => [
      t.body,
      ...(t.bullets ?? []).map((b) => b.text),
      ...(t.exhibit?.rows ?? []).map((r) => `${r.label} ${r.value} ${r.note ?? ''}`),
    ]),
  ]

  it('is the same BB vs BN 30bb configuration as puzzle 1, on the opposite flop', () => {
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('BTN')
    expect(puzzle.setup.effectiveStackBb).toBe(30)
    expect(flop.board).toEqual(['Ad', '7c', '6s'])
    // Rainbow, and Hero's hearts are the fourth suit — no flush draw to reason about.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3)
    expect(puzzle.setup.heroCards).toEqual(['Ah', '5h'])
    expect(flop.board.some((c) => c[1] === 'h')).toBe(false)
  })

  it('is a flop-only puzzle with Hero first to act and nothing to call', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.postflopAction).toEqual([])
    expect(flop.toCallBb).toBe(0)
    expect(flop.potBb).toBe(5.5) // 2.5 + 2.5 + the folded SB's 0.5
    expect(puzzle.endsEarlyBecause).toMatch(/turn|river/i)
  })

  it('answers Check, with both lead sizes graded as mistakes', () => {
    // The opposite grading to the 654r puzzle, and deliberately so: there,
    // checking is a real minority branch. Here the source recommends a 100%
    // checking frequency, so a lead is contradicted rather than merely rarer.
    expect(flop.bestOptionId).toBe('check')
    expect(flop.options[0].id).toBe('check')
    expect(flop.options.find((o) => o.id === 'donk-25')!.verdict).toBe('mistake')
    expect(flop.options.find((o) => o.id === 'donk-67')!.verdict).toBe('mistake')
    expect(SOURCES['a76r.check-100'].quote).toContain('simply check 100% on A76r')
  })

  it('labels the 0.3% as the cross-simulation average it is, wherever it appears', () => {
    // p.632's 0.3% is an average over BB vs BN and BB vs UTG at 20/30/40bb — the
    // same aggregate that prints 654r at 67%. Presented bare next to a BB vs BN
    // spot it would read as this flop's own frequency, which is the 0.4% on p.650.
    const mentions = prose.filter((s) => s.includes('0.3%'))
    expect(mentions.length).toBeGreaterThan(0)
    for (const m of mentions) expect(m, `unlabelled 0.3%: "${m}"`).toMatch(/average/i)
    expect(SOURCES['donk.654r-is-highest'].scope).toMatch(/Average across the BB vs BN and BB vs UTG/i)
    expect(SOURCES['a76r.donk-option-worthless'].quote).toContain('0.4%')
    expect(SOURCES['a76r.donk-option-worthless'].page).toBe(650)
  })

  it('states no per-combo frequency for the hero hand', () => {
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /Exact combo frequency is not specified in the source/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('keeps the 31%-vs-8% strong-hand gap as the centre of the explanation', () => {
    expect(SOURCES['a76r.buckets'].quote).toContain('8% strong hands and IP has a staggering 31%')
    const rangeBlock = flop.theory.find((t) => t.id === 'whose-board-is-this')!
    const rows = rangeBlock.exhibit!.rows
    expect(rows.find((r) => r.label.includes('BN strong'))!.value).toBe('31%')
    expect(rows.find((r) => r.label.includes('BB strong'))!.value).toBe('8%')
  })

  it('scopes the 53% raise frequency to the 1/4-pot lead it was measured against', () => {
    expect(SOURCES['donk.654r-ip-raise-frequency'].quote).toContain('1/4-pot')
    for (const s of prose.filter((s) => s.includes('53%'))) {
      expect(s, `unscoped 53%: "${s}"`).toMatch(/1\/4-pot|quarter/i)
    }
    // And no raise frequency is invented for the bigger size the book didn't test here.
    const notes = flop.theory.flatMap((t) => t.unsourced ?? [])
    expect(notes.some((n) => /2\/3-pot raise frequency/i.test(n.question))).toBe(true)
  })

  it('discloses that Table 101’s "25 → 13" has no printed unit', () => {
    // The prose gives the figures bare; the unit is established by cross-check
    // against p.652's "25% when OOP", not assumed. Claiming "% of the pot" with
    // no note would be presenting an inference as a transcription.
    const notes = flop.theory.flatMap((t) => t.unsourced ?? [])
    expect(notes.some((n) => /unit/i.test(n.question) && /652/.test(n.answer))).toBe(true)
    expect(SOURCES['a76r.top-pair-lock-ev'].quote).toContain('reduces from 25 to 13')
    expect(SOURCES['a76r.bb-ev-share-of-pot'].quote).toContain('25% when OOP')
  })

  it('never turns the 85% into an equity figure for the hero hand', () => {
    // p.634 prints 85% for IP's top pairs against the BB's RANGE, and prints no
    // equity for the BB's own top pair on A76r. The nearest printed number, 65%,
    // is a top pair on 654 — a different flop.
    expect(SOURCES['a76r.buckets'].scope).toMatch(/against the BB’s RANGE|not the equity of any particular holding/i)
    for (const s of prose.filter((s) => s.includes('85%'))) {
      expect(s, `85% must name whose it is: "${s}"`).toMatch(/IP|button|top pair/i)
    }
    const notes = flop.theory.flatMap((t) => t.unsourced ?? [])
    expect(notes.some((n) => /A♥5♥ itself/i.test(n.question) && /does not print it/i.test(n.answer))).toBe(true)
  })

  it('cites only the A76r figures for A76r, and marks the derived bucket as derived', () => {
    // The 17% good / 49% trash are printed as the baseline of a comparison, not
    // as A76r figures in their own right — hence exact_derived, not transcription.
    expect(SOURCES['a76r.bb-good-and-trash'].derivation).toBe('exact_derived')
    const bbRange = puzzle.ranges.find((r) => r.id === 'bb-range-a76r')!
    expect(bbRange.bars!.find((b) => b.label === 'Weak')!.note).toMatch(/derived/i)
    expect(bbRange.bars!.reduce((sum, b) => sum + b.pct, 0)).toBe(100)
  })
})

describe('connected-boards puzzle — one effect, two flops, and no number', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'cbet-connected-boards')!
  const [noStraights, threeOesds] = puzzle.decisions

  const prose = (d: (typeof puzzle.decisions)[number]) =>
    [
      d.situation,
      d.question,
      d.explanation,
      ...d.options.map((o) => o.shortWhy),
      ...(d.unsourced ?? []).map((n) => `${n.question} ${n.answer}`),
      ...d.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ].join(' ')

  const allProse = [
    puzzle.description,
    puzzle.takeawayHeadline,
    ...puzzle.takeaways.map((t) => t.text),
    ...puzzle.decisions.map(prose),
  ].join(' ')

  it('compares two flops that differ by exactly one card, and says it is doing so', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop', 'flop'])
    expect(noStraights.board).toEqual(['Ks', '8h', '3d'])
    expect(threeOesds.board).toEqual(['9s', '8h', '3d'])
    const differing = noStraights.board.filter((c, i) => c !== threeOesds.board[i])
    expect(differing, 'the comparison is only controlled if one card moves').toHaveLength(1)
    expect(puzzle.comparesAlternativeBoards?.trim()).toBeTruthy()
    // Everything else really is held still — same hand, same pot, same node.
    expect(noStraights.potBb).toBe(threeOesds.potBb)
    expect(noStraights.effectiveStackBb).toBe(threeOesds.effectiveStackBb)
    expect(noStraights.postflopAction).toEqual(threeOesds.postflopAction)
  })

  it('gives BOTH boards zero flopped straights, because the OESD cut is nested inside that family', () => {
    // The likeliest corruption of this puzzle: "re-deal board 2 so it actually
    // has three straights". p.661 puts the OESD count INSIDE the zero-straight
    // flops, so that edit would break the citation it is built on. A flopped
    // straight needs all three board cards inside a five-rank window.
    const RANK = '23456789TJQKA'
    for (const board of [noStraights.board, threeOesds.board]) {
      const ranks = board.map((c) => RANK.indexOf(c[0])).sort((a, b) => a - b)
      expect(ranks[2] - ranks[0], `${board.join('')} must allow no flopped straight`).toBeGreaterThan(4)
    }
    expect(SOURCES['cbet.oesd-subcategory'].quote).toContain('Within the flops with zero possible straights')
  })

  it('enumerates the three open-enders instead of asserting a bucket the book never counted', () => {
    // The book declines to develop the OESD subcategory (p.628), so the count
    // has to be checkable on screen: J-T, T-7 and 7-6 are the only two-card
    // holdings that make four in a row with both the nine and the eight.
    for (const draw of ['J-T', 'T-7', '7-6']) {
      expect(prose(threeOesds), `the ${draw} open-ender is not shown`).toContain(draw)
    }
    expect(SOURCES['flops.oesd-subcategory-limits'].quote).toContain('only focus on the number of straights')
  })

  it('states no c-bet frequency for any straight-count bucket', () => {
    // The hard rule this puzzle is built around. The source gives a direction
    // and a diagram; a percentage next to a bucket would be invented. So the
    // only percentages allowed anywhere in this puzzle are the two bet sizes on
    // the buttons — any bare number followed by % is a frequency by default.
    const percentages = allProse.match(/\d+(?:\.\d+)?\s*%(?:\s*pot)?/g) ?? []
    for (const found of percentages) {
      expect(found, `"${found}" reads as a frequency — this puzzle states bet sizes only`).toMatch(
        /^(33|67)\s*% pot$/
      )
    }
    // And the one place the book DOES print per-bucket figures is cited without
    // a quote, so the chip UI cannot render those numbers onto the screen.
    expect(SOURCES['cbet.straight-count-figures-elsewhere'].quote).toBeUndefined()
    expect(SOURCES['cbet.straight-count-figures-elsewhere'].page).toBe(673)
  })

  it('declares its own source strength as DERIVED where the learner reads it', () => {
    expect(puzzle.description).toMatch(/DERIVED/)
    for (const d of puzzle.decisions) {
      const notes = (d.unsourced ?? []).map((n) => n.answer).join(' ')
      expect(notes, `${d.id} does not declare its grade`).toMatch(/DERIVED/)
      expect(notes).toContain('it does not print a frequency per straight-count bucket')
    }
  })

  it('moves both frequency and size when the straights appear', () => {
    // p.661 states both halves — lowest c-bet frequency AND larger bet-sizes —
    // so the puzzle has to answer small on the dry board and big on the
    // connected one, and checking has to stop being a mistake.
    expect(noStraights.bestOptionId).toBe('bet-33')
    expect(threeOesds.bestOptionId).toBe('bet-67')
    expect(noStraights.options.find((o) => o.id === 'check')!.verdict).toBe('mistake')
    expect(threeOesds.options.find((o) => o.id === 'check')!.verdict).toBe('defensible')
    expect(SOURCES['cbet.three-oesd-lowest'].quote).toContain('lowest c-bet frequency')
    expect(SOURCES['cbet.three-oesd-lowest'].quote).toContain('larger bet-sizes')
  })

  it('keeps the Ch.12 dataset boundary on the passages it leans on', () => {
    // Every figure in this section is a 20/30/40bb MTT-range aggregate (p.655),
    // so neither ref may read as a solved answer for one 30bb cash spot.
    for (const id of ['cbet.straights-favor-bb', 'cbet.three-oesd-lowest']) {
      expect(SOURCES[id].scope, `${id} must name its stack depths`).toMatch(/20bb\/30bb\/40bb/)
      expect(SOURCES[id].page).toBe(661)
    }
  })

  it('offers no range exhibit, because the claim behind it is never quantified', () => {
    // "The BB has more offsuit connectors than IP" is stated in words and given
    // no percentage anywhere in this section. An invented bar would be the
    // easiest fabrication available in this spot.
    expect(puzzle.ranges).toEqual([])
  })
})

describe('turn categories puzzle — a board read, with nothing else attached', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'turn-categories-984')!

  it('deals no hand, and says why', () => {
    // The whole point of the exercise: given two cards a learner starts working
    // out what they want to do and stops looking at what the card did.
    expect(puzzle.setup.heroCards).toEqual([])
    expect(puzzle.readsTheBoardOnly).toMatch(/classification|read/i)
  })

  it('reads three alternative turns off one two-tone flop', () => {
    const boards = puzzle.decisions.map((d) => d.board)
    for (const board of boards) expect(board.slice(0, 3)).toEqual(['9h', '8h', '4d'])
    expect(boards.map((b) => b[3])).toEqual(['9s', '2h', 'Ac'])
    // Two-tone is load-bearing: on a rainbow flop the flush group is empty and
    // the 2♥ question could not exist.
    expect(new Set(['9h', '8h', '4d'].map((c) => c[1])).size).toBe(2)
    expect(puzzle.comparesAlternativeBoards).toBeTruthy()
  })

  it('answers with the category the source prints, one per card', () => {
    const best = (id: string) => {
      const d = puzzle.decisions.find((x) => x.id === id)!
      return d.options.find((o) => o.id === d.bestOptionId)!.label
    }
    expect(best('turn-9s')).toBe('Pairs the board')
    expect(best('turn-2h')).toBe('Completes a flush')
    expect(best('turn-ac')).toBe('Ace')
  })

  it('grades "overcard" on the ace as defensible, because the groups overlap', () => {
    // The source says a turn card can be in "one or more" of the groups, and an
    // ace IS higher than top pair. Marking that a mistake would teach that the
    // categories are exclusive, which the source contradicts on the same page.
    const ace = puzzle.decisions.find((d) => d.id === 'turn-ac')!
    expect(ace.options.find((o) => o.id === 'overcard')!.verdict).toBe('defensible')
    expect(ace.options.find((o) => o.id === 'brick')!.verdict).toBe('mistake')
  })

  it('treats the low heart as a flush card rather than a brick', () => {
    // The single likeliest misread on a two-tone board, and the reason the 2♥ is
    // in the puzzle at all: rank says blank, suit says flush.
    const heart = puzzle.decisions.find((d) => d.id === 'turn-2h')!
    expect(heart.bestOptionId).toBe('flush')
    expect(heart.options.find((o) => o.id === 'brick')!.verdict).toBe('mistake')
  })

  it('attaches no frequency to any category, and says so on every decision', () => {
    for (const d of puzzle.decisions) {
      const notes = [...(d.unsourced ?? []), ...d.theory.flatMap((t) => t.unsourced ?? [])]
      expect(
        notes.some((n) => /does not attach a frequency to a category in the abstract/i.test(n.answer)),
        `${d.id} must state that no frequency exists for a category`
      ).toBe(true)
    }
    // And no option may smuggle one in through its feedback.
    const prose = puzzle.decisions
      .flatMap((d) => [d.explanation, ...d.options.map((o) => o.shortWhy)])
      .join(' ')
    expect(prose).not.toMatch(/\d+% of the time/i)
    expect(puzzle.ranges).toEqual([])
  })

  it('keeps the x/x refs off the x/b/c node measured on the same board', () => {
    // Same flop, same seats, different line — turn-donk-984 uses the x/b/c
    // figures and this puzzle uses the x/x ones. Swapping them would look
    // entirely plausible and be wrong.
    for (const id of ['turn.984-good-cards-xx', 'turn.984-worst-card-xx', 'turn.984-xx-setup']) {
      expect(SOURCES[id].scope, `${id} must name the x/x line`).toMatch(/x\/x|checked through/)
    }
    expect(SOURCES['turn.984-good-cards-xx'].quote).toContain('good turns for OOP')
    expect(SOURCES['turn.984-good-cards-xx'].quote).toContain('particularly the aces, are good for IP')
    expect(SOURCES['ex3.turn-donk-best-cards'].scope).toMatch(/x\/b\/c|c-bet and call|c-bet \/ call/)
  })

  it('cites the six groups verbatim and the "one or more" overlap', () => {
    const q = SOURCES['turn.categories'].quote!
    for (const group of ['Paired Board', 'Flush', 'Straight', 'Ace', 'Overcard', 'Brick/Blank']) {
      expect(q, `the six-group list must contain "${group}"`).toContain(group)
    }
    expect(SOURCES['turn.categories'].page).toBe(760)
    expect(SOURCES['turn.why-groups'].page).toBe(759)
    expect(SOURCES['turn.why-groups'].quote).toContain('49 possible turn cards')
    expect(SOURCES['turn.why-groups'].quote).toContain('one or more of the following groups')
    expect(SOURCES['turn.category-subdivision'].quote).toContain('backdoor flush draw')
  })

  it('stops at the reading and explains that there is nothing to play', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['turn', 'turn', 'turn'])
    expect(puzzle.endsEarlyBecause).toMatch(/no hand to play/i)
    expect(puzzle.difficulty).toBe('beginner')
  })
})

describe('862r puzzle — frequency and size are separate dials', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'big-bet-low-frequency-862')!
  const flop = puzzle.decisions[0]
  const prose = [
    puzzle.description,
    flop.situation,
    flop.explanation,
    ...flop.options.map((o) => o.shortWhy),
    ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ...puzzle.takeaways.map((t) => t.text),
  ].join(' ')

  it('is the book’s own Flop Strategy Example 5 spot', () => {
    expect(puzzle.setup.heroSeat).toBe('BTN')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(flop.board).toEqual(['8h', '6d', '2s'])
    // Rainbow: three distinct suits, so no flush or backdoor flush exists here.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3)
    expect(SOURCES['ex5.low-freq-big-size'].quote).toContain('Low c-bet % and big bet-size')
  })

  it('answers with the big size, and grades the small size as the wrong dial', () => {
    expect(flop.bestOptionId).toBe('bet-two-thirds')
    expect(flop.options.find((o) => o.id === 'bet-one-third')!.verdict).toBe('mistake')
    // Checking is the majority action for the RANGE, so it cannot be a blunder —
    // it is simply wrong for the one hand the source names as mostly c-bet.
    expect(flop.options.find((o) => o.id === 'check')!.verdict).toBe('defensible')
  })

  it('teaches both halves — big size AND low frequency — in the same breath', () => {
    expect(flop.explanation).toMatch(/big/i)
    expect(flop.explanation).toMatch(/low c-bet|frequency/i)
    // The source's own sentence carries both clauses; losing either one turns
    // this puzzle back into the single-dial instinct it exists to break.
    expect(SOURCES['ex5.range-distribution'].quote).toContain('big bet-size')
    expect(SOURCES['ex5.range-distribution'].quote).toContain('low c-bet frequency')
  })

  it('never presents 62% as this flop’s c-bet frequency', () => {
    // p.661's 62% is the 6xx CATEGORY average. 8♥6♦2♠ is an 8xx flop, and no
    // 8xx figure is printed anywhere — Diagram 44 is an image. Attaching 62%
    // to this board would be the single easiest fabrication in the chapter.
    expect(SOURCES['cbet.by-top-card'].quote).toContain('6xx being the lowest at only 62%')
    expect(SOURCES['cbet.by-top-card'].scope).toMatch(/AVERAGE over every flop/)
    expect(prose).toMatch(/8xx/)
    expect(prose).toMatch(/NOT a 6xx flop|not a 6xx flop/)
    // And the gap is named outright rather than left to inference.
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /8xx/.test(n.question + n.answer))).toBe(true)
  })

  it('says the exact check/bet split is not in the source', () => {
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /Not specified in the source/i.test(n.answer))).toBe(true)
    // No percentage may be attached to the c-bet frequency itself.
    expect(prose).not.toMatch(/c-bets? (?:this flop |the flop )?\d+(?:\.\d+)?%/i)
  })

  it('places A6 in the good bucket on the source’s authority, not ours', () => {
    expect(puzzle.setup.heroCards).toEqual(['As', '6c'])
    expect(SOURCES['ex5.middle-pair-a6'].quote).toContain('A6 and K6 are mostly c-bet')
    expect(SOURCES['eqb.definitions'].quote).toContain('greater or equal to 50% but lower than 75%')
    // "Mostly c-bet" is a direction. No invented per-combo frequency.
    expect(prose).not.toMatch(/A6 (?:is )?(?:c-)?bets? \d+%/i)
  })

  it('shows only the two frequencies the source actually prints for this board', () => {
    const bars = puzzle.ranges.find((r) => r.id === 'bn-vs-xr-862')!.bars!
    expect(bars.map((b) => b.pct)).toEqual([43, 34, 23])
    expect(puzzle.ranges.find((r) => r.id === 'bb-xr-862')!.headline).toBe('~8%')
    // The button's flop range gets no bucket split, because none is printed.
    expect(puzzle.ranges.find((r) => r.id === 'bn-flop-862')!.bars).toBeUndefined()
  })

  it('stops on the flop and says the book does too', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(puzzle.endsEarlyBecause).toMatch(/Examples 1, 2, 3 and 4/)
  })
})

describe('two-depths puzzle — the stack decides, and the 3-bet branch is genuinely absent', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'jam-3bet-or-call-by-depth')!
  const [shallow, deep] = puzzle.decisions
  const prose = [
    puzzle.description,
    ...puzzle.decisions.flatMap((d) => [
      d.situation,
      d.explanation,
      ...d.options.map((o) => o.shortWhy),
      ...d.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ]),
    ...puzzle.takeaways.map((t) => t.text),
  ].join(' ')
  const notes = puzzle.decisions.flatMap((d) => [
    ...(d.unsourced ?? []),
    ...d.theory.flatMap((t) => t.unsourced ?? []),
  ])

  it('holds everything fixed except the stack', () => {
    // The whole claim of the puzzle is that ONE variable moved. If the hand, the
    // seats, the street or the opener drifted too, it proves nothing.
    expect(puzzle.decisions).toHaveLength(2)
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['preflop', 'preflop'])
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('BTN')
    expect(puzzle.decisions.every((d) => d.villainSeat === undefined)).toBe(true)
    expect(puzzle.decisions.every((d) => d.board.length === 0)).toBe(true)
    expect(shallow.effectiveStackBb).toBe(15)
    expect(deep.effectiveStackBb).toBe(40)
  })

  it('deals a hand the source names at BOTH depths', () => {
    // 99 is not a convenient pick: p.381 puts "most pocket pairs" in the 15bb
    // jam (naming AA/KK as its exceptions), and p.395 prints 99 as the bottom
    // card of the 40bb 3-betting value range vs the BN. A hand that only one of
    // those passages reached would make one of the two answers unsourceable.
    expect(puzzle.setup.heroCards).toEqual(['9s', '9d'])
    expect(SOURCES['depth.15bb-who-jams'].quote).toContain('Most pocket pairs make great rejamming hands')
    expect(SOURCES['depth.15bb-who-jams'].quote).toContain('except AA and KK')
    expect(SOURCES['preflop.bb-3bet-value-40bb'].quote).toContain('99+, ATs+, and AJ+')
  })

  it('jams at 15bb and 3-bets at 40bb', () => {
    expect(shallow.bestOptionId).toBe('all-in-15')
    expect(deep.bestOptionId).toBe('three-bet-40')
    expect(SOURCES['depth.bb-vs-bn-15bb-chart'].quote).toContain('All-in 18%')
    expect(SOURCES['preflop.bb-vs-bn-40bb-chart'].quote).toContain('3-bet 14.1%')
  })

  it('offers a 3-bet at 15bb and answers it with the branch’s absence', () => {
    // The point of the puzzle. The 15bb chart has THREE actions; a non-all-in
    // 3-bet is not one of them, and p.381 states the reason outright. The option
    // is on screen so the learner meets the gap rather than never seeing it.
    const threeBet = shallow.options.find((o) => o.id === 'three-bet-15')!
    expect(threeBet.verdict).toBe('mistake')
    expect(SOURCES['depth.15bb-no-non-allin-3bet'].quote).toContain(
      'too shallow to have a non-all-in 3-betting range'
    )
    expect(threeBet.shortWhy).toMatch(/too shallow to have a non-all-in 3-betting range/)
    // And it must carry NO size, because the source prices no such raise here.
    expect(threeBet.tableAction?.betBb).toBeUndefined()
    expect(notes.some((n) => /What size would the 3-bet be/.test(n.question))).toBe(true)
  })

  it('never invents a 15bb non-all-in raise size anywhere in the prose', () => {
    // The single easiest fabrication in this puzzle: "3-bet to 5bb" at a depth
    // where the solution has no such branch to size.
    expect(prose).not.toMatch(/3-bets? to \d/i)
    expect(prose).not.toMatch(/raises? to [0-9.]+bb at 15/i)
  })

  it('grades the 40bb jam defensible, because 3% is a real branch', () => {
    // Stamping it "incorrect" would contradict Hand Range 167 two lines later.
    // The lesson survives on 18% → 3% without a red mark.
    expect(deep.options.find((o) => o.id === 'all-in-40')!.verdict).toBe('defensible')
    expect(SOURCES['preflop.bb-vs-bn-40bb-chart'].quote).toContain('All-in 3%')
    expect(SOURCES['bb40.no-rejam-vs-ep'].quote).toContain('too deep to 3-bet all-in')
  })

  it('names fold equity as the mechanism, with the button’s own numbers', () => {
    expect(prose).toMatch(/fold equity/i)
    expect(SOURCES['depth.bn-response-to-15bb-jam'].quote).toContain('Fold 57.4%')
    expect(SOURCES['depth.only-4bet-is-all-in'].quote).toContain('only 4-bet-size is all-in')
  })

  it('states outright that no 30bb figure exists, and interpolates nothing', () => {
    // The brief's live trap: 30bb sits between two printed charts whose 3-bet
    // branches are 8.2% and 14.1%, and a midpoint would be invented output.
    expect(notes.some((n) => /30bb/.test(n.question) && /Not specified in the source/.test(n.answer))).toBe(true)
    expect(SOURCES['defence.chapter-depths'].quote).toContain('15bb, 25bb, 40bb and 60bb')
    // No 30bb number may appear as a frequency anywhere in the puzzle.
    const everything = [prose, ...notes.map((n) => `${n.question} ${n.answer}`)].join(' ')
    expect(everything).not.toMatch(/at 30bb,? (?:the BB )?(?:3-bets|jams|calls|folds) \d/i)
  })

  it('sources both bet-sizes from the opener’s branch of the same solution', () => {
    // Ch.8's prose restates neither open size. Both come from the nodes where
    // the button answers — which is why those labels are quoted verbatim.
    expect(SOURCES['depth.bn-response-to-15bb-jam'].quote).toContain('BN 15bb (2x vs BB All-in)')
    expect(SOURCES['depth.bn-response-to-40bb-3bet'].quote).toContain('BN 40bb (2.3x vs BB 3.5x 3-bet)')
    expect(shallow.facingBetBb).toBe(2)
    expect(deep.facingBetBb).toBe(2.3)
    // 3.5x over a 2.3bb open. A 3-bet "x" multiplies the bet it faces.
    expect(deep.options.find((o) => o.id === 'three-bet-40')!.tableAction!.betBb).toBeCloseTo(8.05, 2)
    expect(notes.some((n) => /2\.3bb open and the 8\.05bb 3-bet/.test(n.question))).toBe(true)
  })

  it('prices a tournament pot, ante included', () => {
    // p.293 solves 9-max with a 12.5% ante. Dropping it would understate both
    // pots by 1.125bb and misprice the defence this puzzle is about.
    expect(puzzle.setup.tableSize).toBe(9)
    expect(puzzle.setup.anteBb).toBe(0.125)
    expect(SOURCES['mtt.solver-environment'].quote).toContain('9-max tables with a 12.5% ante')
    // 1.125 antes + 0.5 folded SB + 1 your blind + the open.
    expect(shallow.potBb).toBeCloseTo(4.625, 3)
    expect(deep.potBb).toBeCloseTo(4.925, 3)
    expect(shallow.toCallBb).toBe(1)
    expect(deep.toCallBb).toBeCloseTo(1.3, 3)
  })

  it('claims no per-combo frequency at either depth', () => {
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
    expect(notes.some((n) => /Exact combo frequency is not specified in the source/i.test(n.answer))).toBe(true)
    expect(prose).not.toMatch(/99 (?:jams|3-bets|calls) \d+(?:\.\d+)?%/i)
  })

  it('stops preflop and says the second decision is a fresh hand', () => {
    expect(puzzle.endsEarlyBecause).toMatch(/preflop/i)
    expect(puzzle.endsEarlyBecause).toMatch(/fresh hand|not a continuation/i)
  })
})

describe('MDF puzzle — arithmetic about a bet, not advice about a range', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'mdf-arithmetic-aq3r')!
  const flop = puzzle.decisions[0]
  const prose = [
    puzzle.description,
    puzzle.takeawayHeadline,
    ...puzzle.takeaways.map((t) => t.text),
    flop.situation,
    flop.question,
    flop.explanation,
    ...flop.options.map((o) => o.shortWhy),
    ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
  ].join(' ')

  it('is the BB vs UTG 40bb spot on AQ3r, flop only', () => {
    expect(puzzle.setup.heroSeat).toBe('BB')
    expect(puzzle.setup.villainSeat).toBe('UTG')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.board).toEqual(['Ah', 'Qd', '3s'])
    // Rainbow — which is what makes the backdoor flush draw come from the A♥.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(3)
    expect(puzzle.endsEarlyBecause).toMatch(/turn/i)
  })

  it('deals the hand the source itself names for this flop', () => {
    // p.726: "if you are holding something like a 96s with a BDFD…". The hand is
    // the book's example, not a dramatic choice — swapping it for a hand the
    // page does not name would leave the fold instruction uncited.
    expect(puzzle.setup.heroCards).toEqual(['9h', '6h'])
    expect(SOURCES['mdf.aq3r-fold-these-hands'].quote).toContain('96s with a BDFD')
    expect(SOURCES['mdf.aq3r-fold-these-hands'].quote).toContain('you should simply fold')
    expect(flop.situation).toMatch(/backdoor flush/i)
    // No pair, no straight draw: claiming either would move the hand out of the
    // trash bucket the whole argument rests on.
    expect(prose).not.toMatch(/\b(you have|you flopped) a pair\b/i)
    expect(flop.situation).toMatch(/no pair, no straight draw/i)
    // 9-6 on A-Q-3 has no straight equity at all, so no draw language of any
    // kind may creep in — a gutshot here would be a fabricated out.
    expect(prose).not.toMatch(/gutshot|open-end/i)
  })

  it('answers Fold, with calling and raising both unsupported', () => {
    expect(flop.bestOptionId).toBe('fold')
    expect(flop.options.find((o) => o.id === 'call')!.verdict).toBe('mistake')
    expect(flop.options.find((o) => o.id === 'check-raise')!.verdict).toBe('mistake')
    expect(SOURCES['mdf.aq3r-raising-worse'].quote).toContain('Raising would be even worse')
  })

  it('never calls MDF wrong arithmetic — only arithmetic about the wrong thing', () => {
    // The failure this puzzle exists to prevent is teaching that the 75% is
    // miscalculated. It is exactly right; it answers a different question.
    expect(prose).not.toMatch(/MDF is (wrong|incorrect|false)/i)
    expect(prose).not.toMatch(/(wrong|bad|faulty|broken|flawed) (arithmetic|math|maths)/i)
    expect(prose).toMatch(/arithmetic/i)
    // And the puzzle must state the 75% as correct somewhere.
    expect(prose).toMatch(/75%/)
  })

  it('derives Alpha for a 1/3-pot bet from the book’s own formula', () => {
    expect(SOURCES['mdf.alpha-definition'].quote).toContain('b/(b + p)')
    expect(SOURCES['mdf.alpha-one-third-derived'].derivation).toBe('exact_derived')
    expect(SOURCES['mdf.alpha-one-third-derived'].scope).toContain('0.33/(0.33 + 1) = 25%')
    // The book prints the resulting 75% itself, so the derivation is checkable.
    expect(SOURCES['mdf.one-third-pot-is-75'].quote).toContain('75% of the time')
    expect(SOURCES['mdf.one-third-pot-is-75'].derivation).toBe('exact_transcription')
  })

  it('cites the book’s own account of what MDF assumes', () => {
    // Without pp.602-603 the "wrong question" claim would be this file's
    // opinion. With them it is the author's stated position.
    const revisited = SOURCES['mdf.limits-ev-assumptions']
    expect(revisited.page).toBe(602)
    expect(revisited.quote).toContain('EV of checking back your hand is 0')
    expect(SOURCES['mdf.limits-rough-guide'].quote).toContain('cannot build your core strategy')
  })

  it('grounds "your range cannot supply 75%" in the printed composition', () => {
    expect(SOURCES['aq3.bb-trash-16-equity'].quote).toContain('70% trash hands and 10% weak hands')
    expect(SOURCES['aq3.bb-trash-16-equity'].quote).toContain('16% equity')
    // Trash is a definition, not a vibe: under 33% hand-vs-range equity.
    expect(SOURCES['eqb.definitions'].quote).toMatch(/Trash Hands.*lower than 33%/)
    expect(prose).toMatch(/70% trash/i)
  })

  it('shows the 42% the source prints, and scopes it to this one node', () => {
    // The opposite of the usual trap. p.726 prints MORE than expected — the
    // BB's actual defence frequency — and the risk is lifting it out of scope,
    // not omitting it. Claiming the book is silent here would be false.
    const all = [
      ...(flop.unsourced ?? []),
      ...flop.theory.flatMap((t) => t.unsourced ?? []),
      ...puzzle.ranges.flatMap((r) => r.unsourced ?? []),
    ]
    expect(all.some((n) => /42%/.test(n.answer))).toBe(true)
    expect(all.some((n) => /does not (exist|print)/i.test(n.answer))).toBe(true)
    for (const note of all.filter((n) => /42%/.test(n.answer))) {
      // Every mention must say it does not travel.
      expect(note.answer).toMatch(/one (flop|node)|this one node|1\/3-pot bet/i)
    }
    expect(SOURCES['aq3.bb-defends-42'].quote).toContain('folding 58% and defending only 42%')
    // And it must never be phrased as a rule to follow.
    expect(prose).not.toMatch(/defend 42%/i)
  })

  it('charges 1.8bb into a 7.3bb pot, the price the book quotes as 20%', () => {
    expect(flop.potBb).toBe(7.3) // 5.5 + UTG's 1.8
    expect(flop.facingBetBb).toBe(1.8)
    expect(flop.heroInvestedBb).toBe(0)
    expect(flop.toCallBb).toBe(1.8)
    expect(flop.effectiveStackBb).toBe(37.5)
    // 1.8 into a final pot of 9.1 is 19.8%; the book's 20% is the exact third.
    const odds = (flop.toCallBb! / (flop.potBb + flop.toCallBb!)) * 100
    expect(odds).toBeGreaterThan(19)
    expect(odds).toBeLessThan(21)
  })

  it('discloses the invented sizes rather than passing them off as the book’s', () => {
    const notes = (flop.unsourced ?? []).map((n) => `${n.question} ${n.answer}`).join(' ')
    expect(notes).toMatch(/implementation decision/i)
    expect(notes).toMatch(/1\.83/) // the rounding on the felt
    expect(notes).toMatch(/no raise size|prints no raise size/i)
  })
})

describe('554hh puzzle — a depolarized range, read from what the book prints', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'depolarized-range-554')!
  const flop = puzzle.decisions[0]

  it('is the book’s Flop Strategy Example 6, played from the button’s seat', () => {
    expect(puzzle.setup.heroSeat).toBe('BTN')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(flop.board).toEqual(['5h', '5d', '4h'])
    // The board must actually be paired — the texture rule depends on it.
    expect(new Set(flop.board.map((c) => c[0])).size).toBe(2)
    expect(SOURCES['ex6.example-header'].quote).toContain('5♥5♦4♥ (40bbs)')
    expect(SOURCES['ex6.example-header'].quote).toContain('Low c-bet %')
  })

  it('is flop-only, in position, after the big blind checks', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(flop.postflopAction).toEqual(['BB checks'])
    expect(flop.facingBetBb).toBeUndefined()
    expect(flop.toCallBb).toBe(0)
    expect(flop.potBb).toBe(5.5) // 2.5 opened + 2.5 called + the folded SB's 0.5
    expect(flop.effectiveStackBb).toBe(37.5) // 40 less the 2.5 open
    expect(puzzle.endsEarlyBecause).toMatch(/turn/i)
  })

  it('deals a naked gutshot, not a mid pair — the source sends those opposite ways', () => {
    // "Mid pairs 66-99 are c-bet almost 100%, ... gutshots mostly like to check
    // back" is ONE sentence (p.697). Dealing 88 and answering "check" would
    // contradict the source; dealing a gutshot is what makes the answer citable.
    expect(puzzle.setup.heroCards).toEqual(['8s', '7s'])
    expect(SOURCES['ex6.good-hands-gutshots-check'].quote).toContain('gutshots mostly like to check back')
    expect(SOURCES['ex6.good-hands-gutshots-check'].quote).toContain('Mid pairs 66-99 are c-bet almost 100%')
    // No spade on the board, so the suit carries no flush equity — Table 118
    // scores flush draws and combo draws on their own separate rows.
    expect(flop.board.some((c) => c[1] === 's')).toBe(false)
    expect(flop.situation).toMatch(/no flush equity/i)
    expect(flop.situation).toMatch(/gutshot/i)
  })

  it('places the hand in the Good bucket using the printed equity and the p.596 definition', () => {
    expect(SOURCES['ex6.table118-gutshot'].quote).toContain('Equity 58%')
    expect(SOURCES['eqb.definitions'].page).toBe(596)
    expect(flop.situation).toMatch(/58%/)
    expect(flop.situation).toMatch(/50%/)
    expect(flop.situation).toMatch(/75%/)
  })

  it('answers Check, with the min-bet a real branch and the big size contradicted', () => {
    expect(flop.bestOptionId).toBe('check')
    expect(flop.options.map((o) => o.label)).toEqual(['Check', 'Min-bet', 'Bet 2/3 pot'])
    // 21.3% of gutshots min-bet, and paired boards should frequently be
    // min-bet: grading that a blunder would contradict the source.
    expect(flop.options.find((o) => o.id === 'min-bet')!.verdict).toBe('defensible')
    // 0.4% for this class, 0.5% range-wide, and "no significant range advantage".
    expect(flop.options.find((o) => o.id === 'bet-two-thirds')!.verdict).toBe('mistake')
    expect(SOURCES['ex4.paired-boards-min-bet'].quote).toContain('frequently min-bet')
    expect(SOURCES['ex6.depolarized-distribution'].quote).toContain('doesn’t have a significant range advantage')
  })

  it('explains "depolarized" in bucket terms, with both pies from Diagram 67', () => {
    for (const fragment of ['Strong 10%', 'Good 57%', 'Weak 24%', 'Trash 9%']) {
      expect(SOURCES['ex6.bn-eqb-554'].quote, `missing ${fragment}`).toContain(fragment)
    }
    expect(SOURCES['ex6.bb-eqb-554'].quote).toContain('Trash 35%')
    expect(SOURCES['ex6.depolarized-definition'].quote).toContain('middle equity hands')
    const hero = puzzle.ranges.find((r) => r.id === 'bn-buckets-554')!
    const villain = puzzle.ranges.find((r) => r.id === 'bb-buckets-554')!
    expect(hero.bars!.map((b) => b.pct)).toEqual([10, 57, 24, 9])
    expect(villain.bars!.map((b) => b.pct)).toEqual([8, 24, 33, 35])
    // Four buckets cover the whole range: neither topped up nor trimmed.
    for (const r of [hero, villain]) {
      expect(r.bars!.reduce((sum, b) => sum + b.pct, 0)).toBe(100)
    }
  })

  it('states the sizing and frequency the source really does print', () => {
    // This spot is unusually well evidenced — two charts and a per-class table —
    // so the failure mode here is UNDER-claiming: writing "not specified in the
    // source" over figures the book prints on p.696 and p.697.
    for (const fragment of ['Check 40.6%', 'C-bet Min 22.8%', 'C-bet 1/3 35.3%', 'C-bet 2/3 0.5%']) {
      expect(SOURCES['ex6.table118-full-range'].quote, `missing ${fragment}`).toContain(fragment)
    }
    const prose = [
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
      ...puzzle.takeaways.map((t) => t.text),
    ].join(' ')
    for (const figure of ['40.6%', '22.8%', '35.3%', '52.7%', '21.3%', '57%', '58%']) {
      expect(prose, `the puzzle never uses ${figure}`).toContain(figure)
    }
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(
      notes.every((n) => !/c-bet frequency for this flop is not specified/i.test(n.answer)),
      'claims a frequency is unprinted when Table 118 prints it'
    ).toBe(true)
  })

  it('keeps every class figure at class level and never attaches one to 8♠7♠', () => {
    // THE trap in this spot: reading 52.7% as "check 8♠7♠ 52.7% of the time".
    // Table 118's rows average every gutshot combo in the range together.
    expect(SOURCES['ex6.table118-gutshot'].scope).toMatch(/GUTSHOT CLASS/)
    expect(SOURCES['ex6.table118-gutshot'].scope).toMatch(/not a frequency for one specific holding/i)
    expect(SOURCES['ex6.table118-full-range'].scope).toMatch(/ENTIRE range/i)
    expect(SOURCES['ex6.cbet-by-eqb-554'].scope).toMatch(/never a single hand/i)
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(notes.some((n) => /GUTSHOT CLASS/.test(n.answer) && /not this combo’s/.test(n.answer))).toBe(true)
    expect(notes.some((n) => /no combo-by-combo chart/i.test(n.answer))).toBe(true)
    expect(puzzle.ranges.every((r) => r.kind !== 'grid')).toBe(true)
  })

  it('discloses that Table 118 is captioned UTG inside a BB vs BN example', () => {
    for (const id of ['ex6.table118-gutshot', 'ex6.table118-full-range']) {
      expect(SOURCES[id].scope, `${id} must flag the caption`).toMatch(/caption/i)
    }
    const caption = flop.theory
      .flatMap((t) => t.unsourced ?? [])
      .find((n) => /captioned “UTG”/.test(n.question))
    expect(caption, 'no note explains the UTG caption').toBeDefined()
    // And it must say the answer survives distrusting the table entirely.
    expect(caption!.answer).toMatch(/prose gives gutshots a check-back/i)
  })

  it('discloses the places the source disagrees with itself or is silent', () => {
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    // p.697's prose says ~59% for the Good bucket; Diagram 68 sums to ~55%.
    expect(notes.some((n) => /59%/.test(n.answer) && /55%/.test(n.answer))).toBe(true)
    // 1/3-pot is the most-used bet-size here and is not one of the buttons.
    expect(notes.some((n) => /25\.2%/.test(n.answer) && /1\/3/.test(n.answer))).toBe(true)
    // And the open size is this repo's assumption, not from these pages.
    expect(notes.some((n) => /2\.5bb/.test(n.answer) && /assumption/i.test(n.answer))).toBe(true)
  })

  it('borrows no c-bet frequency from the 5XX board-family aggregate', () => {
    // Diagram 44 (p.661) prints a 5XX split, but it averages every flop with a
    // five as its top card, blended across both openers — a different
    // measurement, and another puzzle's subject. Quoting it as this flop's
    // number would be the same class of error as the UTG/BN mix-up.
    const lowNote = flop.theory
      .flatMap((t) => t.unsourced ?? [])
      .find((n) => /low.*c-bet frequency/i.test(n.question))
    expect(lowNote, 'no note defends calling the frequency low').toBeDefined()
    expect(lowNote!.answer).toMatch(/Diagram 44/)
    expect(lowNote!.answer).toMatch(/No comparison is made here/i)
  })

  it('cites only pages inside the book’s own account of this idea', () => {
    // pp.695-698 is Flop Strategy Example 6; p.663 is the texture rule it
    // instantiates; p.596 and p.78 are the two definitions it uses; p.661 and
    // p.655 appear only inside notes that decline to use their numbers; p.175 is
    // the disclosure of this repo's open-size assumption.
    for (const id of allSourceIds(puzzle)) {
      expect([78, 175, 596, 655, 661, 663, 695, 696, 697, 698], `${id} is p.${SOURCES[id].page}`).toContain(
        SOURCES[id].page
      )
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * River structure puzzle — the one chapter that solves no board at all
 *
 * Chapter 14 works in abstract models by design, so the failure mode here is
 * not a mis-scoped frequency but a fabricated one: presenting the model's
 * output as though a solver had run on 9♠6♠2♥K♠4♠. These tests pin the two
 * things that keep that impossible — the disclaimer is present in the flow,
 * and the villain's bluff share is labelled an assumption — plus the board
 * property the whole puzzle rests on, which is easy to break by editing a card.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('river structure puzzle — the model applied, never a board solved', () => {
  const puzzle = getPuzzle('the-river-is-a-structure')!
  const river = puzzle.decisions[0]
  const prose = JSON.stringify(puzzle)

  it('is a single river decision, shown after three streets of history', () => {
    expect(puzzle.decisions).toHaveLength(1)
    expect(river.street).toBe('river')
    expect(river.board).toEqual(['9s', '6s', '2h', 'Ks', '4s'])
    // Earlier streets appear as history only — never as a decision to make.
    const streets = new Set((river.history ?? []).map((h) => h.street))
    expect([...streets].sort()).toEqual(['flop', 'preflop', 'river', 'turn'])
    expect(puzzle.endsEarlyBecause).toBeUndefined()
  })

  it('deals a hand that is unambiguously a bluff-catcher on this board', () => {
    // Four spades, no pair, no possible straight, and the fourth king is the
    // board's own K♠ — so a set of kings beats every non-spade holding in the
    // deck and loses to every spade. Change any of these cards and the puzzle's
    // central claim quietly stops being true.
    expect(puzzle.setup.heroCards).toEqual(['Kh', 'Kd'])
    const board = river.board
    expect(board.filter((c) => c.endsWith('s'))).toHaveLength(4)
    const ranks = board.map((c) => c[0])
    expect(new Set(ranks).size).toBe(ranks.length) // unpaired board
    expect(ranks.sort()).toEqual(['2', '4', '6', '9', 'K']) // no five-card run reachable
    expect(river.situation).toMatch(/beats every hand in the deck that does not contain a spade/i)
  })

  it('answers Call, with folding a real branch and raising contradicted', () => {
    expect(river.bestOptionId).toBe('call')
    const verdict = (id: string) => river.options.find((o) => o.id === id)!.verdict
    expect(verdict('call')).toBe('best')
    // Folding is a third of the strategy at this size — wrong here, not absurd.
    expect(verdict('fold')).toBe('defensible')
    expect(verdict('raise')).toBe('mistake')
    // Buttons carry the action and nothing else.
    expect(river.options.map((o) => o.label)).toEqual(['Fold', 'Call', 'Raise'])
  })

  it('computes Alpha from its own pot and bet, and shows the arithmetic', () => {
    expect(river.potBb).toBe(30) // 20 already in + the 10 faced
    expect(river.facingBetBb).toBe(10)
    expect(river.heroInvestedBb).toBe(0)
    expect(river.toCallBb).toBe(10)
    const potBeforeBet = river.potBb - river.facingBetBb!
    expect(potBeforeBet).toBe(20)
    const alpha = river.facingBetBb! / (river.facingBetBb! + potBeforeBet)
    expect(alpha).toBeCloseTo(1 / 3, 5)
    // The arithmetic must be on screen, not merely true.
    expect(prose).toContain('10 / (10 + 20)')
    expect(prose).toMatch(/1-Alpha/)
    // 33/67 is exactly what the book prints for a half-pot river bet.
    expect(SOURCES['alpha.half-pot-river-example'].quote).toContain('33% (Alpha)')
    expect(SOURCES['alpha.half-pot-river-example'].quote).toContain('67% (1-Alpha)')
    expect(SOURCES['alpha.formula'].quote).toContain('b/(b + p)')
  })

  it('states plainly that the source gives a model, not a solved board', () => {
    const notes = [
      ...(river.unsourced ?? []),
      ...river.theory.flatMap((t) => t.unsourced ?? []),
      ...puzzle.ranges.flatMap((r) => r.unsourced ?? []),
    ]
    const answers = notes.map((n) => n.answer).join(' ')
    expect(answers).toContain(
      'The source gives a river model, not a solved frequency for this board. ' +
        'The reasoning here is that model applied to a matching structure.'
    )
    // And the chapter's own words for what it produces must be what backs it.
    expect(SOURCES['ch14.abstract-models-are-heuristics'].quote).toContain('generate heuristics')
    expect(SOURCES['ch14.structure-not-history'].quote).toContain('the overall same structure')
    // The teaching prose may not invoke a solver at all: the word belongs only
    // where the puzzle is denying that one ran on this board.
    const teaching = [
      river.explanation,
      ...river.options.map((o) => o.shortWhy),
      ...river.theory.flatMap((t) => [t.title, t.body, ...(t.bullets ?? []).map((b) => b.text)]),
      ...puzzle.takeaways.map((t) => t.text),
      puzzle.takeawayHeadline,
    ].join(' ')
    expect(teaching).not.toMatch(/solver/i)
    expect(answers).toMatch(/solves no real river board|No solver output exists/i)
  })

  it('labels the villain’s bluff share as an assumption rather than a source figure', () => {
    const notes = [
      ...(river.unsourced ?? []),
      ...river.theory.flatMap((t) => t.unsourced ?? []),
      ...puzzle.ranges.flatMap((r) => r.unsourced ?? []),
    ]
    const bluffNote = notes.find((n) => /how many bluffs/i.test(n.question))
    expect(bluffNote).toBeDefined()
    expect(bluffNote!.answer).toMatch(/ASSUMPTION — not from the source/)
    // The 75/25 shape is the book's figure for a BET-SIZE, and the range exhibit
    // that renders it has to say so where it is rendered.
    const range = puzzle.ranges.find((r) => r.id === 'villain-river-betting-range')!
    expect(range.bars!.map((b) => b.pct)).toEqual([75, 25])
    expect(range.description).toMatch(/ASSUMPTION/)
    expect((range.unsourced ?? []).map((n) => n.answer).join(' ')).toMatch(/from the bet-size, not from the board/i)
    // And the condition that voids the whole answer must be carried too.
    expect(SOURCES['ch14.value-range-starting-point'].quote).toContain(
      'Never call with bluff-catchers if the Villain doesn’t have enough bluffs'
    )
  })

  it('marks the "best bluff-catcher calls" step as a derivation, not a quotation', () => {
    const notes = [
      ...(river.unsourced ?? []),
      ...river.theory.flatMap((t) => t.unsourced ?? []),
      ...puzzle.ranges.flatMap((r) => r.unsourced ?? []),
    ]
    const note = notes.find((n) => /strongest bluff-catcher/i.test(n.question))
    expect(note).toBeDefined()
    expect(note!.answer).toMatch(/derivation, not a quotation|this puzzle’s reasoning/i)
    // The blocker rule it leans on is the book's, in both directions.
    expect(SOURCES['river.blockers'].quote).toContain('block the opponent’s value range, call more often')
    expect(SOURCES['river.blockers'].quote).toContain('block the opponent’s bluffing range, fold more often')
    expect(SOURCES['ch14.no-blockers-irrelevant'].quote).toContain('no blockers')
  })

  it('keeps every Chapter 14 citation scoped as an abstract model', () => {
    const ch14 = Object.values(SOURCES).filter((s) => s.id.startsWith('ch14.'))
    expect(ch14.length).toBeGreaterThan(5)
    for (const ref of ch14) {
      expect(ref.page).toBeGreaterThan(0)
      expect(ref.scope.trim().length).toBeGreaterThan(0)
      // None of them may be scoped to a real board — the chapter has none.
      expect(ref.scope).not.toMatch(/9♠6♠2♥|on this board/i)
    }
    // The model's abstract board is named where the strategy pair is quoted.
    expect(SOURCES['ch14.bluffcatcher-calls-1-alpha'].scope).toContain('2♠2♣2♥2♦3♣')
  })
})

describe('donk-bet bands puzzle — classifying a flop from the board alone', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'donk-bet-bands')!
  const [a76r, r654, m764] = puzzle.decisions

  /** Every sentence a learner can read on screen, citations excluded. */
  function prose(p: InteractivePuzzle): string {
    const parts: string[] = [p.description, p.takeawayHeadline, p.endsEarlyBecause ?? '']
    p.takeaways.forEach((t) => parts.push(t.text))
    p.ranges.forEach((r) => {
      parts.push(r.description)
      ;(r.unsourced ?? []).forEach((n) => parts.push(n.question, n.answer))
      ;(r.bars ?? []).forEach((b) => parts.push(b.label, b.note ?? ''))
    })
    p.decisions.forEach((d) => {
      parts.push(d.situation, d.question, d.explanation)
      d.options.forEach((o) => parts.push(o.label, o.shortWhy))
      ;(d.unsourced ?? []).forEach((n) => parts.push(n.question, n.answer))
      d.theory.forEach((t) => {
        parts.push(t.title, t.body)
        ;(t.bullets ?? []).forEach((b) => parts.push(b.text))
        ;(t.unsourced ?? []).forEach((n) => parts.push(n.question, n.answer))
        ;(t.exhibit?.rows ?? []).forEach((row) => parts.push(row.label, row.value, row.note ?? ''))
      })
    })
    return parts.join(' \n ')
  }

  it('deals no hand and says why, because a band is a property of the board', () => {
    expect(puzzle.setup.heroCards).toEqual([])
    expect(puzzle.readsTheBoardOnly).toMatch(/property of the board/i)
    // Three separate flops, not one hand advancing — authored, not inferred.
    expect(puzzle.comparesAlternativeBoards?.trim().length).toBeGreaterThan(0)
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop', 'flop', 'flop'])
  })

  it('uses only flops the source names individually', () => {
    // A76 rainbow: ace-high, three suits, and no five-card run holds an ace
    // alongside a 7 and a 6 — so zero flopped straights.
    expect(a76r.board).toEqual(['As', '7h', '6d'])
    expect(new Set(a76r.board.map((c) => c[1])).size).toBe(3)
    // 654 rainbow: the flop p.632 names as the highest-frequency donk bet.
    expect(r654.board).toEqual(['6s', '5d', '4c'])
    expect(new Set(r654.board.map((c) => c[1])).size).toBe(3)
    // 764 MONOTONE. The whole answer to decision 3 rests on the single suit:
    // a rainbow 764 is 7ML, which the mid AND low bands both claim, so this
    // board must never quietly acquire a second suit.
    expect(m764.board).toEqual(['7d', '6d', '4d'])
    expect(new Set(m764.board.map((c) => c[1])).size).toBe(1)
    expect(SOURCES['bands.mid-flops'].quote).toContain('The only monotone flop is 764')
  })

  it('answers None, High, Mid — in that order', () => {
    expect(a76r.bestOptionId).toBe('none')
    expect(r654.bestOptionId).toBe('high')
    expect(m764.bestOptionId).toBe('mid')
  })

  it('offers the same four bands, in the same order, at every flop', () => {
    // A classification drill that reshuffles its options tests memory of the
    // layout instead of the reading.
    for (const d of puzzle.decisions) {
      expect(d.options.map((o) => o.id)).toEqual(['high', 'mid', 'low', 'none'])
    }
  })

  it('states no per-flop donk percentage except the 67% the book prints for 654r', () => {
    // The likeliest fabrication in this spot: attaching a specific frequency to
    // an individual flop where the source only supports a band. So wherever a
    // sentence names one of these three flops AND talks about donking, the only
    // figures it may carry are the flop's BAND (a range), the 100% full-range
    // claims the book makes about A76r, and — for 654r alone — the 67% p.632
    // prints for it. A band average like "39% equity" is fine anywhere; what is
    // not fine is that average appearing beside a flop name as if it described
    // that flop.
    const namesAFlop = /\b(654r?|A76r?|764)\b/i
    let checked = 0
    for (const sentence of prose(puzzle).split(/(?<=[.;:])\s+/)) {
      if (!namesAFlop.test(sentence) || !/donk/i.test(sentence)) continue
      checked++
      const stripped = sentence
        .replace(/\b(?:0-10|10-25|25-50)%/g, '') // the three band ranges
        .replace(/\b50%\+/g, '') // the high band
        .replace(/\b(?:67|100)%/g, '') // 654r's printed figure; full-range claims
      expect(/\d{1,3}%/.test(stripped), `per-flop donk frequency: "${sentence}"`).toBe(false)
    }
    // Guard the guard: a rewrite that stopped naming the flops would make the
    // loop above pass by never running.
    expect(checked, 'no sentence names a flop while discussing donking').toBeGreaterThan(3)
    expect(SOURCES['donk.654r-is-highest'].quote).toContain('highest frequency donk betting flop is 654r (67%)')
  })

  it('declares the classification DERIVED, and says what that qualifies', () => {
    const notes = puzzle.decisions.flatMap((d) => [
      ...(d.unsourced ?? []),
      ...d.theory.flatMap((t) => t.unsourced ?? []),
    ])
    const derived = notes.find((n) => /DERIVED/.test(n.answer))
    expect(derived, 'the derivation grade must be stated in the flow').toBeDefined()
    expect(derived!.answer).toMatch(/names individually|named individually/i)
    expect(derived!.answer).toMatch(/judgement/i)
  })

  it('never marks Low correct, and explains that this is a limit of the source', () => {
    // The mid and low bands share seven unpaired subfamilies, so no individual
    // unpaired flop can be pinned to Low from the text. "Fixing" the unused
    // distractor by classifying some flop as Low would invent a classification
    // the book does not make.
    expect(puzzle.decisions.every((d) => d.bestOptionId !== 'low')).toBe(true)
    for (const family of ['8MM', '8ML', '8LL', '7ML', '7LL', '6LL', '5LL']) {
      expect(SOURCES['bands.mid-flops'].quote, `mid band must list ${family}`).toContain(family)
      expect(SOURCES['bands.low-flops'].quote, `low band must list ${family}`).toContain(family)
    }
    const text = prose(puzzle)
    expect(text).toMatch(/never the right one|never needed/i)
    expect(text).toMatch(/subfamil/i)
  })

  it('keeps board facts and simulation output in separate citation families', () => {
    // pp.625-629 describe cards and hold everywhere; pp.631-648 are one
    // aggregated simulation. Mixing them is how a board reading silently
    // acquires a stack depth and an opponent it never had.
    for (const id of ['bands.flop-rank', 'bands.flop-textures', 'bands.straight-count', 'bands.rank-letters']) {
      expect(SOURCES[id].page).toBeLessThan(631)
      expect(SOURCES[id].scope, `${id} must not claim a matchup`).not.toMatch(/BB vs|30bb|40bb/)
    }
    for (const id of ['bands.mid-frequency', 'bands.low-frequency', 'bands.none-metrics']) {
      expect(SOURCES[id].scope, `${id} must scope itself to a band, not a flop`).toMatch(/band|group|whole/i)
    }
    expect(SOURCES['bands.dataset'].quote).toContain('20bb, 30bb and 40bb')
  })

  it('labels the band-size percentages as arithmetic on printed counts', () => {
    const sizes = puzzle.ranges.find((r) => r.id === 'bands-by-size')!
    expect(Math.round(sizes.bars!.reduce((sum, b) => sum + b.pct, 0))).toBe(100)
    // 34, 100 and 181 flops out of 1,755; the fourth bar is the remainder.
    expect(sizes.bars!.map((b) => b.pct)).toEqual([82.1, 10.3, 5.7, 1.9])
    const note = (sizes.unsourced ?? [])[0]
    expect(note.answer).toMatch(/1,755/)
    expect(note.answer).toMatch(/arithmetic|derivation/i)
  })

  it('reads each flop correctly on rank, straights and texture', () => {
    expect(a76r.explanation).toMatch(/zero/i)
    expect(a76r.explanation).toContain('A-x-x')
    // 654 makes exactly the three straights the book enumerates.
    expect(r654.explanation).toContain('32, 87 and 73')
    expect(SOURCES['example.654r-utg-straights'].quote).toContain('32')
    expect(SOURCES['example.654r-utg-straights'].quote).toContain('73')
    // 764 makes two: 35 and 58. Claiming three would restore the high band's
    // description and make the monotone argument unnecessary.
    expect(m764.explanation).toContain('35 and 58')
    expect(m764.explanation).toMatch(/two flopped straights/i)
  })
})

describe('source scoping — corrections that must not regress', () => {
  it('keeps the "nut straight" OESD rule scoped to Q♥J♥T♥ vs a min-bet', () => {
    // This sentence sits between the Example 2 header (Q♥J♥T♥ vs min-bet) and the
    // Example 3 header, so it belongs to the former. The book's own continuation
    // settles it: "All 9x except 99 are folded 100%" is only coherent on Q♥J♥T♥,
    // where a nine makes a draw. On 9♥8♥4♦ a nine is top pair.
    const ref = SOURCES['qjt.oesd-nut-straight-only']
    expect(ref).toBeDefined()
    expect(ref.scope).toMatch(/Q♥J♥T♥/)
    expect(ref.scope).toMatch(/min-bet/i)
    expect(ref.scope).toMatch(/[Nn]ot 9♥8♥4♦/)
    expect(SOURCES['ex3.oesd-nut-straight-only']).toBeUndefined()
  })

  it('gives 9♥8♥4♦ its own printed open-ender rule', () => {
    const ref = SOURCES['ex3.oesd-check-call']
    expect(ref).toBeDefined()
    expect(ref.scope).toMatch(/9♥8♥4♦/)
    expect(ref.quote).toMatch(/x\/c every time/)
  })

  it('never justifies the 984 flop call with the Q♥J♥T♥ rule', () => {
    const puzzle = PUZZLES.find((p) => p.id === 'turn-donk-984')
    if (!puzzle) return
    const flop = puzzle.decisions.find((d) => d.street === 'flop')!
    const cited = flop.options.flatMap((o) => o.sources)
    expect(cited).not.toContain('qjt.oesd-nut-straight-only')
    expect(cited).toContain('ex3.oesd-check-call')
  })
})
