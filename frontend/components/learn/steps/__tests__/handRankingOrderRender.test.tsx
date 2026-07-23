import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HandRankingOrder } from '../HandRankingOrder'
import { shuffleBySeed } from '@/lib/learn/interactionSafety'
import { LESSONS } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

const ALL_STEPS: LessonStep[] = LESSONS.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = ALL_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in curriculum — did content change?`)
  return step
}

const step = findStep('l1-s11')
const items = step.hand_ranking_order_items ?? []
const correctOrder = items.map((i) => i.id)

describe('HandRankingOrder initial render (pre-submission)', () => {
  const html = renderToStaticMarkup(<HandRankingOrder step={step} onAnswer={() => {}} />)

  it('renders all 10 category labels', () => {
    for (const item of items) {
      expect(html).toContain(item.label)
    }
  })

  it('never reveals the correct order before submission — no "Correct order" panel, no Continue button', () => {
    expect(html).not.toContain('Correct order — strongest to weakest')
    expect(html).not.toContain('Continue')
  })

  it('shows the "Check order" submission control, not a pre-scored result', () => {
    expect(html).toContain('Check order')
    expect(html).not.toMatch(/Perfect Play/i)
    expect(html).not.toMatch(/Score:\s*\d+\/100/i)
    expect(html).not.toMatch(/\+\d+\s*XP/i)
  })

  it('is genuinely shuffled — categories render in the same deterministic order shuffleBySeed produces, not the authored (correct) order', () => {
    const shuffledIds = shuffleBySeed(correctOrder, step.id)
    // data-category-id is a stable, collision-free marker per item (label text
    // alone collides, e.g. "Straight" is a substring of "Straight Flush").
    const idPositions = shuffledIds.map((id) => html.indexOf(`data-category-id="${id}"`))
    expect(idPositions.every((p) => p >= 0)).toBe(true)
    const sorted = [...idPositions].sort((a, b) => a - b)
    expect(idPositions).toEqual(sorted)
  })

  it('does not render in the exact strongest-to-weakest authored order', () => {
    const authoredIdPositions = correctOrder.map((id) => html.indexOf(`data-category-id="${id}"`))
    const sorted = [...authoredIdPositions].sort((a, b) => a - b)
    expect(authoredIdPositions).not.toEqual(sorted)
  })
})

describe('HandRankingOrder never calls onAnswer merely from rendering', () => {
  it('onAnswer is not invoked just by mounting the component', () => {
    const onAnswer = vi.fn()
    renderToStaticMarkup(<HandRankingOrder step={step} onAnswer={onAnswer} />)
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
