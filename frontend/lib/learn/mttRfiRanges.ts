/**
 * Resolution/adapter layer over the canonical MTT RFI chart data in `mttRfiBaselines.ts`.
 * Sits on top of that file the same way `ranges.ts` sits on top of `preflopBaselines.ts`.
 */

import {
  MTT_RFI_CHARTS,
  type MttAction,
  type MttRfiActionFrequencies,
  type MttRfiChart,
} from './mttRfiBaselines'
import { HAND_GRID } from './handGrid'

export function resolveMttChart(key: string): MttRfiChart | undefined {
  return MTT_RFI_CHARTS[key]
}

/** Hands where `action` has any non-zero frequency — membership-style, for simple displays. */
export function chartHandsByAction(chart: MttRfiChart, action: MttAction): string[] {
  return chart.cells.filter((c) => (c.actions[action] ?? 0) > 0).map((c) => c.hand)
}

/**
 * Dominant (highest-frequency) action per hand, defaulting hands absent from the
 * sparse `cells` list to 'fold' — this is what feeds a single-action-per-cell display
 * (e.g. `PokerRangeGrid`'s `three_action` mode).
 */
export function chartToDominantActionMap(chart: MttRfiChart): Record<string, MttAction> {
  const map: Record<string, MttAction> = {}
  for (const cell of chart.cells) {
    let best: MttAction = 'fold'
    let bestFreq = -1
    for (const [action, freq] of Object.entries(cell.actions) as [MttAction, number][]) {
      if (freq > bestFreq) {
        best = action
        bestFreq = freq
      }
    }
    map[cell.hand] = best
  }
  return map
}

/**
 * Adapter for the one naming collision in the codebase: the book/this module's `MttAction`
 * calls the all-in action 'jam'; the existing `PokerRangeGrid`/`preflopBaselines.ts` display
 * convention calls it 'shove'. Rather than rename the existing type (blast radius: every
 * existing 'three_action' display, `RFI_SHALLOW_ACTIONS`, `RangeHeatmap.tsx`), this is the
 * sole seam that bridges the two vocabularies.
 */
export function mttActionToDisplayAction(a: MttAction): 'raise' | 'limp' | 'shove' | 'fold' {
  return a === 'jam' ? 'shove' : a
}

export function chartToDisplayActionMap(chart: MttRfiChart): Record<string, 'raise' | 'limp' | 'shove' | 'fold'> {
  const dominant = chartToDominantActionMap(chart)
  return Object.fromEntries(
    Object.entries(dominant).map(([hand, action]) => [hand, mttActionToDisplayAction(action)]),
  )
}

export interface ChartDiffEntry {
  hand: string
  before: MttAction | 'fold'
  after: MttAction | 'fold'
  kind: 'added' | 'removed' | 'changed' | 'unchanged'
}

/**
 * Dominant-action comparison between two charts (e.g. the same position at two stack depths),
 * over the full 169-hand grid — powers the Difference View. 'added' = fold->non-fold,
 * 'removed' = non-fold->fold, 'changed' = one non-fold action to a different non-fold action,
 * 'unchanged' = same dominant action on both sides.
 */
export function computeChartDiff(chartA: MttRfiChart, chartB: MttRfiChart): ChartDiffEntry[] {
  const domA = chartToDominantActionMap(chartA)
  const domB = chartToDominantActionMap(chartB)
  return HAND_GRID.flat().map((hand) => {
    const before = domA[hand] ?? 'fold'
    const after = domB[hand] ?? 'fold'
    const kind: ChartDiffEntry['kind'] =
      before === after ? 'unchanged' : before === 'fold' ? 'added' : after === 'fold' ? 'removed' : 'changed'
    return { hand, before, after, kind }
  })
}

/** A hand counts as "genuinely mixed" (not a clean pure decision) once no single action reaches this share. */
export const MIXED_HAND_THRESHOLD = 0.9

export function isMixedHand(cellActions: MttRfiActionFrequencies): boolean {
  const max = Math.max(...Object.values(cellActions))
  return max < MIXED_HAND_THRESHOLD
}

export interface MttRfiFoundation {
  chartKey: string
  /** Obvious-core prefill: hand -> the single action a learner should already be confident about. */
  hands: Record<string, MttAction>
}

/**
 * Obvious-core prefills for scaffolded `range_build_multi` exercises — always a deliberate
 * minority subset of a chart's non-fold hands (pure, unambiguous top-of-range decisions only),
 * mirroring `RANGE_FOUNDATIONS`'s "prefilling is pure UX convenience" convention in `ranges.ts`.
 * Populated per-lesson as `range_build_multi` steps are authored (see mttRfiCoverage.ts).
 */
export const MTT_RFI_FOUNDATIONS: Record<string, MttRfiFoundation> = {
  // Deliberately minimal (per the structural redesign's "do not heavily prefill — this is
  // reconstruction" design goal): only the pure-raise top pairs, nothing suited/offsuit/marginal.
  UTG_RFI_60BB_foundation: {
    chartKey: 'UTG_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  UTG1_RFI_60BB_foundation: {
    chartKey: 'UTG1_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  UTG2_RFI_60BB_foundation: {
    chartKey: 'UTG2_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  LJ_RFI_60BB_foundation: {
    chartKey: 'LJ_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  HJ_RFI_60BB_foundation: {
    chartKey: 'HJ_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  CO_RFI_60BB_foundation: {
    chartKey: 'CO_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  BTN_RFI_60BB_foundation: {
    chartKey: 'BTN_RFI_60BB',
    hands: { AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise' },
  },
  SB_RFI_15BB_foundation: {
    chartKey: 'SB_RFI_15BB',
    hands: {
      // The "obvious" surprising core: premium pairs LIMP (trap) rather than raise/jam at this depth.
      AA: 'limp', KK: 'limp', QQ: 'limp', JJ: 'limp', TT: 'limp', 99: 'limp', 88: 'limp',
    },
  },
  UTG_RFI_25BB_foundation: {
    chartKey: 'UTG_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', KQs: 'raise', KJs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', KQo: 'raise',
    },
  },
  UTG2_RFI_25BB_foundation: {
    chartKey: 'UTG2_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', KQs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', KQo: 'raise',
    },
  },
  LJ_RFI_25BB_foundation: {
    chartKey: 'LJ_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', KQs: 'raise', KJs: 'raise', KTs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', KQo: 'raise',
    },
  },
  HJ_RFI_25BB_foundation: {
    chartKey: 'HJ_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', KQs: 'raise', KJs: 'raise', KTs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', KQo: 'raise',
    },
  },
  CO_RFI_25BB_foundation: {
    chartKey: 'CO_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', KQs: 'raise', KJs: 'raise', KTs: 'raise', QJs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', KQo: 'raise', KJo: 'raise',
    },
  },
  BTN_RFI_25BB_foundation: {
    chartKey: 'BTN_RFI_25BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise', QJs: 'raise', QTs: 'raise', JTs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', KQo: 'raise', KJo: 'raise',
    },
  },
}
