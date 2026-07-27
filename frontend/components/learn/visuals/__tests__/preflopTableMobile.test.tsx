import { describe, it, expect } from 'vitest'
import {
  computeHeroRotatedSeats,
  railCenterlinePoint,
  DESKTOP_LAYOUT,
  MOBILE_LAYOUT,
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
    expect(MOBILE_LAYOUT.heroPodAnchor).toBe('center')
    expect(DESKTOP_LAYOUT.heroPodAnchor).toBe('seat')
  })

  it('mobile is taller (aspect-ratio < 1) than desktop (aspect-ratio > 1)', () => {
    const [dw, dh] = DESKTOP_LAYOUT.aspectRatio.split('/').map(Number)
    const [mw, mh] = MOBILE_LAYOUT.aspectRatio.split('/').map(Number)
    expect(dw / dh).toBeGreaterThan(1)
    expect(mw / mh).toBeLessThan(1)
  })

  it('mobile keeps the same 2.5-unit rail-thickness spacing as desktop', () => {
    expect(DESKTOP_LAYOUT.ellipseRadius - DESKTOP_LAYOUT.railOuterRadius).toBe(2.5)
    expect(DESKTOP_LAYOUT.railOuterRadius - DESKTOP_LAYOUT.railInnerRadius).toBe(2.5)
    expect(MOBILE_LAYOUT.ellipseRadius - MOBILE_LAYOUT.railOuterRadius).toBe(2)
    expect(MOBILE_LAYOUT.railOuterRadius - MOBILE_LAYOUT.railInnerRadius).toBe(2.5)
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
