import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PreflopTable, computeHeroRotatedSeats } from '../PreflopTable'

describe('PreflopTable — A. Hero UTG', () => {
  it('Hero sits bottom-center (slot 0), is labeled UTG, and no "folds to Hero" text appears', () => {
    const seats = computeHeroRotatedSeats(9, 'UTG')
    expect(seats[0].position).toBe('UTG')
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" heroHand={['Qs', 'Qd']} effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    expect(html).toContain('HERO · UTG')
    expect(html).toContain('FIRST TO ACT')
    expect(html).not.toMatch(/folds to hero/i)
  })
})

describe('PreflopTable — B. Hero UTG+1', () => {
  it('shows UTG folded, Hero labeled UTG+1', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG+1" effectiveStackBb={60} actionBeforeHero={['UTG folds']} />,
    )
    expect(html).toContain('HERO · UTG+1')
    expect(html).toContain('FOLD')
    expect(html).toContain('ACTION FOLDED TO UTG+1')
  })
})

describe('PreflopTable — C. Hero HJ', () => {
  it('all correct earlier positions (UTG, UTG+1, UTG+2, LJ) are folded', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="HJ" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('HERO · HJ')
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
  it('correct earlier positions folded, dealer button associated with Hero', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('HERO · BTN')
    expect(html).toContain('Dealer button')
    // Only one dealer marker should render (on Hero's own seat, not duplicated elsewhere)
    expect((html.match(/Dealer button/g) || []).length).toBe(1)
  })
})

describe('PreflopTable — E. Hero SB', () => {
  it('BTN dealer marker is correct (not on Hero) and SB/BB blinds show as in-table chip markers, not a fake stack', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('HERO · SB')
    expect(html).toContain('Dealer button')
    // BB's posted blind (1bb) renders as a small chip marker, not as BB's own "stack" line —
    // every seat, including blinds, still shows its real effective stack.
    expect(html).toContain('border-white/15 bg-white/10 text-white/60">1</span>')
    expect(html).toContain('100 BB') // BB's real stack, unchanged by having posted a blind
  })
})

describe('PreflopTable — F. Hero BB', () => {
  it('correct positional mapping for BB', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('HERO · BB')
  })
})

describe('PreflopTable — G. Facing an open', () => {
  it('the opener\'s action verb is on their own seat, and the real bet size renders as an in-table chip marker', () => {
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
    // The bet size (2.3bb) is a chip marker positioned between CO's seat and the table
    // center, not appended to CO's own action label.
    expect(html).toContain('border-sky-400/30 bg-sky-500/20 text-sky-200">2.3</span>')
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
    expect(html).toContain('border-sky-400/30 bg-sky-500/20 text-sky-200">2.3</span>')
    expect(html).toContain('aria-label="BTN, CALL"')
    expect(html).toContain('CO OPEN · BTN CALL')
  })
})

describe('PreflopTable — I. Hero cards', () => {
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

describe('PreflopTable — J. Post-answer result state', () => {
  it('shows the correct badge and Hero\'s own action without altering canonical data', () => {
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
})

describe('PreflopTable — ante and unknown-context graceful degradation', () => {
  it('shows an ante pill only when ante_bb is actually provided', () => {
    const withAnte = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} anteBb={0.125} />,
    )
    expect(withAnte).toContain('ANTE')
    const withoutAnte = renderToStaticMarkup(<PreflopTable tableSize={9} heroPosition="CO" effectiveStackBb={40} />)
    expect(withoutAnte).not.toContain('ANTE')
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

describe('PreflopTable — position label typography is larger/clearer, stack stays secondary', () => {
  it('non-hero position label is 13px font-extrabold at full contrast; stack line is unchanged (smaller, dimmer)', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('text-[13px] font-extrabold text-foreground')
    expect(html).not.toContain('text-[11px] font-bold text-foreground/70')
    expect(html).toContain('text-[10px] font-medium text-muted-foreground/45')
  })

  it("Hero's own badge is untouched by this pass (still 11px font-bold violet)", () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="UTG" effectiveStackBb={60} actionBeforeHero={[]} />,
    )
    expect(html).toContain('text-[11px] font-bold text-violet-200')
  })
})

describe('PreflopTable — dealer marker never overlaps a seat label', () => {
  it('non-hero BTN: dealer chip sits on the label\'s own row, offset by a fixed 22px screen-space gap', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="SB" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    const btnLabelMatch = html.match(/left:([\d.]+)%;top:([\d.]+)%"[^>]*>BTN</)
    expect(btnLabelMatch).toBeTruthy()
    const [, bx, by] = btnLabelMatch!
    // The dealer marker anchors off the SAME rail point as the label, offset only in x —
    // i.e. it moves in lockstep with wherever BTN's label actually sits, never independently.
    expect(html).toContain(`left:calc(${bx}% + 22px);top:${by}%`)
  })

  it('hero-is-BTN keeps its own toward-center placement — never renders "D BTN" as one run-on', () => {
    const html = renderToStaticMarkup(
      <PreflopTable tableSize={9} heroPosition="BTN" effectiveStackBb={100} actionBeforeHero={['Everyone folds']} />,
    )
    expect(html).toContain('Dealer button')
    expect(html).toContain('HERO · BTN')
    expect(html).not.toContain('>D BTN<')
    expect(html).not.toContain('>D HERO')
  })
})
