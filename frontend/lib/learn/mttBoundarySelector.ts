/**
 * Deterministic boundary-hand selection for position-lesson drills and the Lab.
 *
 * "Boundary-heavy" practice (per the module's design goal — most drill questions should test
 * hands near a real strategic transition, not obvious premiums/trash) needs a principled,
 * data-driven definition of "boundary," not a hand-picked list. This file supplies one:
 * mixed-frequency hands score highest (they ARE the boundary by definition); pure hands that
 * sit immediately next to a sharp non-fold-weight jump (same suited/offsuit/pair shape, one
 * rank over) score next; everything else pure is "core." A dedicated control-hand selector
 * then picks the most EXTREME core hands (closest to a pure 100%-play or 100%-fold) as the
 * "obvious sanity check" quota, leaving the rest of core for "representative" questions.
 * Everything here is derived purely from MTT_RFI_CHARTS — no hand-authored boundary list exists.
 */
import { MTT_RFI_CHARTS, type MttPositionKey, type MttRfiChart, type MttStackBB } from './mttRfiBaselines'
import { isMixedHand } from './mttRfiRanges'
import { HAND_GRID, comboCount } from './handGrid'
import { shuffleBySeed } from './interactionSafety'

export type BoundaryKind = 'mixed' | 'geometric_edge' | 'core'

export interface BoundaryClassification {
  hand: string
  score: number
  kind: BoundaryKind
  /** 0-1: how much of the chart's strategy plays this hand at all (1 - fold frequency). Used
   *  to pick "control" anchors (extremity closest to 0 or 1) out of the 'core' bucket. */
  nonFold: number
}

/** Combo-weighted non-fold-weight jump (in "combo units") above which a pure hand counts as
 *  sitting right at a real strategic edge rather than deep in the core or deep in the fold. */
const GEOMETRIC_EDGE_THRESHOLD = 1.5

type Shape = 'pair' | 'suited' | 'offsuit'

function shapeOf(row: number, col: number): Shape {
  return row === col ? 'pair' : row < col ? 'suited' : 'offsuit'
}

function buildHandCoords(): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>()
  HAND_GRID.forEach((row, r) => row.forEach((hand, c) => map.set(hand, [r, c])))
  return map
}

const HAND_COORDS = buildHandCoords()

function nonFoldWeight(chart: MttRfiChart, hand: string): number {
  const cell = chart.cells.find((c) => c.hand === hand)
  if (!cell) return 0
  return 1 - (cell.actions.fold ?? 0)
}

/**
 * Ranks all 169 hand classes in `chart` by "boundary-ness":
 * - `mixed`: the chart's own real mixed-frequency hands (highest priority — these ARE boundaries).
 * - `geometric_edge`: pure hands adjacent (same shape, one rank over, row/col ±1 or diagonal ±1)
 *   to a hand with a big non-fold-weight jump.
 * - `core`: every other hand class — real strategic content, but not a mixed hand and not
 *   sitting at a sharp transition. Includes both "obviously always played" and "obviously
 *   always folded" hands; `selectDrillQuestions` further splits this bucket by extremity.
 */
export function classifyHandBoundaries(chart: MttRfiChart): BoundaryClassification[] {
  const results: BoundaryClassification[] = []

  for (const [hand, [row, col]] of HAND_COORDS) {
    const cell = chart.cells.find((c) => c.hand === hand)
    const nonFold = nonFoldWeight(chart, hand)

    if (cell && isMixedHand(cell.actions)) {
      results.push({ hand, kind: 'mixed', score: 100 + nonFold * 20, nonFold })
      continue
    }

    const shape = shapeOf(row, col)
    const deltas: [number, number][] = [
      [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1],
    ]
    let maxEdge = 0
    for (const [dr, dc] of deltas) {
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr > 12 || nc < 0 || nc > 12) continue
      if (shapeOf(nr, nc) !== shape) continue
      const neighborHand = HAND_GRID[nr][nc]
      const neighborNonFold = nonFoldWeight(chart, neighborHand)
      const edge = Math.abs(nonFold - neighborNonFold) * comboCount(hand)
      if (edge > maxEdge) maxEdge = edge
    }

    if (maxEdge >= GEOMETRIC_EDGE_THRESHOLD) {
      results.push({ hand, kind: 'geometric_edge', score: 50 + maxEdge, nonFold })
    } else {
      results.push({ hand, kind: 'core', score: 20 + nonFold * 5, nonFold })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

export interface DrillQuestionRef {
  chartKey: string
  hand: string
}

const ALL_STACKS: MttStackBB[] = [15, 25, 40, 60]
const BOUNDARY_KINDS: BoundaryKind[] = ['mixed', 'geometric_edge']

/** Extremity of a core hand: how close its non-fold weight is to a pure 0 or a pure 1 — the
 *  higher, the more "obviously always played" or "obviously always folded" it is. */
function extremity(nonFold: number): number {
  return Math.max(nonFold, 1 - nonFold)
}

function drawBoundary(position: MttPositionKey, target: number, seed: string): DrillQuestionRef[] {
  if (target <= 0) return []
  const perDepth = Math.ceil(target / ALL_STACKS.length)
  const pool: DrillQuestionRef[] = []

  for (const stackBB of ALL_STACKS) {
    const chartKey = `${position}_RFI_${stackBB}BB`
    const chart = MTT_RFI_CHARTS[chartKey]
    if (!chart) continue
    const classified = classifyHandBoundaries(chart).filter((c) => BOUNDARY_KINDS.includes(c.kind))
    const shuffled = shuffleBySeed(classified, `${seed}:${chartKey}:boundary`)
    for (const c of shuffled.slice(0, perDepth)) {
      pool.push({ chartKey, hand: c.hand })
    }
  }

  return shuffleBySeed(pool, `${seed}:boundary:final`).slice(0, target)
}

/** Splits each depth's 'core' bucket into a small "most extreme" slice (for control anchors)
 *  and the remainder (for representative questions) — disjoint, so the same hand never fills
 *  both quotas in one attempt. */
function drawCoreSplit(
  position: MttPositionKey,
  controlTarget: number,
  representativeTarget: number,
  seed: string,
): { control: DrillQuestionRef[]; representative: DrillQuestionRef[] } {
  const perDepthControl = controlTarget > 0 ? Math.ceil(controlTarget / ALL_STACKS.length) : 0
  const perDepthRep = representativeTarget > 0 ? Math.ceil(representativeTarget / ALL_STACKS.length) : 0
  const controlPool: DrillQuestionRef[] = []
  const repPool: DrillQuestionRef[] = []

  for (const stackBB of ALL_STACKS) {
    const chartKey = `${position}_RFI_${stackBB}BB`
    const chart = MTT_RFI_CHARTS[chartKey]
    if (!chart) continue
    const core = classifyHandBoundaries(chart).filter((c) => c.kind === 'core')
    const byExtremity = [...core].sort((a, b) => extremity(b.nonFold) - extremity(a.nonFold))
    const controlSliceSize = Math.min(byExtremity.length, Math.max(perDepthControl * 3, perDepthControl))
    const controlCandidates = byExtremity.slice(0, controlSliceSize)
    const repCandidates = byExtremity.slice(controlSliceSize)

    for (const c of shuffleBySeed(controlCandidates, `${seed}:${chartKey}:control`).slice(0, perDepthControl)) {
      controlPool.push({ chartKey, hand: c.hand })
    }
    for (const c of shuffleBySeed(repCandidates, `${seed}:${chartKey}:rep`).slice(0, perDepthRep)) {
      repPool.push({ chartKey, hand: c.hand })
    }
  }

  return {
    control: shuffleBySeed(controlPool, `${seed}:control:final`).slice(0, controlTarget),
    representative: shuffleBySeed(repPool, `${seed}:rep:final`).slice(0, representativeTarget),
  }
}

/**
 * Deterministically draws `count` (chart, hand) questions for `position`, stratified across
 * all 4 canonical stack depths, targeting ~75% boundary (mixed + geometric_edge) / ~18%
 * representative (core, mid-range) / ~8% control (core, most extreme) — per the module's
 * boundary-heavy practice design. Fully seed-deterministic via `shuffleBySeed`.
 */
export function selectDrillQuestions(position: MttPositionKey, count: number, seed: string): DrillQuestionRef[] {
  const boundaryTarget = Math.round(count * 0.75)
  const representativeTarget = Math.round(count * 0.185)
  const controlTarget = Math.max(count - boundaryTarget - representativeTarget, 0)

  const boundary = drawBoundary(position, boundaryTarget, seed)
  const { control, representative } = drawCoreSplit(position, controlTarget, representativeTarget, seed)

  const combined = [...boundary, ...representative, ...control]
  return shuffleBySeed(combined, `${seed}:combined`).slice(0, count)
}
