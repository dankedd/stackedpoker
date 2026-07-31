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
import { fromActionDict, type RangeStrategyMap } from './rangeStrategy'

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

/**
 * The chart's FULL per-hand action-frequency mix — the canonical strategy
 * model (rangeStrategy.ts), never collapsed to a single dominant action.
 * This is what an AUTHORITATIVE reveal grid (`PokerRangeGrid` `strategy`
 * mode) should render, as opposed to `chartToDominantActionMap`/
 * `chartToDisplayActionMap` above, which are for pedagogical single-action
 * displays (the learner's own paint UI, foundation prefills).
 */
export function chartToStrategyMap(chart: MttRfiChart): RangeStrategyMap {
  const map: RangeStrategyMap = {}
  for (const cell of chart.cells) map[cell.hand] = fromActionDict(cell.actions as Record<string, number>)
  return map
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
  // UTG_RFI_60BB_foundation is the one deliberate exception to the "deliberately minimal"
  // rule below: Module 3's UTG Mastery lesson (utg-s6) had only 6 pairs prefilled (~13% of
  // UTG_RFI_60BB's raise-weighted combos), leaving the learner to reconstruct the ENTIRE
  // range from scratch instead of reasoning about its actual edge. Widened to the pure
  // (frequency = 1.0, i.e. not `isMixedHand`) hand-classes a player never genuinely debates
  // opening at UTG — premium-through-small pairs (AA-66), AK/AQ both ways, AJs, the clearly-
  // strong suited broadways (KQs/KJs/KTs/QJs/QTs/JTs), and KQo — totaling 126 of 204.5
  // raise-weighted combos (~62%). Every genuinely mixed-frequency hand (ATo, A3s, K8s, K6s,
  // J9s, 87s, 76s, 65s, 55, 54o, 44) AND every pure-but-thematically-marginal hand a step
  // below that core (AJo, ATs, A9s-A4s, K9s, Q9s, T9s — weaker suited Aces, marginal suited
  // broadways/connectors, borderline offsuit broadways) is deliberately left unfilled: that
  // boundary is the whole point of the exercise. See UTG_RFI_60BB in mttRfiBaselines.ts
  // (Modern Poker Theory, Ch. 7, Hand Range 139, p.360) for the source chart this was derived
  // from — nothing here is invented.
  UTG_RFI_60BB_foundation: {
    chartKey: 'UTG_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise',
      AKo: 'raise', AQo: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise',
      KQo: 'raise',
      QJs: 'raise', QTs: 'raise',
      JTs: 'raise',
    },
  },
  // Widened alongside UTG_RFI_60BB_foundation above, same "obvious core, ~60% of the
  // range's raise-weighted combos, never a mixed-frequency hand" rule — pairs down to
  // wherever pure, AK/AQ/AJ/AT both ways, and the clearly-strong suited broadways
  // (KQs/KJs/KTs, plus KQo). UTG1/UTG2 stay in the same "leave every suited ace below
  // AJs for the learner" family as UTG itself (still a near-early-position seat); LJ/HJ
  // are wide enough that every pair down to 22 and more offsuit broadways (KJo/KTo,
  // QJo/QTo/JTo for HJ) are ALSO pure there, so they're included too — see each chart in
  // mttRfiBaselines.ts (Modern Poker Theory, Ch. 7) for the source data this was derived
  // from. Every mixed-frequency hand is left for the learner in all four.
  UTG1_RFI_60BB_foundation: {
    chartKey: 'UTG1_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise',
      KQs: 'raise', KJs: 'raise',
      KQo: 'raise',
    },
  },
  UTG2_RFI_60BB_foundation: {
    chartKey: 'UTG2_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise',
      KQo: 'raise',
      QJs: 'raise', QTs: 'raise',
      JTs: 'raise',
    },
  },
  LJ_RFI_60BB_foundation: {
    chartKey: 'LJ_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise', 44: 'raise', 33: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise',
      KQo: 'raise', KJo: 'raise', KTo: 'raise',
      QJs: 'raise', QTs: 'raise',
      JTs: 'raise',
    },
  },
  HJ_RFI_60BB_foundation: {
    chartKey: 'HJ_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise', 44: 'raise', 33: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise',
      KQo: 'raise', KJo: 'raise', KTo: 'raise',
      QJs: 'raise', QTs: 'raise',
      QJo: 'raise', QTo: 'raise',
      JTs: 'raise', JTo: 'raise',
    },
  },
  // CO and BTN are wide enough (~33%/~46%+ VPIP) that a suited ace is never a genuine
  // question at either seat — real solver output shows every one of them at frequency
  // 1.0 here, so keeping the "leave weaker suited Aces for the learner" UTG-family rule
  // would misrepresent a settled decision as an open one. The obvious core widens to
  // match: every pair, every suited AND offsuit ace, then kings down to a tier that lands
  // each at ~60-62% of the chart's raise-weighted combos — leaving every queen/jack/ten
  // broadway, every suited connector/gapper, and the position's few genuinely
  // mixed-frequency hands (Q9o, J6s for CO; Q7o/Q6o/Q5o, 97o for BTN) for the learner.
  CO_RFI_60BB_foundation: {
    chartKey: 'CO_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise', 44: 'raise', 33: 'raise', 22: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise', A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise', A8o: 'raise', A7o: 'raise', A6o: 'raise', A5o: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise',
      KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise',
    },
  },
  BTN_RFI_60BB_foundation: {
    chartKey: 'BTN_RFI_60BB',
    hands: {
      AA: 'raise', KK: 'raise', QQ: 'raise', JJ: 'raise', TT: 'raise', 99: 'raise', 88: 'raise', 77: 'raise', 66: 'raise', 55: 'raise', 44: 'raise', 33: 'raise', 22: 'raise',
      AKs: 'raise', AQs: 'raise', AJs: 'raise', ATs: 'raise', A9s: 'raise', A8s: 'raise', A7s: 'raise', A6s: 'raise', A5s: 'raise', A4s: 'raise', A3s: 'raise', A2s: 'raise',
      AKo: 'raise', AQo: 'raise', AJo: 'raise', ATo: 'raise', A9o: 'raise', A8o: 'raise', A7o: 'raise', A6o: 'raise', A5o: 'raise', A4o: 'raise', A3o: 'raise', A2o: 'raise',
      KQs: 'raise', KJs: 'raise', KTs: 'raise', K9s: 'raise', K8s: 'raise', K7s: 'raise', K6s: 'raise', K5s: 'raise', K4s: 'raise', K3s: 'raise', K2s: 'raise',
      KQo: 'raise', KJo: 'raise', KTo: 'raise', K9o: 'raise', K8o: 'raise', K7o: 'raise', K6o: 'raise', K5o: 'raise',
      QJs: 'raise', QTs: 'raise',
      QJo: 'raise',
    },
  },
  // SB_RFI_60BB is the one exception to the module's "~60% obvious core" target: at
  // 60bb, virtually SB's entire opening range is a genuine raise/limp MIX (per
  // mttRfiBaselines.ts's own data, even AA is only 40% raise / 60% limp — see the
  // "Small Blind Mastery" lesson's own narrative, which already explains this).
  // Fewer than 55 of the chart's 159 hands have ANY single dominant action at all, and
  // most of those are marginal limp-only junk, not a "premium core" — there is no
  // subset here that is both (a) genuinely non-mixed and (b) actually obvious. sb-build
  // deliberately keeps 0% prefill (see its own range_build_multi_prefilled_note) rather
  // than fabricate a false "obvious" answer for a hand the real strategy hasn't settled.
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
