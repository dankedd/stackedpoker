/**
 * LessonSlider — the platform-wide slider contract.
 *
 * Two things are being protected here:
 *  1. The affordance fix itself: sliders must not regress back into "a number
 *     with two +/- buttons", which is what QA found learners failing to
 *     recognise as draggable.
 *  2. The accessibility floor that made the native <input type="range"> the
 *     right base in the first place — role, keyboard operability, an
 *     accessible name, and a spoken value (aria-valuetext) rather than a bare
 *     number. Removing the stepper buttons must not cost any of that.
 *
 * Rendering is `renderToStaticMarkup`, matching the rest of the step-component
 * suites — so these assert the control's *initial, server-rendered* contract.
 * Post-interaction behaviour (the hint disappearing once touched) is state the
 * static renderer cannot reach and is deliberately not asserted here.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonSlider } from '../LessonSlider'
import { FrequencySlider } from '../FrequencySlider'

const count = (html: string, needle: RegExp) => (html.match(needle) ?? []).length

describe('LessonSlider — the slider is the only control', () => {
  it('renders exactly one range input and no stepper buttons', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Bet frequency" value={40} onChange={() => {}} />)
    expect(count(html, /type="range"/g)).toBe(1)
    expect(count(html, /<button/g)).toBe(0)
  })

  it('uses a native input, so dragging, track-tapping and arrow keys all work without custom code', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Bet frequency" value={40} onChange={() => {}} />)
    expect(html).toMatch(/<input[^>]*type="range"/)
    expect(html).toMatch(/min="0"/)
    expect(html).toMatch(/max="100"/)
    expect(html).toMatch(/step="1"/)
  })
})

describe('LessonSlider — accessibility', () => {
  it('carries the label as the input\'s accessible name', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Hero bet frequency" value={40} onChange={() => {}} />)
    expect(html).toContain('aria-label="Hero bet frequency"')
  })

  it('announces the FORMATTED value, so a screen reader says "65%" not "65"', () => {
    const html = renderToStaticMarkup(
      <LessonSlider label="Freq" value={65} onChange={() => {}} format={(v) => `${v}%`} />,
    )
    expect(html).toContain('aria-valuetext="65%"')
  })

  it('ties the drag hint to the input via aria-describedby', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Freq" value={40} onChange={() => {}} />)
    const described = /aria-describedby="([^"]+)"/.exec(html)
    expect(described).not.toBeNull()
    expect(html).toContain(`id="${described![1]}"`)
  })

  it('marks the input disabled rather than only dimming it', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Freq" value={40} onChange={() => {}} disabled />)
    expect(html).toMatch(/<input[^>]*disabled/)
  })

  it('hides the purely decorative track, bubble and ticks from screen readers', () => {
    const html = renderToStaticMarkup(
      <LessonSlider label="Freq" value={40} onChange={() => {}} ticks={['0%', '100%']} />,
    )
    // bubble + track + tick row are all aria-hidden; the input is the only node AT sees.
    expect(count(html, /aria-hidden="true"/g)).toBeGreaterThanOrEqual(3)
  })
})

describe('LessonSlider — discoverability', () => {
  it('shows a drag hint and the nudge animation before first interaction', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Freq" value={40} onChange={() => {}} />)
    expect(html).toContain('Drag to adjust')
    expect(html).toContain('sp-slider-nudge')
  })

  it('honours a custom hint', () => {
    const html = renderToStaticMarkup(
      <LessonSlider label="Freq" value={40} onChange={() => {}} hint="Slide to explore frequencies" />,
    )
    expect(html).toContain('Slide to explore frequencies')
    expect(html).not.toContain('Drag to adjust')
  })

  it('hint={null} suppresses both the text and the animation', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Freq" value={40} onChange={() => {}} hint={null} />)
    expect(html).not.toContain('Drag to adjust')
    expect(html).not.toContain('sp-slider-nudge')
    expect(html).not.toContain('aria-describedby')
  })

  it('pins the value bubble to the thumb, offset-corrected so it does not drift at the ends', () => {
    const html = renderToStaticMarkup(
      <LessonSlider label="Freq" value={72} onChange={() => {}} format={(v) => `${v}%`} showLabel={false} />,
    )
    expect(html).toContain('72%')
    // calc() offset is what keeps the bubble centred over a thumb whose centre
    // only travels (trackWidth - thumbWidth). Past the midpoint the correction
    // is negative, and the sign belongs in the operator.
    expect(html).toMatch(/left:calc\(72% - [\d.]+px\)/)
  })

  it('renders tick captions when given', () => {
    const html = renderToStaticMarkup(
      <LessonSlider label="Size" value={50} onChange={() => {}} ticks={['10%', 'Pot', '200%']} />,
    )
    expect(html).toContain('Pot')
    expect(html).toContain('200%')
  })

  it('always paints a visible filled track proportional to the value', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Freq" value={25} onChange={() => {}} />)
    expect(html).toMatch(/width:25%/)
  })
})

describe('LessonSlider — value handling', () => {
  it('does not NaN the thumb position when min === max (a single-stop range)', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Fixed" value={5} onChange={() => {}} min={5} max={5} />)
    expect(html).not.toContain('NaN')
  })

  it('positions correctly on a non-zero-based range', () => {
    const html = renderToStaticMarkup(<LessonSlider label="Size" value={105} onChange={() => {}} min={10} max={200} />)
    expect(html).toMatch(/width:50%/)
  })
})

describe('FrequencySlider — Module 10 wrapper', () => {
  it('no longer renders the +/- stepper buttons QA flagged', () => {
    const html = renderToStaticMarkup(<FrequencySlider label="Hero's bet frequency" value={50} onChange={() => {}} />)
    expect(count(html, /<button/g)).toBe(0)
    expect(html).not.toContain('Decrease')
    expect(html).not.toContain('Increase')
  })

  it('still renders one named, percentage-formatted slider', () => {
    const html = renderToStaticMarkup(<FrequencySlider label="Hero's bet frequency" value={50} onChange={() => {}} />)
    expect(count(html, /type="range"/g)).toBe(1)
    expect(html).toContain('aria-valuetext="50%"')
  })
})
