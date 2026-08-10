import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import { resolveMultiActionTargetChart } from '../multiActionRangePrefill'
import { dominantAction } from '../rangeStrategy'
import { fromActionDict } from '../rangeStrategy'

/**
 * Guards the fix for "ringed puzzle hands appear on the Build-step reveal with
 * no explanation of what they mean" (Module 5, Defending as CO). Every
 * range_build_multi_puzzle_hands entry must have a matching
 * range_build_multi_puzzle_notes entry, and that note's claimed `action` must
 * match what the target chart actually says for that hand — explanatory copy
 * for an already-graded fact, never a second, driftable source of truth.
 */
describe('range_build_multi_puzzle_notes — every puzzle hand is explained and correctly labeled', () => {
  const stepsWithPuzzleHands = LESSONS.flatMap((l) => l.steps).filter(
    (s) => s.type === 'range_build_multi' && (s.range_build_multi_puzzle_hands?.length ?? 0) > 0,
  )

  it('found a substantial number of steps with puzzle hands to check (sanity guard)', () => {
    expect(stepsWithPuzzleHands.length).toBeGreaterThan(0)
  })

  for (const step of stepsWithPuzzleHands) {
    describe(`${step.id}`, () => {
      const notesByHand = new Map((step.range_build_multi_puzzle_notes ?? []).map((n) => [n.hand, n]))
      const chart = resolveMultiActionTargetChart(step)

      it('every puzzle hand has a matching note (no unexplained ring)', () => {
        const missing = (step.range_build_multi_puzzle_hands ?? []).filter((h) => !notesByHand.has(h))
        expect(missing).toEqual([])
      })

      it('every note has non-empty explanation and rule text', () => {
        const empty = [...notesByHand.values()].filter((n) => !n.explanation.trim() || !n.rule.trim() || !n.concept.trim())
        expect(empty).toEqual([])
      })

      it('every note is a genuine subset of range_build_multi_puzzle_hands (no orphaned note)', () => {
        const hands = new Set(step.range_build_multi_puzzle_hands ?? [])
        const orphaned = [...notesByHand.keys()].filter((h) => !hands.has(h))
        expect(orphaned).toEqual([])
      })

      it('every note\'s claimed action matches the target chart\'s real action for that hand', () => {
        expect(chart, `${step.id}: range_build_multi_chart did not resolve`).toBeDefined()
        const offenders: string[] = []
        for (const note of notesByHand.values()) {
          const cell = chart!.cells.find((c) => c.hand === note.hand)
          const realAction = cell ? dominantAction(fromActionDict(cell.actions)) : 'fold'
          if (realAction !== note.action) {
            offenders.push(`${note.hand}: note claims "${note.action}" but the chart's dominant action is "${realAction}"`)
          }
        }
        expect(offenders).toEqual([])
      })
    })
  }
})
