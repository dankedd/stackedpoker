/**
 * Curriculum-level coverage sweep for range_build_multi steps — the
 * multi-action sibling of rangePrefilledFoundation.test.ts. Every step that
 * asks the learner to build a full multi-action range from scratch should
 * start with a real, book-grounded "obvious core" foundation (see
 * threebetResponseBaselines.ts's THREEBET_RESPONSE_FOUNDATIONS for the
 * worked example), not a blank grid — unless it's deliberately a no-scaffold
 * recall/reconstruction exercise, in which case it's documented here, not
 * silently gapped.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { resolveMultiPrefilledAssignments, resolveMultiActionTargetChart } from '../multiActionRangePrefill'
import type { LessonStep } from '../types'

const allSteps: LessonStep[] = LESSONS.flatMap((l) => l.steps)
const multiBuildSteps = allSteps.filter((s) => s.type === 'range_build_multi')

/** Deliberately unscaffolded BY DESIGN — these are recall/reconstruction labs
 *  (the learner is being tested on what they already built earlier, not
 *  taught something new), never a "start from scratch and learn" tutorial.
 *  A step landing here is a conscious pedagogical call. */
const INTENTIONALLY_UNSCAFFOLDED: Record<string, string> = {
  'pool-recon-1': 'full-range reconstruction-from-memory lab, not a scaffolded build — starting empty is the point',
  'pool-recon-2': 'full-range reconstruction-from-memory lab, not a scaffolded build — starting empty is the point',
  'pool-recon-3': 'full-range reconstruction-from-memory lab, not a scaffolded build — starting empty is the point',
  'pool-recon-4': 'full-range reconstruction-from-memory lab, not a scaffolded build — starting empty is the point',
  'pool-recon-5': 'full-range reconstruction-from-memory lab, not a scaffolded build — starting empty is the point',
}

/** Genuine gaps matching the same pattern as sqz-s7a/trb-range-lab (Module 4),
 *  identified but NOT yet fixed — each needs its own book-grounded "obvious
 *  core" pick, same as those two, which is real per-step design work out of
 *  scope for the Module 4 pass that produced this test. Tracked explicitly
 *  (with the step's cell count) so this list is a to-do, not a blind spot —
 *  if a step here ever gains a real foundation, its entry becomes stale and
 *  the "still actually unscaffolded" check below will fail until it's removed.
 */
const KNOWN_GAPS_PENDING_FOLLOWUP: Record<string, string> = {
  'sb-build': 'Module 3 SB build-from-scratch exercise (159 cells) — same gap pattern as sqz-s7a, not yet designed',
  'co-s-build': 'Module 5 CO defend-range build (50 cells) — same gap pattern, not yet designed',
  'bb-s-build': 'Module 5 BB defend-range build (169 cells) — same gap pattern, not yet designed',
  'btn-s-build': 'Module 5 BTN defend-range build (58 cells) — same gap pattern, not yet designed',
  'sb-s-build': 'Module 5 SB defend-range build (46 cells) — same gap pattern, not yet designed',
}

describe('Module 4 range_build_multi exercises fixed by this pass have a real foundation', () => {
  it('trb-range-lab ("They Raised Back") starts with a substantial, book-grounded foundation', () => {
    const step = multiBuildSteps.find((s) => s.id === 'trb-range-lab')!
    const prefilled = resolveMultiPrefilledAssignments(step)
    expect(Object.keys(prefilled).length).toBeGreaterThan(40) // was 3 before this pass
  })
})

describe('Every range_build_multi step either has a real foundation or a documented reason not to', () => {
  it('no step is silently left with an empty foundation', () => {
    const offenders: string[] = []
    for (const step of multiBuildSteps) {
      const prefilled = resolveMultiPrefilledAssignments(step)
      const hasFoundation = Object.keys(prefilled).length > 0
      const isDocumented = step.id in INTENTIONALLY_UNSCAFFOLDED || step.id in KNOWN_GAPS_PENDING_FOLLOWUP
      if (!hasFoundation && !isDocumented) {
        offenders.push(`${step.id}: no foundation configured and not documented as intentional or a known gap`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every documented "intentionally unscaffolded" id still exists and is still actually unscaffolded', () => {
    const offenders: string[] = []
    for (const id of Object.keys(INTENTIONALLY_UNSCAFFOLDED)) {
      const step = multiBuildSteps.find((s) => s.id === id)
      if (!step) {
        offenders.push(`${id}: listed as intentionally unscaffolded but no longer exists as a range_build_multi step`)
        continue
      }
      if (Object.keys(resolveMultiPrefilledAssignments(step)).length > 0) {
        offenders.push(`${id}: listed as intentionally unscaffolded but now has a foundation — remove it from the map`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every documented "known gap" id still exists and is still actually a gap (stale entries must be removed when fixed)', () => {
    const offenders: string[] = []
    for (const id of Object.keys(KNOWN_GAPS_PENDING_FOLLOWUP)) {
      const step = multiBuildSteps.find((s) => s.id === id)
      if (!step) {
        offenders.push(`${id}: listed as a known gap but no longer exists as a range_build_multi step`)
        continue
      }
      if (Object.keys(resolveMultiPrefilledAssignments(step)).length > 0) {
        offenders.push(`${id}: listed as a known gap but now has a foundation — remove it from the map (fixed!)`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('Every foundation is a genuine, correctly-labeled subset of its own target chart', () => {
  for (const step of multiBuildSteps) {
    const prefilled = resolveMultiPrefilledAssignments(step)
    if (Object.keys(prefilled).length === 0) continue

    it(`${step.id}: every prefilled hand exists in the target chart with the SAME assigned action`, () => {
      const chart = resolveMultiActionTargetChart(step)
      expect(chart, `${step.id}: range_build_multi_chart "${step.range_build_multi_chart}" did not resolve`).toBeDefined()
      const targetByHand = new Map(chart!.cells.map((c) => [c.hand, c.actions]))
      const offenders: string[] = []
      for (const [hand, action] of Object.entries(prefilled)) {
        const targetActions = targetByHand.get(hand)
        if (!targetActions) {
          offenders.push(`${hand}: prefilled as "${action}" but absent from the target chart entirely`)
          continue
        }
        const targetAction = Object.keys(targetActions)[0]
        if (targetAction !== action) {
          offenders.push(`${hand}: prefilled as "${action}" but the target chart says "${targetAction}"`)
        }
      }
      expect(offenders).toEqual([])
    })

    // Transform-seed steps (range_build_multi_transform_from_chart) intentionally start
    // FULLY painted — the learner's job is to find and fix what's wrong, not build from
    // scratch — so "never the whole target" only applies to real prefilled foundations.
    if (!step.range_build_multi_transform_from_chart) {
      it(`${step.id}: the foundation is never the WHOLE target (a real decision must remain)`, () => {
        const chart = resolveMultiActionTargetChart(step)!
        expect(Object.keys(prefilled).length).toBeLessThan(chart.cells.length)
      })
    }
  }
})
