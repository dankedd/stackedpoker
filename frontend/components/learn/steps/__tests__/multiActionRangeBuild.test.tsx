/**
 * Render-level regression tests for MultiActionRangeBuild.tsx, mirroring
 * rangeBuildPrefill.test.tsx's approach (renderToStaticMarkup, no jsdom) for the
 * new multi-action (raise/limp/jam/fold) range builder introduced for the Module 3
 * MTT RFI upgrade.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MultiActionRangeBuild } from '../MultiActionRangeBuild'
import { LESSONS } from '@/lib/learn/curriculum'
import { MTT_LAB_POOL } from '@/lib/learn/mttRfiLabPool'
import type { LessonStep } from '@/lib/learn/types'

const noop = () => {}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1
}

const allCurriculumSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const multiSteps = allCurriculumSteps.filter((s) => s.type === 'range_build_multi')

describe('MultiActionRangeBuild — every curriculum range_build_multi step renders without throwing', () => {
  it('there is at least one such step (regression guard)', () => {
    expect(multiSteps.length).toBeGreaterThan(0)
  })

  for (const step of multiSteps) {
    it(`${step.id} (${step.range_build_multi_chart}) renders a full 169-cell grid`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(countOccurrences(html, 'aspect-square')).toBe(169)
    })
  }
})

describe('MultiActionRangeBuild — prefilled foundation is visible on first paint', () => {
  const withPrefill = multiSteps.find((s) => s.range_build_multi_prefilled_key)
  it('has at least one real curriculum step with a prefilled foundation', () => {
    expect(withPrefill).toBeTruthy()
  })

  it('shows the "Reset to foundation" action and a non-zero starting Hands count', () => {
    const html = renderToStaticMarkup(<MultiActionRangeBuild step={withPrefill!} onAnswer={noop} />)
    expect(html).toContain('Reset to foundation')
    const match = html.match(/>(\d+)<\/span><span[^>]*>Hands</)
    expect(match).toBeTruthy()
    expect(Number(match![1])).toBeGreaterThan(0)
  })
})

describe('MultiActionRangeBuild — every curriculum range_build_multi step displays its effective stack depth', () => {
  // Every real range_build_multi step in the curriculum already authors
  // hero_position/effective_stack_bb (positionLessonBuilder.ts, the SB/UTG
  // mastery lessons, "They Raised Back", every "Defending as X" lesson, and
  // the Preflop Range Mastery Lab pool all pair these fields together) — this
  // sweep guards that the shared ScenarioMeta line actually renders for all
  // of them, not just a hand-picked fixture.
  for (const step of multiSteps) {
    it(`${step.id} shows "${step.hero_position} · ${step.effective_stack_bb}BB EFFECTIVE"`, () => {
      expect(step.hero_position, `${step.id} is missing hero_position`).toBeTruthy()
      expect(step.effective_stack_bb, `${step.id} is missing effective_stack_bb`).not.toBeUndefined()
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(html).toContain(`>${step.hero_position}<`)
      expect(html).toContain('BB EFFECTIVE')
    })
  }
})

describe('MultiActionRangeBuild — action toolbar matches the target chart\'s real action set', () => {
  const mttSteps = multiSteps.filter((s) => s.range_build_multi_domain !== 'threebet_response').slice(0, 6)
  for (const step of mttSteps) {
    it(`${step.id} offers at least Raise and Fold chips`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(html).toContain('>Raise<')
      expect(html).toContain('>Fold<')
    })
  }

  const threebetResponseSteps = multiSteps.filter((s) => s.range_build_multi_domain === 'threebet_response')
  for (const step of threebetResponseSteps) {
    it(`${step.id} offers 4-Bet, Call, and Fold chips`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      expect(html).toContain('>4-Bet<')
      expect(html).toContain('>Call<')
      expect(html).toContain('>Fold<')
    })
  }
})

describe('MultiActionRangeBuild — initial activeAction can safely be any generalized MultiRangeAction', () => {
  // The reported production build error was `useState<MttAction>(offeredActions[0] ?? 'fold')`
  // rejecting a generalized action (e.g. 'call', '4bet') as the initial value. These steps force
  // each of the 6 actions in the union into `offeredActions[0]` specifically (not just "present
  // somewhere in the toolbar") via the explicit range_build_multi_actions override, so the very
  // state initializer the bug was in is exercised for every action, not just the MTT subset.
  const ALL_ACTIONS = ['fold', 'raise', 'limp', 'jam', '4bet', 'call'] as const

  for (const action of ALL_ACTIONS) {
    it(`renders with '${action}' active (ringed) on first paint when it is offeredActions[0]`, () => {
      const step: LessonStep = {
        id: `test-first-action-${action}`,
        type: 'range_build_multi',
        range_build_multi_actions: [action, 'fold'],
      }
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={step} onAnswer={noop} />)
      // No throw is itself the primary regression guard (this exact construction is what
      // crashed the production build). Also confirm the toolbar rendered this action.
      const label = action === '4bet' ? '4-Bet' : action[0].toUpperCase() + action.slice(1)
      expect(html).toContain(`>${label}<`)
      expect(html).toContain('ring-white/40')
    })
  }
})

describe('MultiActionRangeBuild — Lab pool reconstruction questions render too', () => {
  const reconQuestions = MTT_LAB_POOL.filter((q) => q.category === 'reconstruction')

  it('has reconstruction questions to test', () => {
    expect(reconQuestions.length).toBeGreaterThan(0)
  })

  for (const q of reconQuestions) {
    it(`${q.id} renders without a prefilled foundation (true no-assist mastery check)`, () => {
      const html = renderToStaticMarkup(<MultiActionRangeBuild step={q.stepTemplate} onAnswer={noop} />)
      expect(countOccurrences(html, 'aspect-square')).toBe(169)
      expect(html).not.toContain('Reset to foundation')
    })
  }
})
