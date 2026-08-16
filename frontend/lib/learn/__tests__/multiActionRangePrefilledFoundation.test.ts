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

/**
 * Steps whose foundation is deliberately SMALL, with the reason recorded.
 *
 * Distinct from KNOWN_GAPS_PENDING_FOLLOWUP above: those have no foundation at
 * all and want one. These have a real, verified foundation that is short on
 * purpose, and enlarging it would either invent theory or give away the
 * exercise. The reason is stored, not just asserted, so a future reader does
 * not re-open a decision that has already been made.
 */
const DELIBERATELY_MINIMAL_FOUNDATIONS: Record<string, { hands: Record<string, string>; why: string }> = {
  'trb-range-lab': {
    hands: { AA: '4bet', KK: '4bet', QQ: '4bet' },
    why:
      'Two independent reasons, either of which is sufficient. (1) NO SOURCE: this step\'s ' +
      'target chart, BTN_vs_BB_3bet_response, is documented in threebetResponseBaselines.ts as ' +
      'an ILLUSTRATIVE CONSTRUCTION — Modern Poker Theory gives only AGGREGATE frequencies for ' +
      'the 3-bet RESPONSE side (8.6/47.3/44.5 for BTN vs BB), and no hand-level chart exists ' +
      'anywhere in the book or in this codebase. There is therefore nothing book-grounded to ' +
      'expand a foundation FROM; a larger core would be a hand-picked selection presented as ' +
      'reviewed theory. (2) PEDAGOGY: the step\'s own on-screen note promises exactly "the clear ' +
      'value 4-bets (AA-QQ)", and the concept_reveal that follows it (trb-range-lab-rule) teaches ' +
      'the blocker 4-bets A5s/A4s as its payoff. Prefilling those would hand the learner the ' +
      'lesson\'s own punchline, and prefilling 40 of the chart\'s 78 hands would leave barely ' +
      'half a decision behind the 6-hand tolerance.',
  },
}

describe('trb-range-lab has the foundation its own copy promises, and no more', () => {
  const step = multiBuildSteps.find((s) => s.id === 'trb-range-lab')!
  const expected = DELIBERATELY_MINIMAL_FOUNDATIONS['trb-range-lab']

  it('starts from exactly the premium 4-bet core the step tells the learner it filled in', () => {
    // The real invariant worth defending here is not a hand COUNT — it is that
    // the on-screen promise and the data agree. A step that says "we filled in
    // AA-QQ" and then fills in something else is a bug a learner will hit; a
    // step that fills in three hands when someone once expected forty is not.
    expect(resolveMultiPrefilledAssignments(step)).toEqual(expected.hands)
  })

  it('says on screen what it actually prefilled', () => {
    expect(step.range_build_multi_prefilled_note).toMatch(/AA-QQ/)
  })

  it('does NOT give away the blocker 4-bets the following lesson step exists to teach', () => {
    // trb-range-lab-rule's payoff is "A5s/A4s aren't strong hands, but the Ace
    // blocker plus suited playability makes them better 4-bets than calls".
    // Prefilling them would answer the question before it is asked.
    const prefilled = resolveMultiPrefilledAssignments(step)
    expect(Object.keys(prefilled)).not.toContain('A5s')
    expect(Object.keys(prefilled)).not.toContain('A4s')
  })

  it('leaves the overwhelming majority of the chart for the learner to build', () => {
    const chart = resolveMultiActionTargetChart(step)!
    const prefilled = Object.keys(resolveMultiPrefilledAssignments(step)).length
    expect(prefilled / chart.cells.length).toBeLessThan(0.1)
  })
})

describe('every deliberately-minimal foundation is still minimal and still documented', () => {
  it('none has quietly grown or been emptied', () => {
    const offenders: string[] = []
    for (const [id, entry] of Object.entries(DELIBERATELY_MINIMAL_FOUNDATIONS)) {
      const step = multiBuildSteps.find((s) => s.id === id)
      if (!step) {
        offenders.push(`${id}: documented as deliberately minimal but no longer exists`)
        continue
      }
      const prefilled = resolveMultiPrefilledAssignments(step)
      if (Object.keys(prefilled).length !== Object.keys(entry.hands).length) {
        offenders.push(
          `${id}: foundation is now ${Object.keys(prefilled).length} hands, documented as ` +
            `${Object.keys(entry.hands).length}. Update the entry (and its reason) or revert.`,
        )
      }
      if (!entry.why.trim()) offenders.push(`${id}: no reason recorded`)
    }
    expect(offenders).toEqual([])
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

    // Transform-seed steps are EXCLUDED from this assertion, for the same
    // reason the "never the whole target" check below excludes them: their
    // seed is deliberately a DIFFERENT chart from the target — a neighbouring
    // position's range, or in trb-repair-fix's case a chart literally named
    // `..._flawed_example`. Finding where the seed disagrees with the target
    // IS the exercise, so requiring the seed to agree with the target asserts
    // that these steps have nothing for the learner to do. The guard was
    // applied to the second assertion and missed on this one.
    if (step.range_build_multi_transform_from_chart) continue

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
