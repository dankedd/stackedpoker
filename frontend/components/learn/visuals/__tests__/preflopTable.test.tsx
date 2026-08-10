import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreflopTable, computeHeroRotatedSeats, railCenterlinePoint, DESKTOP_LAYOUT } from '../PreflopTable'
import { ChipStack } from '@/components/poker/ChipStack'
import { buildPlaybackTimeline } from '@/lib/learn/preflopTablePlayback'
import { ROW2_TOP_OFFSET_PX } from '../PreflopSeatRow'

/** A seat's Row-1 label now nests the position inside a child <span> (and, for
 *  Hero, an extra "HERO ·" <span> before it) rather than being the outer
 *  span's direct text — so matches must tolerate that nesting instead of
 *  requiring POSITION immediately after the outer span's '>'. */
function railLabelMatch(html: string, position: string) {
  const escaped = position.replace('+', '\\+')
  // Wide enough to span past Hero's extra "HERO ·" prefix span (~190 chars of
  // markup) before reaching the position text itself.
  return html.match(new RegExp(`left:([\\d.]+)%;top:([\\d.]+)%">[\\s\\S]{0,260}?>${escaped}<`))
}

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
  it('correct earlier positions folded, dealer button associated with Hero, widened gap clears the "HERO ·" prefix', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('Dealer button')
    // Only one dealer marker should render (on Hero's own seat, not duplicated elsewhere)
    expect((html.match(/Dealer button/g) || []).length).toBe(1)
    // Hero-is-BTN's label is "HERO · BTN" — visibly wider than a plain 3-letter
    // label — so the dealer marker needs dealerLabelGapPx (22) PLUS
    // heroDealerExtraGapPx (30) = 52px to clear it (previously this used the
    // same flat 22px as every other seat, which visually clipped the "N" in
    // "BTN" behind the dealer marker — confirmed via screenshot QA).
    expect(html).toContain('+ 52px)')
    expect(html).not.toContain('+ 68px)')
  })
})

describe('PreflopTable — E. Hero SB', () => {
  it('BTN dealer marker is correct (not on Hero) and SB/BB blinds show as real chip-pile markers, not a fake stack', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('Dealer button')
    // BB's posted blind (1bb) renders as a neutral-tone chip-pile amount label — every
    // seat, including blinds, still shows its real effective stack on its own rail label.
    expect(html).toMatch(/text-slate-200[^<]*>1</)
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
  it("the opener's action verb is on their own seat, and the real bet size renders as a chip-pile marker (aggressor tone, not text)", () => {
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
    // The bet size (2.3bb) is a chip-pile marker (aggressor "bet" tone) positioned between
    // CO's seat and the table center, not appended to CO's own action label.
    expect(html).toMatch(/text-sky-100[^<]*>2\.3</)
    // The chip's rim uses the sky edge-color wedge pattern (repeating-conic-gradient), not
    // a plain thin ring — this is the actual "poker chip" visual, not a hollow outline.
    expect(html).toContain('repeating-conic-gradient(#bae6fd 0deg 18deg, #0c4a6e 18deg 36deg)')
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
    expect(html).toMatch(/text-sky-100[^<]*>2\.3</)
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
    expect(html).toMatch(/text-sky-100[^<]*>2\.5</)
    // BTN's re-raise is visible with its real size too.
    expect(html).toMatch(/text-sky-100[^<]*>8</)
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
    // ...but their posted-blind chip PILES (0.5 / 1) are still visible on the felt, in
    // NEUTRAL "blind" tone (they never voluntarily bet beyond the forced blind).
    expect(html).toMatch(/text-slate-200[^<]*>0\.5</)
    expect(html).toMatch(/text-slate-200[^<]*>1</)
    // CO's call (2.3, beyond no forced blind) and BTN's 3-bet (8) show in the
    // aggressor/"bet" tone.
    expect(html).toMatch(/text-sky-100[^<]*>2\.3</)
    expect(html).toMatch(/text-sky-100[^<]*>8</)
    // HJ folded WITHOUT ever committing anything (no blind, no call) — no chip at all.
    const chipCount = (html.match(/-translate-y-1\/2 flex flex-col items-center gap-\[2px\]"/g) || []).length
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

describe('PreflopTable — Hero label is ONE integrated anchor (no more overlapping "Hero" caption)', () => {
  it("Hero's position-label coordinates equal the same railCenterlinePoint formula applied to Hero's own seat entry — no separate pod offset", () => {
    const seats = computeHeroRotatedSeats(6, 'CO', DESKTOP_LAYOUT.ellipseRadius)
    const heroSeat = seats[0]
    expect(heroSeat.position).toBe('CO')
    const railCenterlineRadius = (DESKTOP_LAYOUT.railOuterRadius + DESKTOP_LAYOUT.railInnerRadius) / 2
    const expected = railCenterlinePoint(heroSeat.x, heroSeat.y, DESKTOP_LAYOUT.ellipseRadius, railCenterlineRadius)

    const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition="CO" effectiveStackBb={100} actionBeforeHero={[]} />)
    const m = railLabelMatch(html, 'CO')
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
      const m = railLabelMatch(html, seat.position)
      expect(m, `expected a rail-anchored label for ${seat.position}`).toBeTruthy()
      expect(parseFloat(m![1])).toBeCloseTo(parseFloat(expected.x), 1)
      expect(parseFloat(m![2])).toBeCloseTo(parseFloat(expected.y), 1)
    }
  })

  it('Hero\'s "HERO ·" prefix and position share the SAME single absolutely-positioned anchor — only one left/top pair for the whole label', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition="CO" effectiveStackBb={100} />)
    // The "HERO ·" prefix text exists...
    expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
    expect(html).toContain('>CO<')
    // ...but there is only ONE absolutely-positioned, top/left-styled element for Hero's
    // row-1 label (not two independent anchors that could drift apart and overlap) — the
    // "HERO ·" span itself carries no left/top style of its own.
    const heroPrefixSpan = html.match(/<span class="mr-\[3px\][^"]*">HERO ·<\/span>/)
    expect(heroPrefixSpan).toBeTruthy()
    expect(heroPrefixSpan![0]).not.toMatch(/style=/)
  })

  it('regression guard: the old standalone "Hero" caption (its own left/top anchor, "- 11px" offset) is gone', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition="CO" effectiveStackBb={100} />)
    expect(html).not.toMatch(/top:calc\([\d.]+% - 11px\)/)
    // "Hero" (capitalized only) no longer appears as an independent word — it's always
    // part of the literal "HERO ·" prefix now.
    expect(html).not.toMatch(/>Hero</)
  })
})

describe('PreflopTable — Hero at every position, 6/9-max: label always integrated, never a bare "Hero" text node', () => {
  const positions6 = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  const positions9 = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']

  for (const pos of positions6) {
    it(`6-max, Hero ${pos}`, () => {
      const html = renderToStaticMarkup(<PreflopTable tableSize={6} heroPosition={pos} effectiveStackBb={100} actionBeforeHero={[]} />)
      expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
      const m = railLabelMatch(html, pos)
      expect(m, `Hero (${pos}) should have an integrated rail label`).toBeTruthy()
    })
  }

  for (const pos of positions9) {
    it(`9-max, Hero ${pos}`, () => {
      const html = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition={pos} effectiveStackBb={100} actionBeforeHero={[]} />)
      expect(html).toMatch(/text-violet-300\/80[^<]*>HERO ·</)
      const m = railLabelMatch(html, pos)
      expect(m, `Hero (${pos}) should have an integrated rail label`).toBeTruthy()
    })
  }
})

describe('PreflopTable — dealer marker uses the same seat-anchor + fixed gap for every seat, Hero included', () => {
  it("non-hero BTN: dealer chip sits on the label's own rail point, offset by the standard 22px screen-space gap", () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    const btnLabelMatch = railLabelMatch(html, 'BTN')
    expect(btnLabelMatch).toBeTruthy()
    const [, bx, by] = btnLabelMatch!
    expect(html).toContain(`left:calc(${bx}% + 22px);top:${by}%`)
  })

  it('hero-is-BTN: WIDER gap off Hero\'s own rail point (clears the "HERO ·" prefix) — never renders "D BTN" as one run-on', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    const btnLabelMatch = railLabelMatch(html, 'BTN')
    expect(btnLabelMatch).toBeTruthy()
    const [, bx, by] = btnLabelMatch!
    // 22 (dealerLabelGapPx) + 30 (heroDealerExtraGapPx, hero-is-dealer only) = 52.
    expect(html).toContain(`left:calc(${bx}% + 52px);top:${by}%`)
    expect(html).toContain('Dealer button')
    expect(html).not.toContain('>D BTN<')
    expect(html).not.toContain('>D HERO')
  })

  it('Hero elsewhere (CO/BB/UTG): the dealer marker sits on the DIFFERENT, non-hero BTN seat, so BTN keeps the plain 22px gap unaffected', () => {
    for (const heroPosition of ['CO', 'BB', 'UTG']) {
      const html = renderToStaticMarkup(
        <PreflopTable tableSize={9} heroPosition={heroPosition} effectiveStackBb={100} actionBeforeHero={heroPosition === 'UTG' ? [] : ['Everyone folds']} />,
      )
      expect(html).toMatch(new RegExp(`>${heroPosition}<`))
      const btnLabelMatch = railLabelMatch(html, 'BTN')
      expect(btnLabelMatch).toBeTruthy()
      const [, bx, by] = btnLabelMatch!
      expect(html).toContain(`left:calc(${bx}% + 22px);top:${by}%`)
    }
  })
})

describe('PreflopTable — chip markers geometrically avoid the protected pot/card zone (no text ever hidden behind cards)', () => {
  it('every rendered chip pile lands strictly outside the protected rectangle, across a busy multi-way pot (desktop)', () => {
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
      ...html.matchAll(/-translate-y-1\/2 flex flex-col items-center gap-\[2px\]" style="left:([\d.]+)%;top:([\d.]+)%"/g),
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

describe('PreflopTable — chip visual is a real poker-chip glyph, not a hollow ring', () => {
  it('renders TWO overlapping chip discs (a pile) per commitment, each with an edge-wedge rim, solid face gradient, and inner ring', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} actionBeforeHero={['UTG raises to 2.2bb']} />,
    )
    // 2 discs for the one chip pile (UTG's raise).
    const discCount = (html.match(/repeating-conic-gradient\(#bae6fd 0deg 18deg, #0c4a6e 18deg 36deg\)/g) || []).length
    expect(discCount).toBe(2)
    // Each disc has a solid gradient face (not transparent) and a thin inner ring.
    expect(html).toContain('linear-gradient(155deg, #38bdf8 0%, #0284c7 65%, #075985 100%)')
    expect(html).toContain('border border-white/10')
    // The amount is legible at 10px (up from the old 8px pill text).
    expect(html).toContain('text-[10px] font-bold tabular-nums')
  })

  it('a neutral (never-raised) blind uses the slate palette; a raise uses sky; an all-in uses red — color is supportive only, amount/shape/verb never depend on it alone', () => {
    const blindHtml = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(blindHtml).toContain('repeating-conic-gradient(#cbd5e1 0deg 18deg, #3f4b5f 18deg 36deg)')

    const allinHtml = renderToStaticMarkup(
      <PreflopTable tableSize={6} heroPosition="BB" effectiveStackBb={20} actionBeforeHero={['UTG raises all-in to 20bb']} />,
    )
    expect(allinHtml).toContain('repeating-conic-gradient(#fecaca 0deg 18deg, #7f1d1d 18deg 36deg)')
    expect(allinHtml).toMatch(/text-red-100[^<]*>20</)
  })
})

describe('PreflopTable — dark green felt (not casino-bright), outer rail unchanged', () => {
  it('the felt gradient uses dark green tones, and the outer rail ring keeps its original gradient/inset', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    // Felt: dark green radial gradient.
    expect(html).toMatch(/radial-gradient\(ellipse at 50% 40%, rgba\(21,63,46/)
    // Outer rail: unchanged inset (10% desktop) and gradient. The inset is now
    // derived from DESKTOP_LAYOUT.railOuterRadius (50 - 40) and emitted as an
    // inline style rather than a hardcoded `inset-[10%]` class, so that the
    // drawn ring and the geometry cannot drift apart. Same rendered value.
    expect(html).toContain('inset:10%')
    expect(50 - DESKTOP_LAYOUT.railOuterRadius).toBe(10)
    expect(html).toContain('linear-gradient(180deg, rgba(255,255,255,0.05)')
  })
})

describe('PreflopTable — stackOverridesBb: a short-stacked seat is visible on the table itself', () => {
  it("the short seat shows its OWN stack (not the table-wide effectiveStackBb), with NO special styling or SHORT label — identical to every other stack depth", () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="SB"
        effectiveStackBb={100}
        stackOverridesBb={{ BB: 10 }}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls']}
      />,
    )
    // BB's own 10bb stack renders as plain "10 BB" — never a badge, never "SHORT",
    // never the amber/border/pill treatment (checked narrowly on the stack span
    // itself — the table's Pot readout legitimately uses unrelated amber tones
    // elsewhere, so this must not be a whole-page substring check).
    const stackSpan = html.match(/<span class="([^"]*)">10 BB<\/span>/)
    expect(stackSpan, 'expected a plain span for the 10bb stack').toBeTruthy()
    expect(stackSpan![1]).not.toMatch(/amber|border|rounded/)
    expect(html).not.toContain('SHORT')
    expect(html).not.toContain('border-amber')
    // Every other seat still shows the table-wide 100bb, in the exact same styling.
    expect(html).toContain('100 BB')
  })

  it('without an override, no seat is ever badged short — never a fabricated short-stack flag', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={6} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).not.toContain('SHORT')
  })

  it('a short stack (15bb) and a deep stack (100bb) render through the exact same StackDepthBadge markup — only the number differs', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="SB"
        effectiveStackBb={100}
        stackOverridesBb={{ BB: 15 }}
        actionBeforeHero={['Everyone folds']}
      />,
    )
    const shortMarkup = html.match(/<span class="([^"]*)">15 BB<\/span>/)
    const deepMarkup = html.match(/<span class="([^"]*)">100 BB<\/span>/)
    expect(shortMarkup, 'expected a plain span for the 15bb stack').toBeTruthy()
    expect(deepMarkup, 'expected a plain span for the 100bb stack').toBeTruthy()
    expect(shortMarkup![1]).toBe(deepMarkup![1]) // byte-identical className — no per-depth branch
    // Neither stack-depth span carries any pill/border/badge chrome (unlike
    // the dealer marker / chip discs elsewhere on the table, which legitimately
    // use rounded-full for their own unrelated shapes).
    expect(shortMarkup![1]).not.toMatch(/rounded|border|amber/)
    expect(html).not.toContain('border-amber')
  })

  it('the short-stack fact is also present in the screen-reader summary', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={6}
        heroPosition="SB"
        effectiveStackBb={100}
        stackOverridesBb={{ BB: 10 }}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls']}
      />,
    )
    expect(html).toContain('BB is short-stacked at 10 big blinds.')
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

describe('PreflopTable — Row 2/3 (action/stack) never overlap Row 1 (position label), at every seat', () => {
  // Regression for the reported CO overlap ("CO" / "RAISE" rendering with no
  // visible gap). The fix is generic (PreflopSeatRow's shared vertical-rhythm
  // constants), so this sweeps every occupied seat position, not just CO.
  const ALL_POSITIONS_9MAX = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']

  /** Row 2/3's group `top: calc(X% + Npx)` immediately following `position`'s
   *  own Row-1 label in the markup — the window is deliberately tight (a
   *  seat's own Row 2 wrapper is the very next `top:calc(...)` after its
   *  Row-1 span in the source, before the NEXT seat's block begins) so this
   *  can't accidentally cross-match a different seat's group. Captures N. */
  function row2Offset(html: string, position: string): number | undefined {
    const escaped = position.replace('+', '\\+')
    const m = html.match(
      new RegExp(`>${escaped}<[\\s\\S]{0,500}?top:calc\\([\\d.]+% \\+ (\\d+)px\\)`),
    )
    return m ? Number(m[1]) : undefined
  }

  it('every folded seat (9-max, action folded to BTN) has Row 2 offset by exactly ROW2_TOP_OFFSET_PX below its own rail point', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    for (const pos of ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']) {
      const offset = row2Offset(html, pos)
      expect(offset, `expected a Row 2 group for folded seat ${pos}`).toBe(ROW2_TOP_OFFSET_PX)
    }
  })

  it.each(ALL_POSITIONS_9MAX)('Hero at %s: the acting Hero seat\'s own Row 2 (its stack line) uses the same fixed offset', (heroPosition) => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition={heroPosition} effectiveStackBb={100} actionBeforeHero={[]} />,
    )
    expect(row2Offset(html, heroPosition)).toBe(ROW2_TOP_OFFSET_PX)
  })

  it.each(['FOLD', 'CALL', 'CHECK', 'RAISE', '3-BET', 'ALL-IN'])(
    'action label "%s" never changes Row 2\'s vertical offset from Row 1, regardless of text length',
    (label) => {
      // 3-BET/ALL-IN only ever render via deriveCenterStatus/actionVerb text,
      // not directly settable per-seat, so drive them via realistic action
      // sequences that produce each exact label on CO's own Row 2.
      const actionBeforeHeroByLabel: Record<string, string[]> = {
        FOLD: ['CO folds'],
        CALL: ['UTG raises to 2.3bb', 'CO calls'],
        CHECK: ['CO checks'],
        RAISE: ['CO raises to 2.3bb'],
        '3-BET': ['UTG raises to 2.3bb', 'CO raises to 8bb'],
        'ALL-IN': ['CO raises all-in to 40bb'],
      }
      const html = renderToStaticMarkup(
        <PreflopTable
          tableSize={9}
          heroPosition="BTN"
          effectiveStackBb={100}
          actionBeforeHero={actionBeforeHeroByLabel[label]}
        />,
      )
      expect(row2Offset(html, 'CO'), `expected CO's Row 2 group for action "${label}"`).toBe(ROW2_TOP_OFFSET_PX)
    },
  )

  it('CO specifically (the reported case): position and action render with the centralized offset, not touching', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BTN"
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    expect(html).toContain('aria-label="CO, RAISE"')
    expect(row2Offset(html, 'CO')).toBe(ROW2_TOP_OFFSET_PX)
    expect(ROW2_TOP_OFFSET_PX).toBeGreaterThanOrEqual(12) // a real, deliberate gap — not the old razor-thin one
  })
})

describe('PreflopTable — shared Action Playback Engine: SSR/static-render safety', () => {
  // The engine's very first render (before any client effect has run) must
  // always show the COMPLETE final state — matching what a server-rendered or
  // pre-hydration client render produces (no timers have fired yet). This is
  // what lets every test above keep asserting final-state content unchanged.
  it('a playback-eligible scenario (real action_before_hero) still renders the full final state on first render, not an empty/partial frame', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BTN"
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    // Every fold and the raise are already present — not just blinds posted.
    expect(html).toContain('aria-label="UTG, folded"')
    expect(html).toContain('aria-label="HJ, folded"')
    expect(html).toContain('aria-label="CO, RAISE"')
    expect(html).toContain('CO OPEN')
    expect(html).toContain(`${2.3 + 0.5 + 1} BB`)
  })

  it('the Skip control never appears in the static/first-render markup (playback is already "complete" pre-hydration)', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BTN"
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    expect(html).not.toContain('Skip ▸')
  })

  it('a chip pile never appears at its pre-travel (t=0, at-the-seat) position on first render — no transition style leaks into static markup', () => {
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BTN"
        effectiveStackBb={100}
        actionBeforeHero={['UTG folds', 'HJ folds', 'CO raises to 2.3bb']}
      />,
    )
    expect(html).not.toContain('transition:')
  })

  it('a scenario with NO reliable action data (undefined actionBeforeHero) renders identically whether or not a timeline exists — no playback engine artifacts leak in', () => {
    const html = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} />)
    expect(buildPlaybackTimeline({ hero_position: 'CO', table_size: 9, effective_stack_bb: 40 })).toBeUndefined()
    expect(html).not.toContain('Skip ▸')
    expect(html).not.toContain('FOLD')
  })
})

describe('ChipStack — animateIn extends the existing chip component rather than duplicating it', () => {
  it('renders without throwing when animateIn is set, and starts at the resting position under static rendering (no live effect ever runs)', () => {
    const html = renderToStaticMarkup(
      <ChipStack x="50%" y="93%" amount={2.3} tone="bet" pullFactor={0.4} sizePx={20} animateIn travelDurationMs={450} />,
    )
    expect(html).toContain('2.3')
    expect(html).toContain('repeating-conic-gradient(#bae6fd 0deg 18deg, #0c4a6e 18deg 36deg)')
  })

  it('omitting animateIn renders byte-identical output to explicitly passing animateIn={false}', () => {
    const withDefault = renderToStaticMarkup(<ChipStack x="50%" y="93%" amount={5} tone="blind" pullFactor={0.4} sizePx={20} />)
    const explicit = renderToStaticMarkup(<ChipStack x="50%" y="93%" amount={5} tone="blind" pullFactor={0.4} sizePx={20} animateIn={false} />)
    expect(withDefault).toBe(explicit)
  })
})
