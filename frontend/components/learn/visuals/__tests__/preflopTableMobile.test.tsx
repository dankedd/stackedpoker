import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  computeHeroRotatedSeats,
  railCenterlinePoint,
  bandPoint,
  pushOutOfZone,
  DESKTOP_LAYOUT,
  MOBILE_LAYOUT,
  NARROW_MOBILE_LAYOUT,
  PreflopTable,
} from '../PreflopTable'

// PreflopTable itself always renders desktop-shaped markup in these node-environment
// tests (useIsMobile's effect never runs under renderToStaticMarkup — see
// preflopTable.test.tsx), so the mobile branch is exercised here at the pure-geometry
// level instead: the same trig every seat/rail/dealer anchor is built from, called
// with MOBILE_LAYOUT's numbers instead of the desktop defaults.

describe('mobile layout config — a dedicated map, not a scaled-down desktop', () => {
  it('mobile is not identical to desktop on any radius/gap dimension', () => {
    expect(MOBILE_LAYOUT.aspectRatio).not.toBe(DESKTOP_LAYOUT.aspectRatio)
    expect(MOBILE_LAYOUT.ellipseRadius).not.toBe(DESKTOP_LAYOUT.ellipseRadius)
    expect(MOBILE_LAYOUT.chipPullFactor).not.toBe(DESKTOP_LAYOUT.chipPullFactor)
  })

  it('both breakpoints use the SAME structural principle — a protected center zone for pot + Hero cards, not a Hero-only pod anchor', () => {
    expect(MOBILE_LAYOUT.protectedZone.halfWidthPct).toBeGreaterThan(0)
    expect(MOBILE_LAYOUT.protectedZone.halfHeightPct).toBeGreaterThan(0)
    expect(DESKTOP_LAYOUT.protectedZone.halfWidthPct).toBeGreaterThan(0)
    expect(DESKTOP_LAYOUT.protectedZone.halfHeightPct).toBeGreaterThan(0)
    // potYPct sits above cardZoneYPct on both — pot readout, then Hero's cards below it.
    expect(MOBILE_LAYOUT.potYPct).toBeLessThan(MOBILE_LAYOUT.cardZoneYPct)
    expect(DESKTOP_LAYOUT.potYPct).toBeLessThan(DESKTOP_LAYOUT.cardZoneYPct)
  })

  it('mobile is taller (aspect-ratio < 1) than desktop (aspect-ratio > 1)', () => {
    const [dw, dh] = DESKTOP_LAYOUT.aspectRatio.split('/').map(Number)
    const [mw, mh] = MOBILE_LAYOUT.aspectRatio.split('/').map(Number)
    expect(dw / dh).toBeGreaterThan(1)
    expect(mw / mh).toBeLessThan(1)
  })

  it('keeps a real rail band between the seat ring and the felt on both breakpoints', () => {
    expect(DESKTOP_LAYOUT.ellipseRadius - DESKTOP_LAYOUT.railOuterRadius).toBe(2.5)
    expect(DESKTOP_LAYOUT.railOuterRadius - DESKTOP_LAYOUT.railInnerRadius).toBe(2.5)
    // Mobile's rail sits further out than it used to: once seat pods moved to
    // their own outer band, the felt could expand into the dark margin that the
    // old rail left behind. The band itself is still a band, which is what this
    // guards — its exact thickness is a visual-tuning value, not a contract.
    expect(MOBILE_LAYOUT.ellipseRadius - MOBILE_LAYOUT.railOuterRadius).toBeGreaterThan(0)
    expect(MOBILE_LAYOUT.railOuterRadius - MOBILE_LAYOUT.railInnerRadius).toBeGreaterThan(0)
  })

  it('keeps every seat pod off the felt and every chip on it', () => {
    const bands = MOBILE_LAYOUT.bands!
    // The redesign rests on these rings never crossing: seat pods outside the
    // felt (on the rail, where a name plate belongs), chips on the felt, and a
    // clear radial gap between the two so no amount of label text can reach a
    // chip. Pods ride the rail rather than clearing it entirely — at the top
    // and bottom of the ellipse there is no room to sit further out and still
    // fit the pod's second row inside the container.
    expect(Math.min(bands.label.rx, bands.label.ry)).toBeGreaterThan(MOBILE_LAYOUT.railInnerRadius)
    expect(Math.max(bands.chip.rx, bands.chip.ry)).toBeLessThan(MOBILE_LAYOUT.railInnerRadius)
    expect(Math.min(bands.label.rx, bands.label.ry) - Math.max(bands.chip.rx, bands.chip.ry)).toBeGreaterThanOrEqual(8)
  })
})

describe('computeHeroRotatedSeats — mobile radius produces a smaller, still-symmetrical ellipse', () => {
  it('every seat sits at exactly MOBILE_LAYOUT.ellipseRadius from center (50%, 50%)', () => {
    const seats = computeHeroRotatedSeats(9, 'UTG', MOBILE_LAYOUT.ellipseRadius)
    for (const seat of seats) {
      const x = parseFloat(seat.x)
      const y = parseFloat(seat.y)
      const dist = Math.sqrt((x - 50) ** 2 + (y - 50) ** 2)
      expect(dist).toBeCloseTo(MOBILE_LAYOUT.ellipseRadius, 1)
    }
  })

  it('Hero still sits bottom-center (slot 0) regardless of radius', () => {
    const seats = computeHeroRotatedSeats(6, 'BTN', MOBILE_LAYOUT.ellipseRadius)
    expect(seats[0].position).toBe('BTN')
    expect(seats[0].x).toBe('50.00%')
    expect(parseFloat(seats[0].y)).toBeGreaterThan(50) // below center
  })

  it('mobile seats sit strictly inside the desktop ellipse (more edge clearance)', () => {
    const desktopSeats = computeHeroRotatedSeats(9, 'CO', DESKTOP_LAYOUT.ellipseRadius)
    const mobileSeats = computeHeroRotatedSeats(9, 'CO', MOBILE_LAYOUT.ellipseRadius)
    for (let i = 0; i < desktopSeats.length; i++) {
      const dx = Math.abs(parseFloat(desktopSeats[i].x) - 50)
      const mx = Math.abs(parseFloat(mobileSeats[i].x) - 50)
      const dy = Math.abs(parseFloat(desktopSeats[i].y) - 50)
      const my = Math.abs(parseFloat(mobileSeats[i].y) - 50)
      expect(mx).toBeLessThanOrEqual(dx + 0.01)
      expect(my).toBeLessThanOrEqual(dy + 0.01)
    }
  })
})

describe('bandPoint — the mobile placement rings', () => {
  it('is a plain ellipse at exponent 2, so the default matches the old behaviour', () => {
    const p = bandPoint(1, 8, 40, 30, 0, 2)
    const angle = (2 * Math.PI) / 8
    expect(parseFloat(p.x)).toBeCloseTo(50 - 40 * Math.sin(angle), 1)
    expect(parseFloat(p.y)).toBeCloseTo(50 + 30 * Math.cos(angle), 1)
  })

  it('pushes DIAGONAL seats outward at a higher exponent but leaves the four axis seats put', () => {
    // Slot 0 is bottom-center — dead on an axis, so squaring the band off must
    // not move it (that is where the container edge, not the felt, is binding).
    const bottomEllipse = bandPoint(0, 8, 42, 37, 0, 2)
    const bottomSquircle = bandPoint(0, 8, 42, 37, 0, 4)
    expect(bottomSquircle.y).toBe(bottomEllipse.y)

    // Slot 1 is a 45° diagonal — the cramped seat the exponent exists for.
    const diagEllipse = bandPoint(1, 8, 42, 37, 0, 2)
    const diagSquircle = bandPoint(1, 8, 42, 37, 0, 4)
    expect(Math.abs(parseFloat(diagSquircle.x) - 50)).toBeGreaterThan(
      Math.abs(parseFloat(diagEllipse.x) - 50),
    )
    expect(Math.abs(parseFloat(diagSquircle.y) - 50)).toBeGreaterThan(
      Math.abs(parseFloat(diagEllipse.y) - 50),
    )
  })
})

describe('pushOutOfZone — chips never sit on the pot or Hero cards', () => {
  const zone = { cxPct: 50, cyPct: 50, halfWidthPct: 20, halfHeightPct: 20 }

  it('leaves a point that is already clear exactly where it is', () => {
    const p = pushOutOfZone('10.00%', '50.00%', zone, 3)
    expect(p).toEqual({ x: '10.00%', y: '50.00%' })
  })

  it('moves an intruding point out to the boundary WITHOUT crossing the table center', () => {
    // A chip must stay on its own player's side — shoving it through the middle
    // would read as somebody else's bet.
    const p = pushOutOfZone('45.00%', '58.00%', zone, 3)
    expect(parseFloat(p.x)).toBeLessThan(50)
    expect(parseFloat(p.y)).toBeGreaterThan(50)
    const escaped =
      Math.abs(parseFloat(p.x) - 50) >= 23 - 0.01 || Math.abs(parseFloat(p.y) - 50) >= 23 - 0.01
    expect(escaped).toBe(true)
  })
})

describe('narrow phones (<360px) drop a card tier rather than overlapping', () => {
  it('keeps every other dimension identical to the standard mobile layout', () => {
    expect(NARROW_MOBILE_LAYOUT.heroCardSize).toBe('md')
    expect(MOBILE_LAYOUT.heroCardSize).toBe('lg')
    expect(NARROW_MOBILE_LAYOUT.aspectRatio).toBe(MOBILE_LAYOUT.aspectRatio)
    // Same rings, except the chip ring moves in vertically to buy room for the
    // dealer button between a seat's label and its own chip on a shorter table.
    expect(NARROW_MOBILE_LAYOUT.bands!.label).toEqual(MOBILE_LAYOUT.bands!.label)
    expect(NARROW_MOBILE_LAYOUT.bands!.chip.rx).toBe(MOBILE_LAYOUT.bands!.chip.rx)
    expect(NARROW_MOBILE_LAYOUT.bands!.chip.ry).toBeLessThan(MOBILE_LAYOUT.bands!.chip.ry)
    // ...and must still clear the protected rectangle it is pushed out of.
    expect(NARROW_MOBILE_LAYOUT.bands!.chip.ry).toBeGreaterThanOrEqual(
      NARROW_MOBILE_LAYOUT.protectedZone.halfHeightPct,
    )
  })
})

describe('hole cards never overlap', () => {
  it('spaces the pair with a real positive gap on every mobile tier', () => {
    // A negative gap (the old fanned pair) tucks the left card's edge under its
    // neighbour. Two whole smaller cards beat two half-hidden bigger ones.
    expect(MOBILE_LAYOUT.heroCardGapPx).toBeGreaterThan(0)
    expect(NARROW_MOBILE_LAYOUT.heroCardGapPx).toBeGreaterThan(0)
  })

  it('keeps the pair within the width the seat geometry was tuned against', () => {
    // The protected rectangle has to cover the card row at the NARROWEST table
    // the tier is used on, or a chip can be pushed onto a card.
    const CARD_W = { md: 51, lg: 54 }
    const rowWidth = (l: typeof MOBILE_LAYOUT) => CARD_W[l.heroCardSize] * 2 + l.heroCardGapPx
    expect(rowWidth(MOBILE_LAYOUT)).toBeLessThanOrEqual(118)
    expect(rowWidth(NARROW_MOBILE_LAYOUT)).toBeLessThanOrEqual(118)
    // Narrowest table each tier renders on: 310px at the 360px breakpoint,
    // 270px at the 320px floor.
    expect(rowWidth(MOBILE_LAYOUT) / 2 / 310 * 100).toBeLessThan(MOBILE_LAYOUT.protectedZone.halfWidthPct)
    expect(rowWidth(NARROW_MOBILE_LAYOUT) / 2 / 270 * 100).toBeLessThan(
      NARROW_MOBILE_LAYOUT.protectedZone.halfWidthPct,
    )
  })
})

describe('layout instrumentation', () => {
  it('tags the elements the mobile collision audit measures', () => {
    // These hooks are how the table is checked for overlaps at real phone
    // widths in a browser; unit tests cannot measure rendered boxes. Losing
    // them silently would leave the mobile geometry unverifiable.
    const html = renderToStaticMarkup(
      <PreflopTable
        tableSize={9}
        heroPosition="BB"
        heroHand={['As', 'Kh']}
        effectiveStackBb={100}
        actionBeforeHero={['CO raises to 2.5bb']}
      />,
    )
    for (const hook of ['seat-pos', 'seat-meta', 'chip', 'dealer', 'hero-cards']) {
      expect(html).toContain(`data-tt="${hook}"`)
    }
  })
})

describe('railCenterlinePoint — mobile rail centerline tracks MOBILE_LAYOUT radii', () => {
  it('rescales a mobile-radius seat point onto the mobile rail centerline', () => {
    const railCenterlineRadius = (MOBILE_LAYOUT.railOuterRadius + MOBILE_LAYOUT.railInnerRadius) / 2
    const seats = computeHeroRotatedSeats(9, 'UTG', MOBILE_LAYOUT.ellipseRadius)
    const btn = seats.find((s) => s.position === 'BTN')!
    const point = railCenterlinePoint(btn.x, btn.y, MOBILE_LAYOUT.ellipseRadius, railCenterlineRadius)
    const dist = Math.sqrt((parseFloat(point.x) - 50) ** 2 + (parseFloat(point.y) - 50) ** 2)
    expect(dist).toBeCloseTo(railCenterlineRadius, 1)
  })
})
