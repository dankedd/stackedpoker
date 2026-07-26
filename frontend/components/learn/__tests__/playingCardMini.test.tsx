/**
 * Regression tests for PlayingCardMini's corner-index symmetry — the two corner blocks
 * (top-left, bottom-right rotated 180deg) must be pinned via explicit, IDENTICAL top/left
 * vs bottom/right offsets, not derived from flex content-height distribution. This is a
 * shared component (used across replay, board/hand visuals, and every preflop table), so
 * a fix here applies everywhere automatically.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlayingCardMini } from '../PlayingCardMini'

/** Extracts the numeric px value of a given CSS property from an inline style string. */
function pxValue(styleAttr: string, prop: 'top' | 'bottom' | 'left' | 'right'): number {
  const match = styleAttr.match(new RegExp(`${prop}:([\\d.]+)px`))
  if (!match) throw new Error(`property "${prop}" not found in style="${styleAttr}"`)
  return parseFloat(match[1])
}

/** Pulls both corner <div>'s full opening tags (class + inline style) out of the rendered card. */
function extractCorners(html: string): { topLeft: string; bottomRight: string } {
  const divs = [...html.matchAll(/<div class="absolute z-10 flex flex-col[^>]*>/g)].map((m) => m[0])
  const topLeft = divs.find((d) => d.includes('items-start') && !d.includes('rotate-180'))
  const bottomRight = divs.find((d) => d.includes('items-end') && d.includes('rotate-180'))
  if (!topLeft || !bottomRight) throw new Error(`expected 2 corner divs, found: ${JSON.stringify(divs)}`)
  return { topLeft, bottomRight }
}

describe('PlayingCardMini — Q♠ specifically (the reported bug)', () => {
  it('top-left inset (top,left) exactly equals bottom-right inset (bottom,right)', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    const { topLeft, bottomRight } = extractCorners(html)
    expect(pxValue(topLeft, 'top')).toBe(pxValue(bottomRight, 'bottom'))
    expect(pxValue(topLeft, 'left')).toBe(pxValue(bottomRight, 'right'))
    // And the exact expected value for 'lg' — not just "equal to each other" but "equal to
    // the real configured inset", guarding against both drifting to some other shared value.
    expect(pxValue(topLeft, 'top')).toBe(6)
    expect(pxValue(bottomRight, 'bottom')).toBe(6)
  })

  it('bottom-right corner is rotated 180deg around its own pinned box, not translated/nudged', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    const { bottomRight } = extractCorners(html)
    expect(bottomRight).toContain('rotate-180')
    expect(bottomRight).not.toMatch(/translate|margin|-mt-|-mb-/)
  })

  it('no negative-margin utility classes remain anywhere in the rendered card', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    expect(html).not.toMatch(/-mt-\[|-mb-\[|-ml-\[|-mr-\[/)
  })
})

describe('PlayingCardMini — symmetry holds for every rank (A,K,Q,J,T, and number cards) and every size', () => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '2']
  const sizes = ['xs', 'sm', 'md', 'lg'] as const

  for (const size of sizes) {
    for (const rank of ranks) {
      it(`${rank}♠ at size '${size}': top/left inset === bottom/right inset`, () => {
        const html = renderToStaticMarkup(<PlayingCardMini card={`${rank}s`} size={size} />)
        const { topLeft, bottomRight } = extractCorners(html)
        expect(pxValue(topLeft, 'top')).toBe(pxValue(bottomRight, 'bottom'))
        expect(pxValue(topLeft, 'left')).toBe(pxValue(bottomRight, 'right'))
      })
    }
  }
})

describe('PlayingCardMini — top and bottom corners use identical typography', () => {
  it('both corners share the exact same rank and suit span class strings (same font-size/line-height/dimensions)', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    // DOM order: [topLeft rank span, topLeft suit span, bottomRight rank span, bottomRight suit span].
    const spans = [...html.matchAll(/<span class="([^"]*)">/g)].map((m) => m[1])
    expect(spans.length).toBe(4)
    const [tlRank, tlSuit, brRank, brSuit] = spans
    expect(tlRank).toBe(brRank)
    expect(tlSuit).toBe(brSuit)
  })

  it('both corners\' outer wrapper divs share the same base classes (leading-none, font-black)', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    const { topLeft, bottomRight } = extractCorners(html)
    expect(topLeft).toContain('leading-none font-black')
    expect(bottomRight).toContain('leading-none font-black')
  })
})

describe('PlayingCardMini — unaffected behavior', () => {
  it('face-down placeholder still renders (no card prop)', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="" size="lg" />)
    expect(html).toContain('Face-down card')
  })

  it('accessible label is preserved (e.g. "Queen of spades")', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    expect(html).toContain('Queen of spades')
  })

  it('card dimensions/colors/border-radius/shadow classes are unchanged', () => {
    const html = renderToStaticMarkup(<PlayingCardMini card="Qs" size="lg" />)
    expect(html).toContain('w-[54px] h-[76px] rounded-[8px]')
    expect(html).toContain('linear-gradient(165deg, #FEFEFC 0%, #F9F6F0 40%, #F0EBE1 100%)')
  })
})
