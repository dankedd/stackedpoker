import { describe, expect, it } from 'vitest'
import { PUZZLES } from '../data'
import { SOURCES } from '../sources'

/**
 * Content tests for the Q♥J♥T♥ puzzle.
 *
 * They live in their own file rather than in puzzleContent.test.ts because the
 * traps here are specific to this one spot and worth reading together. The
 * structural rules (citations present, exactly one best answer, board length,
 * money arithmetic) are already enforced for every puzzle by `assertPublishable`
 * at module load and by the registry suite; what follows guards the things a
 * schema cannot check.
 *
 * The central one: Modern Poker Theory prints NO c-bet frequency for this flop,
 * and two figures from a different dataset sit close enough to be mistaken for
 * one — 85% for Qxx boards by rank (p.661) and 31% CHECKED for boards with three
 * flopped straights (p.673). They contradict each other and neither describes
 * Q♥J♥T♥. Either would look entirely plausible in a claim, which is exactly why
 * the tests below insist they appear only inside the note that rejects them.
 */

describe('Q♥J♥T♥ puzzle — range advantage is not a bet-size', () => {
  const puzzle = PUZZLES.find((p) => p.id === 'range-advantage-small-bet')!
  const flop = puzzle.decisions[0]

  it('is the book’s Flop Strategy Example 2: UTG vs BB on a monotone QJT at 40bb', () => {
    expect(puzzle.setup.heroSeat).toBe('UTG')
    expect(puzzle.setup.villainSeat).toBe('BB')
    expect(puzzle.setup.effectiveStackBb).toBe(40)
    expect(flop.board).toEqual(['Qh', 'Jh', 'Th'])
    // Monotone: one suit across all three cards.
    expect(new Set(flop.board.map((c) => c[1])).size).toBe(1)
    expect(SOURCES['ex2.heading-high-freq-small-size'].quote).toBe(
      'High c-bet % and small bet-size: BB vs UTG on Q♥J♥T♥ (40bb)'
    )
    expect(SOURCES['ex2.heading-high-freq-small-size'].page).toBe(684)
  })

  it('plays one flop decision only, and says why it stops', () => {
    expect(puzzle.decisions.map((d) => d.street)).toEqual(['flop'])
    expect(puzzle.endsEarlyBecause).toMatch(/no turn or river strategy is printed/i)
  })

  it('answers the small size, with checking and the big bet both contradicted', () => {
    expect(flop.bestOptionId).toBe('min-bet')
    expect(flop.options.map((o) => o.id)).toEqual(['check', 'min-bet', 'bet-67'])
    expect(flop.options.find((o) => o.id === 'check')!.verdict).toBe('mistake')
    expect(flop.options.find((o) => o.id === 'bet-67')!.verdict).toBe('mistake')
    // Both 'mistake' grades have to be the source contradicting the action
    // rather than our preference: p.686 simplifies this flop to min-bet 100%,
    // and p.685-686 says betting big makes the BB's life easier.
    expect(SOURCES['ex2.min-bet-100-no-ev-loss'].quote).toContain('min-bet 100% with no EV loss')
    expect(SOURCES['ex2.big-bet-helps-bb'].quote).toContain('making the BB’s life easier')
    expect(SOURCES['ex2.big-bet-helps-bb'].quote).toContain('bets the minimum')
  })

  it('carries the action only on the buttons — no sizes in bb', () => {
    expect(flop.options.map((o) => o.label)).toEqual(['Check', 'Min-bet', 'Bet 2/3 pot'])
    for (const o of flop.options) expect(o.label).not.toMatch(/\d\s*bb/i)
  })

  it('states plainly that no c-bet frequency exists for this flop', () => {
    // The puzzle's central honesty claim: the book calls the frequency 'high'
    // and never prints a number for this board.
    const notes = [...(flop.unsourced ?? []), ...flop.theory.flatMap((t) => t.unsourced ?? [])]
    expect(
      notes.some((n) =>
        n.answer.includes('An exact c-bet frequency for this flop is not specified in the source.')
      )
    ).toBe(true)
  })

  it('names the 85% Qxx average only to disqualify it', () => {
    expect(SOURCES['texture.qxx-category-average'].scope).toMatch(
      /NOT the c-bet frequency for Q♥J♥T♥/
    )
    expect(SOURCES['texture.qxx-category-average'].page).toBe(661)

    const prose = [
      puzzle.description,
      flop.situation,
      flop.explanation,
      ...flop.options.map((o) => o.shortWhy),
      ...puzzle.takeaways.map((t) => t.text),
      ...flop.theory.flatMap((t) => [t.body, ...(t.bullets ?? []).map((b) => b.text)]),
    ].join(' ')
    // 85% may appear inside an unsourced note, never inside a claim.
    expect(prose).not.toMatch(/85%/)

    const notes = (flop.unsourced ?? []).map((n) => n.answer).join(' ')
    expect(notes).toMatch(/85%/)
    // And the note must carry the cut that points the other way, so the
    // aggregates are shown to be unable to settle this board either way.
    expect(notes).toMatch(/31%/)
  })

  it('claims no per-combo frequency for A♠Q♦', () => {
    expect(puzzle.setup.heroCards).toEqual(['As', 'Qd'])
    const notes = (flop.unsourced ?? []).map((n) => `${n.question} ${n.answer}`).join(' ')
    expect(notes).toMatch(/no per-combo frequency for this flop in the text/i)
    // The whole-range framing is the substitute, and it has to be visible where
    // the learner reads the answer.
    expect(flop.explanation).toMatch(/A♠Q♦ is in the range/)
  })

  it('never calls the hand a flush draw or a made straight', () => {
    // A♠Q♦ on Q♥J♥T♥ is top pair with a gutshot. It holds no heart, and the
    // Broadway straight it draws to is not the nuts on a monotone board.
    expect(flop.situation).toMatch(/top pair, top kicker/i)
    expect(flop.situation).toMatch(/gutshot/i)
    expect(flop.situation).toMatch(/no heart/i)
    const prose = [flop.situation, flop.explanation, ...flop.options.map((o) => o.shortWhy)].join(' ')
    expect(prose).not.toMatch(/flush draw|nut straight|you have a straight/i)
  })

  it('derives UTG’s equity by subtraction and labels it as derived', () => {
    // The book prints only the BB's 36% and 28%. 64% and 72% are complements,
    // and the moment they read as printed figures the citation is a lie.
    expect(SOURCES['ex2.utg-equity-derived'].derivation).toBe('exact_derived')
    expect(SOURCES['ex2.utg-equity-derived'].scope).toMatch(/sum to 100%/)
    expect(SOURCES['ex2.bb-36-equity'].quote).toContain('only 36% equity')
    expect(SOURCES['ex2.bb-36-equity'].quote).toContain('38.26%')

    const split = puzzle.ranges.find((r) => r.id === 'flop-equity-split')!
    expect(split.bars).toEqual([
      { label: 'UTG equity', pct: 64, note: 'derived from the printed 36%' },
      { label: 'BB equity', pct: 36, note: 'printed — a substantial equity disadvantage' },
    ])
  })

  it('proves the point with the contrast the book itself sets up', () => {
    // The lesson only lands if MORE range advantage goes with the BIGGER bet:
    // 72% on A♥Q♦3♠ where UTG bets big, 64% here where it bets the minimum.
    expect(SOURCES['ex1.aq3-high-freq-big-size'].quote).toContain('72% equity')
    expect(SOURCES['ex1.aq3-high-freq-big-size'].quote).toContain('capturing 85% of the pot')
    expect(SOURCES['ex1.aq3-high-freq-big-size'].scope).toMatch(
      /none of its figures describe Q♥J♥T♥/
    )

    const exhibit = flop.theory.find((t) => t.id === 'frequency-and-size')!.exhibit!
    expect(exhibit.rows.map((r) => r.value)).toEqual(['72%', '64%'])
  })

  it('discloses that the min-bet’s pot fraction depends on our own open size', () => {
    const notes = (flop.unsourced ?? []).map((n) => n.answer).join(' ')
    expect(notes).toMatch(/2\.5bb open/)
    expect(notes).toMatch(/implementation decision/)
    expect(flop.potBb).toBe(5.5) // 2.5 + 2.5 + the folded SB's 0.5
    expect(flop.options.find((o) => o.id === 'min-bet')!.tableAction).toEqual({
      label: 'Bets',
      betBb: 1,
    })
  })

  it('keeps the monotone texture refs scoped to the Ch.12 aggregate', () => {
    // p.671-673 are category averages over 20/30/40bb MTT ranges. They explain
    // the mechanism; they are not figures for this 40bb solve.
    for (const id of ['texture.monotone-most-cbet-smallest-size', 'texture.straights-reduce-cbet']) {
      expect(SOURCES[id].scope, `${id} must name its stack depths`).toMatch(/20bb\/30bb\/40bb/)
    }
    expect(SOURCES['texture.monotone-betting-big-mistake'].page).toBe(672)
  })

  it('shows the passage verbatim, with its pages', () => {
    const passage = flop.theory.find((t) => t.id === 'the-passage')!
    expect(passage.body).toContain('UTG has a substantial range advantage')
    expect(passage.body).toContain('lure the BB in with many weak hands that UTG dominates')
    expect(passage.body).toMatch(/pp\.685-686/)
  })
})
