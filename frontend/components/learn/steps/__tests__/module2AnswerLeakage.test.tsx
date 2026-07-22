import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PotOddsExplorer } from '../PotOddsExplorer'
import { EquityBalance } from '../EquityBalance'
import { OutsDeckVisualizer } from '../OutsDeckVisualizer'
import { BluffBreakEvenVisualizer } from '../BluffBreakEvenVisualizer'
import { EVDecisionTree } from '../EVDecisionTree'
import { EquityPredict } from '../EquityPredict'
import { DecisionSpot } from '../DecisionSpot'
import { LESSONS_BY_MODULE } from '@/lib/learn/curriculum'
import type { LessonStep } from '@/lib/learn/types'

/**
 * Module 2 answer-leakage regression suite.
 *
 * Renders the real Module 2 step components with `react-dom/server` —
 * `renderToStaticMarkup` gives us the INITIAL (pre-submission, effects never
 * run) HTML for free, no jsdom/RTL/new dependencies required, which is
 * exactly the state that must never contain the answer. Passing
 * `reviewMode` renders the same component in its "solution revealed" state,
 * standing in for what a learner sees after submitting (see each component's
 * `showSolution = submitted || reviewMode` gate).
 */

const MODULE2_STEPS: LessonStep[] = (LESSONS_BY_MODULE['math-foundations-module'] ?? []).flatMap(
  (lesson) => lesson.steps,
)

function findStep(id: string): LessonStep {
  const step = MODULE2_STEPS.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in Module 2 — did curriculum content change?`)
  return step
}

const noop = () => {}

describe('1. Pot odds — poc-s3 ("What percentage of the final pot is Hero risking?", correct = 25%)', () => {
  const step = findStep('poc-s3')

  it('does NOT render the required-equity answer before submission', () => {
    const html = renderToStaticMarkup(<PotOddsExplorer step={step} onAnswer={noop} />)
    expect(html).not.toContain('25.0%')
    expect(html).not.toMatch(/Required equity[^<]*<\/p><p[^>]*>25/)
  })

  it('DOES render the required-equity answer in review mode (post-submission equivalent)', () => {
    const html = renderToStaticMarkup(<PotOddsExplorer step={step} onAnswer={noop} reviewMode />)
    expect(html).toContain('25.0%')
  })
})

describe('2. Slider defaults never start on the correct answer', () => {
  it('poc-s3 (correct 25%) does not initialize the challenge slider at 25', () => {
    const step = findStep('poc-s3')
    const html = renderToStaticMarkup(<PotOddsExplorer step={step} onAnswer={noop} />)
    expect(html).not.toContain('>25%<')
    expect(html).not.toContain('Lock in 25%')
  })

  it('wws-s3 (bluff break-even, correct 50%) does not initialize at 50', () => {
    const step = findStep('wws-s3')
    const html = renderToStaticMarkup(<BluffBreakEvenVisualizer step={step} onAnswer={noop} />)
    expect(html).not.toContain('Lock in 50%')
  })

  it('cyw-s8 (clean outs, correct 6) does not initialize the slider at 6', () => {
    const step = findStep('cyw-s8')
    const html = renderToStaticMarkup(<OutsDeckVisualizer step={step} onAnswer={noop} />)
    expect(html).not.toContain('Lock in 6')
  })
})

describe('3. Equity — hand-vs-range prediction never shows the actual equity up front', () => {
  it('ysp-s3 (A-K vs QQ, actual equity 43%) starts at a neutral 50% guess, not 43%', () => {
    const step = findStep('ysp-s3')
    const html = renderToStaticMarkup(<EquityPredict step={step} onAnswer={noop} />)
    expect(html).not.toContain('43%')
    expect(html).toContain('50')
  })
})

describe('4. Outs — clean/dirty split is not pre-solved', () => {
  const step = findStep('cyw-s8') // 8 nominal outs, 6 clean, 2h/Jh dirty

  it('does not reveal the clean-out count, the dirty count, or which specific cards are dirty before submission', () => {
    const html = renderToStaticMarkup(<OutsDeckVisualizer step={step} onAnswer={noop} />)
    // "Clean outs" / "Dirty" stat tiles must be masked
    expect(html).not.toMatch(/Clean outs[^<]*<\/p><p[^>]*>6/)
    expect(html).not.toMatch(/Dirty[^<]*<\/p><p[^>]*>2/)
    // no deck tile should render in the dashed "dead" (dirty) visual state
    expect(html).not.toContain('border-dashed')
  })

  it('reveals the clean/dirty breakdown in review mode', () => {
    const html = renderToStaticMarkup(<OutsDeckVisualizer step={step} onAnswer={noop} reviewMode />)
    expect(html).toContain('border-dashed') // 6h / Jh now shown as dead/dirty
  })
})

describe('5. EV — total EV and per-branch contributions are not pre-solved for a classify question', () => {
  const step = findStep('ev-lab1') // WIN 50%/+100, LOSE 50%/-100 -> 0 EV; options present

  it('does not render the computed total EV before submission', () => {
    const html = renderToStaticMarkup(<EVDecisionTree step={step} onAnswer={noop} />)
    expect(html).not.toMatch(/Total EV[^<]*<\/span><span[^>]*>\+?0\.0/)
  })

  it('reveals the total EV in review mode', () => {
    const html = renderToStaticMarkup(<EVDecisionTree step={step} onAnswer={noop} reviewMode />)
    expect(html).toMatch(/Total EV/)
    expect(html).toContain('+0.0')
  })

  it('a pure-reveal ev_tree step (no options, e.g. ev-s5) is allowed to show the math immediately', () => {
    const step = findStep('ev-s5')
    expect(step.options ?? []).toHaveLength(0)
    const html = renderToStaticMarkup(<EVDecisionTree step={step} onAnswer={noop} />)
    expect(html).toMatch(/Total EV/)
  })
})

describe('6. Fold equity — required fold % is not pre-solved', () => {
  const step = findStep('wws-s3') // pot 100, bet 100 -> 50% required

  it('does not render the required fold percentage before submission', () => {
    const html = renderToStaticMarkup(<BluffBreakEvenVisualizer step={step} onAnswer={noop} />)
    expect(html).not.toMatch(/Required fold %[^<]*<\/p><p[^>]*>50\.0%/)
  })

  it('reveals the required fold percentage in review mode', () => {
    const html = renderToStaticMarkup(<BluffBreakEvenVisualizer step={step} onAnswer={noop} reviewMode />)
    expect(html).toMatch(/Required fold %[^<]*<\/p><p[^>]*>50\.0%/)
  })
})

describe('6b. Equity balance — the ahead/behind verdict is not pre-solved', () => {
  const step = findStep('poc-s8') // required 25, actual 32 -> "ahead" / CALL

  it('does not render the break-even verdict sentence before submission', () => {
    const html = renderToStaticMarkup(<EquityBalance step={step} onAnswer={noop} />)
    expect(html).not.toMatch(/clears the break-even line/)
  })

  it('reveals the verdict in review mode', () => {
    const html = renderToStaticMarkup(<EquityBalance step={step} onAnswer={noop} reviewMode />)
    expect(html).toMatch(/clears the break-even line/)
  })
})

describe('7. Multiple choice — no option is visually distinguished before selection', () => {
  it('decision_spot (ev-s6) renders every option button with identical classes pre-selection', () => {
    const step = findStep('ev-s6')
    const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)
    const classAttrs = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1])
    expect(classAttrs.length).toBeGreaterThan(1)
    expect(new Set(classAttrs).size).toBe(1) // every button shares one class string
  })

  it('option display order is not fixed to authoring order across different steps (regression for the ~96%-first-option bias)', () => {
    // Every one of these Module 2 decision_spot steps has its correct option
    // authored first in curriculum.ts. After shuffling by step id, they should
    // not all still render "their" first-authored option in the first slot.
    const ids = ['ev-s3a', 'ev-s3b', 'ev-s3c', 'ev-s8a', 'ev-s8b', 'ev-lab1', 'ev-lab2', 'eqr-s6', 'eqr-s9']
    const firstRenderedLabels = ids.map((id) => {
      const step = findStep(id)
      const html = renderToStaticMarkup(<DecisionSpot step={step} onAnswer={noop} />)
      const firstLabelMatch = html.match(/<span class="relative">([^<]*)<\/span>/)
      return firstLabelMatch?.[1]
    })
    const firstAuthoredLabels = ids.map((id) => findStep(id).options?.[0]?.label)
    const matchesAuthoredOrder = firstRenderedLabels.filter((label, i) => label === firstAuthoredLabels[i]).length
    // If the shuffle were a no-op, all 9 would match; a real shuffle should break most of them.
    expect(matchesAuthoredOrder).toBeLessThan(ids.length)
  })
})

describe('8. Review mode does not silently no-op — it actually changes output for every fixed component', () => {
  const cases: Array<{ name: string; step: LessonStep; render: (reviewMode: boolean) => string }> = [
    {
      name: 'PotOddsExplorer',
      step: findStep('poc-s3'),
      render: (reviewMode) => renderToStaticMarkup(<PotOddsExplorer step={findStep('poc-s3')} onAnswer={noop} reviewMode={reviewMode} />),
    },
    {
      name: 'EquityBalance',
      step: findStep('poc-s8'),
      render: (reviewMode) => renderToStaticMarkup(<EquityBalance step={findStep('poc-s8')} onAnswer={noop} reviewMode={reviewMode} />),
    },
    {
      name: 'OutsDeckVisualizer',
      step: findStep('cyw-s8'),
      render: (reviewMode) => renderToStaticMarkup(<OutsDeckVisualizer step={findStep('cyw-s8')} onAnswer={noop} reviewMode={reviewMode} />),
    },
    {
      name: 'BluffBreakEvenVisualizer',
      step: findStep('wws-s3'),
      render: (reviewMode) => renderToStaticMarkup(<BluffBreakEvenVisualizer step={findStep('wws-s3')} onAnswer={noop} reviewMode={reviewMode} />),
    },
    {
      name: 'EVDecisionTree',
      step: findStep('ev-lab1'),
      render: (reviewMode) => renderToStaticMarkup(<EVDecisionTree step={findStep('ev-lab1')} onAnswer={noop} reviewMode={reviewMode} />),
    },
  ]

  for (const { name, render } of cases) {
    it(`${name}: reviewMode=true output differs from the default (unanswered) output`, () => {
      const before = render(false)
      const after = render(true)
      expect(after).not.toBe(before)
    })
  }
})
