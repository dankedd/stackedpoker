import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreflopTable, computeHeroRotatedSeats, railCenterlinePoint, DESKTOP_LAYOUT } from '../PreflopTable'

describe('PreflopTable — A. Hero UTG', () => {
  it('Hero sits bottom-center (slot 0), is labeled UTG, and no "folds to Hero" text appears', () => {
    const seats = computeHeroRotatedSeats(9, 'UTG')
    expect(seats[0].position).toBe('UTG')
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" heroHand={['Qs', 'Qd']} effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    expect(html).toContain('>UTG<')
    expect(html).toContain('FIRST TO ACT')
    expect(html).not.toMatch(/folds to hero/i)
  })
})

describe('PreflopTable — B. Hero UTG+1', () => {
  it('shows UTG folded, Hero labeled UTG+1', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG+1" effectiveStackBb={60} actionBeforeHero={['UTG folds']} />,
    )
    expect(html).toContain('>UTG+1<')
    expect(html).toContain('FOLD')
    expect(html).toContain('ACTION FOLDED TO UTG+1')
  })
})

describe('PreflopTable — C. Hero HJ', () => {
  it('all correct earlier positions (UTG, UTG+1, UTG+2, LJ) are folded', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="HJ" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('>HJ<')
    for (const pos of ['UTG', 'UTG+1', 'UTG+2', 'LJ']) {
      expect(html).toContain(`aria-label="${pos}, folded"`)
    }
    // CO/BTN/SB/BB have not acted yet at this table — no fold marker for them
    for (const pos of ['CO', 'BTN', 'SB', 'BB']) {
      expect(html).not.toContain(`aria-label="${pos}, folded"`)
    }
  })
})

describe('PreflopTable — D. Hero BTN', () => {
  it('correct earlier positions folded, dealer button associated with Hero, standard 22px gap (no more Hero-only special case)', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('Dealer button')
    // Only one dealer marker should render (on Hero's own seat, not duplicated elsewhere)
    expect((html.match(/Dealer button/g) || []).length).toBe(1)
    // Hero-is-BTN now uses the SAME 22px gap as every other seat — no more 68px special case.
    expect(html).toContain('+ 22px)')
    expect(html).not.toContain('+ 68px)')
  })
})

describe('PreflopTable — E. Hero SB', () => {
  it('BTN dealer marker is correct (not on Hero) and SB/BB blinds show as in-table chip markers, not a fake stack', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('Dealer button')
    // BB's posted blind (1bb) renders as a small chip marker — every seat, including
    // blinds, still shows its real effective stack on its own rail label.
    expect(html).toMatch(/text-white\/65[^<]*>1</)
    expect(html).toContain('100 BB') // BB's real stack, unchanged by having posted a blind
  })
})

describe('PreflopTable — F. Hero BB', () => {
  it('correct positional mapping for BB', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('>BB<')
  })
})

describe('PreflopTable — G. Facing an open', () => {
  it("the opener's action verb is on their own seat, and the real bet size renders as a chip-stack marker (not text)", () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BTN"
        heroHand={['As', '5s']}
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    expect(html).toContain('aria-label="CO, RAISE"')
    // The bet size (2.3bb) is a chip-stack marker (aggressor tone) positioned between
    // CO's seat and the table center, not appended to CO's own action label.
    expect(html).toMatch(/text-sky-200[^<]*>2\.3</)
    expect(html).toContain('border-sky-400/40 bg-sky-500/25')
    expect(html).toContain('CO OPEN')
  })
})

describe('PreflopTable — H. Facing open + call (squeeze context)', () => {
  it('both the opener and caller actions are visible, correct squeeze framing', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="SB"
        heroHand={['As', '5s']}
        effectiveStackBb={100}
        actionBeforeHero={['CO raises to 2.3bb', 'BTN calls']}
      />,
    )
    expect(html).toContain('aria-label="CO, RAISE"')
    expect(html).toMatch(/text-sky-200[^<]*>2\.3</)
    expect(html).toContain('aria-label="BTN, CALL"')
    expect(html).toContain('CO OPEN · BTN CALL')
  })
})

describe('PreflopTable — I. Hero opens, then faces a 3-bet (the reported table/question mismatch)', () => {
  it("shows Hero's own prior raise as a chip marker, separates Hero's stack-BEHIND from the raise amount, and labels the villain's raise 3-BET not RAISE", () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="CO"
        heroHand={['As', 'Kd']}
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.5bb', 'BTN raises to 8bb']}
      />,
    )
    // Hero's own 2.5bb open is visible as a chip marker, not hidden.
    expect(html).toMatch(/text-sky-200[^<]*>2\.5</)
    // BTN's re-raise is visible with its real size too.
    expect(html).toMatch(/text-sky-200[^<]*>8</)
    // The center status correctly frames this as a 3-bet, not a second "open"/"raise".
    expect(html).toContain('CO OPEN · BTN 3-BET')
    // Hero's displayed stack-BEHIND (100 - 2.5 = 97.5) is explicitly labeled "behind" —
    // it can never be misread as a raise-to amount, which lives only on the chip.
    expect(html).toContain('97.5 BB behind')
    // The raise amount itself never carries the word "behind" anywhere near it — the
    // two numbers (2.5 raise vs 97.5 stack-behind) are never conflated as one figure.
    expect(html).not.toMatch(/2\.5\s*BB behind/)
    // The pot reflects blinds + Hero's open + BTN's 3-bet, from table-state derivation only.
    expect(html).toContain(`${2.5 + 8 + 0.5 + 1} BB`)
  })
})

describe('PreflopTable — J. Folded players keep their already-invested chips visible (never vanish from the pot)', () => {
  it('SB and BB fold to a squeeze after posting — their forced-blind chips still render on the felt', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="UTG"
        effectiveStackBb={100}
        actionBeforeHero={['UTG raises to 2.3bb', 'HJ folds', 'CO calls', 'BTN raises to 8bb', 'SB folds', 'BB folds']}
      />,
    )
    // SB/BB are dimmed + labeled FOLD...
    expect(html).toContain('aria-label="SB, folded"')
    expect(html).toContain('aria-label="BB, folded"')
    // ...but their posted-blind chips (0.5 / 1) are still visible on the felt, in
    // NEUTRAL "blind" tone (they never voluntarily bet beyond the forced blind).
    expect(html).toMatch(/text-white\/65[^<]*>0\.5</)
    expect(html).toMatch(/text-white\/65[^<]*>1</)
    // CO's call (2.3, beyond no forced blind) and BTN's 3-bet (8) show in the
    // aggressor/"bet" tone.
    expect(html).toMatch(/text-sky-200[^<]*>2\.3</)
    expect(html).toMatch(/text-sky-200[^<]*>8</)
    // HJ folded WITHOUT ever committing anything (no blind, no call) — no chip at all.
    const chipCount = (html.match(/-translate-y-1\/2 flex flex-col items-center gap-\[3px\]"/g) || []).length
    expect(chipCount).toBe(5) // UTG(hero), CO, BTN, SB, BB — not HJ
    // Pot = 2.3 (UTG) + 2.3 (CO call) + 8 (BTN) + 0.5 (SB) + 1 (BB) = 14.1
    expect(html).toContain('14.1 BB')
  })
})

describe('PreflopTable — K. Hero cards', () => {
  it('renders the exact cards passed, with accessible labels', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="CO" heroHand={['Qs', 'Qd']} effectiveStackBb={60} />,
    )
    expect(html).toContain('Queen of spades')
    expect(html).toContain('Queen of diamonds')
  })

  it('falls back to face-down placeholders when no hand is given', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={60} />)
    expect(html).toContain('Face-down card')
  })
})

describe('PreflopTable — L. Post-answer result state', () => {
  it("shows the correct badge and Hero's own action without altering canonical data", () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="UTG"
        effectiveStackBb={60}
        heroAction={{ label: 'RAISE' }}
        result="correct"
      />,
    )
    expect(html).toContain('✓ CORRECT')
    expect(html).toContain('RAISE')
    expect(html).not.toContain('YOUR TURN')
  })

  it('shows the incorrect badge distinctly', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} heroAction={{ label: 'FOLD' }} result="incorrect" />,
    )
    expect(html).toContain('✕ INCORRECT')
  })

  it('reserves the result-badge and hero-action-pill rows even before an answer exists — layout-shift regression guard', () => {
    const before = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" heroHand={['Qs', 'Qd']} effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    const after = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="UTG"
        heroHand={['Qs', 'Qd']}
        effectiveStackBb={60}
        actionBeforeHero={[]}
        heroAction={{ label: 'RAISE' }}
        result="correct"
      />,
    )
    expect(before).toContain('role="status"')
    expect(before).toContain('invisible')
    expect(after).toContain('role="status"')
    expect(after).toContain('✓ CORRECT')
    expect(after).toContain('RAISE')
    // The result badge sits directly after the cards row and before the action-pill row
    // in both renders — never conditionally spliced in elsewhere.
    const cardsIdx = before.indexOf('Queen of spades')
    const statusIdx = before.indexOf('role="status"')
    expect(cardsIdx).toBeLessThan(statusIdx)
  })
})

describe('PreflopTable — ante and unknown-context graceful degradation', () => {
  it('shows an ante line only when ante_bb is actually provided', () => {
    const withAnte = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} anteBb={0.125} />,
    )
    expect(withAnte).toContain('ANTE')
    const withoutAnte = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} />)
    expect(withoutAnte).not.toContain('ANTE')
  })

  it('still shows the ante even when effective_stack_bb is not provided (independent fields, not nested)', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" anteBb={0.125} />)
    expect(html).toContain('ANTE')
  })

  it('never fabricates a fold/action row when actionBeforeHero is not provided', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} />)
    expect(html).not.toContain('FOLD')
    expect(html).not.toContain('FIRST TO ACT')
    expect(html).not.toContain('ACTION FOLDED')
  })
})

describe('PreflopTable — no internal identifier leakage', () => {
  it('never renders raw concept-id-style strings (e.g. "utg_rfi")', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    expect(html).not.toMatch(/utg_rfi|_rfi\b/)
  })
})

describe('PreflopTable — hero cards are mathematically centered (fixed-width wrapper, no per-card offsets)', () => {
  it('cards render inside one fixed 114px (54+6+54) wrapper with justify-between, not implicit flex sizing', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" heroHand={['Qs', 'Qd']} effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    expect(html).toContain('w-[114px]')
    expect(html).toContain('justify-between')
  })
})

describe('PreflopTable — Hero uses the IDENTICAL rail-anchor geometry as every other seat', () => {
  it("Hero's position-label coordinates equal the same railCenterlinePoint formula applied to Hero's own seat entry — no separate pod offset", () => {
    const seats = computeHeroRotatedSeats(6, 'CO', DESKTOP_LAYOUT.ellipseRadius)
    const heroSeat = seats[0]
    expect(heroSeat.position).toBe('CO')
    const railCenterlineRadius = (DESKTOP_LAYOUT.railOuterRadius + DESKTOP_LAYOUT.railInnerRadius) / 2
    const expected = railCenterlinePoint(heroSeat.x, heroSeat.y, DESKTOP_LAYOUT.ellipseRadius, railCenterlineRadius)

    const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition="CO" effectiveStackBb={100} actionBeforeHero={[]} />)
    const m = html.match(/left:([\d.]+)%;top:([\d.]+)%">CO</)
    expect(m).toBeTruthy()
    expect(parseFloat(m![1])).toBeCloseTo(parseFloat(expected.x), 1)
    expect(parseFloat(m![2])).toBeCloseTo(parseFloat(expected.y), 1)
  })

  it('every non-hero seat label also lands exactly on its own railCenterlinePoint — same formula, same anchor system', () => {
    const seats = computeHeroRotatedSeats(9, 'UTG', DESKTOP_LAYOUT.ellipseRadius)
    const railCenterlineRadius = (DESKTOP_LAYOUT.railOuterRadius + DESKTOP_LAYOUT.railInnerRadius) / 2
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    for (const seat of seats.slice(1)) {
      const expected = railCenterlinePoint(seat.x, seat.y, DESKTOP_LAYOUT.ellipseRadius, railCenterlineRadius)
      const re = new RegExp(`left:([\\d.]+)%;top:([\\d.]+)%">${seat.position.replace('+', '\\+')}<`)
      const m = html.match(re)
      expect(m, `expected a rail-anchored label for ${seat.position}`).toBeTruthy()
      expect(parseFloat(m![1])).toBeCloseTo(parseFloat(expected.x), 1)
      expect(parseFloat(m![2])).toBeCloseTo(parseFloat(expected.y), 1)
    }
  })

  it('Hero gets a small violet "Hero" caption in addition to (not instead of) the same position label', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition="CO" effectiveStackBb={100} />)
    expect(html).toMatch(/text-violet-300\/70[^<]*>Hero</)
    expect(html).toContain('>CO<')
  })
})

describe('PreflopTable — dealer marker uses the same seat-anchor + fixed gap for every seat, Hero included', () => {
  it("non-hero BTN: dealer chip sits on the label's own rail point, offset by the standard 22px screen-space gap", () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    const btnLabelMatch = html.match(/left:([\d.]+)%;top:([\d.]+)%">BTN</)
    expect(btnLabelMatch).toBeTruthy()
    const [, bx, by] = btnLabelMatch!
    expect(html).toContain(`left:calc(${bx}% + 22px);top:${by}%`)
  })

  it('hero-is-BTN: SAME 22px gap off Hero\'s own rail point — never renders "D BTN" as one run-on', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    const btnLabelMatch = html.match(/left:([\d.]+)%;top:([\d.]+)%">BTN</)
    expect(btnLabelMatch).toBeTruthy()
    const [, bx, by] = btnLabelMatch!
    expect(html).toContain(`left:calc(${bx}% + 22px);top:${by}%`)
    expect(html).toContain('Dealer button')
    expect(html).not.toContain('>D BTN<')
    expect(html).not.toContain('>D HERO')
  })
})

describe('PreflopTable — chip markers geometrically avoid the protected pot/card zone (no text ever hidden behind cards)', () => {
  it('every rendered chip stack lands strictly outside the protected rectangle, across a busy multi-way pot', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="UTG"
        effectiveStackBb={100}
        actionBeforeHero={[
          'UTG raises to 2.3bb',
          'UTG+1 folds',
          'UTG+2 calls',
          'LJ folds',
          'HJ raises to 8bb',
          'CO calls',
          'BTN folds',
          'SB folds',
          'BB folds',
        ]}
      />,
    )
    const matches = [
      ...html.matchAll(/-translate-y-1\/2 flex flex-col items-center gap-\[3px\]" style="left:([\d.]+)%;top:([\d.]+)%"/g),
    ]
    expect(matches.length).toBeGreaterThanOrEqual(5)
    const { cxPct, cyPct, halfWidthPct, halfHeightPct } = DESKTOP_LAYOUT.protectedZone
    for (const [, xs, ys] of matches) {
      const x = parseFloat(xs)
      const y = parseFloat(ys)
      const inside = x > cxPct - halfWidthPct && x < cxPct + halfWidthPct && y > cyPct - halfHeightPct && y < cyPct + halfHeightPct
      expect(inside, `chip at (${x}%, ${y}%) must land outside the protected zone`).toBe(false)
    }
  })
})

describe('PreflopTable — dark green felt (not casino-bright), outer rail unchanged', () => {
  it('the felt gradient uses dark green tones, and the outer rail ring keeps its original gradient/inset', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    // Felt: dark green radial gradient.
    expect(html).toMatch(/radial-gradient\(ellipse at 50% 40%, rgba\(21,63,46/)
    // Outer rail: unchanged inset (10% desktop) and gradient.
    expect(html).toContain('inset-[10%]')
    expect(html).toContain('linear-gradient(180deg, rgba(255,255,255,0.05)')
  })
})

describe('PreflopTable — status/context info lives below the table, not inside it', () => {
  it('the street/stack/ante summary and center-status text render in a status bar after the table container', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="BTN"
        effectiveStackBb={100}
        anteBb={0.125}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    expect(html).toContain('PREFLOP · 100BB EFFECTIVE · ANTE 0.125BB')
    expect(html).toContain('CO OPEN')
    // The status bar text is a sibling block AFTER the table's own aspect-ratio
    // container closes — it appears after the felt/seat content, and before the
    // sr-only accessibility summary.
    const statusIdx = html.indexOf('PREFLOP ·')
    const srOnlyIdx = html.indexOf('sr-only')
    const feltIdx = html.indexOf('radial-gradient(ellipse at 50% 40%')
    expect(feltIdx).toBeGreaterThan(-1)
    expect(feltIdx).toBeLessThan(statusIdx)
    expect(statusIdx).toBeLessThan(srOnlyIdx)
  })
})
