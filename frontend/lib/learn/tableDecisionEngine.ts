/**
 * Stateless evaluation engine for `table_decision` steps — the "given this exact spot, what
 * do you do?" quiz shown against a visual poker table (see TableDecision.tsx).
 *
 * Deliberately reuses `buildHandDecisionOptions` (mttRfiLabPool.ts) for the actual
 * quality/feedback derivation rather than re-deriving thresholds here, so a table-decision
 * question and any Lab-pool question over the same (chart, hand) pair can never disagree
 * about what "correct" means — there is exactly one place that turns a chart cell's
 * frequencies into a graded verdict.
 */
import type { ActionQuality } from './types'
import { MTT_RFI_CHARTS, type MttAction, type MttPositionKey, type MttStackBB, type MttRfiChart } from './mttRfiBaselines'
import { buildHandDecisionOptions, cellActionsFor } from './mttRfiLabPool'

const ALL_STACKS: MttStackBB[] = [15, 25, 40, 60]

function chartKeyFor(positionKey: MttPositionKey, stackBB: MttStackBB): string {
  return `${positionKey}_RFI_${stackBB}BB`
}

export interface StackConfusionMatch {
  stackBB: MttStackBB
  chartKey: string
  /** The chosen action's frequency at that OTHER depth — always the dominant action there. */
  frequency: number
}

/**
 * Scans the other 3 depths for `positionKey`+`hand`. Returns a match only if `chosenAction`
 * is the *best* (>=50%) action there — i.e. the learner is confidently playing a real,
 * different depth's baseline strategy, not just guessing wrong. Returns undefined when the
 * chosen action isn't correct at any depth (a plain mistake, not a "wrong stack" mistake).
 */
export function findStackConfusion(
  positionKey: MttPositionKey,
  hand: string,
  currentStackBB: MttStackBB,
  chosenAction: MttAction,
): StackConfusionMatch | undefined {
  for (const stackBB of ALL_STACKS) {
    if (stackBB === currentStackBB) continue
    const chartKey = chartKeyFor(positionKey, stackBB)
    const chart = MTT_RFI_CHARTS[chartKey]
    if (!chart) continue
    const actions = cellActionsFor(chart, hand)
    const freq = actions[chosenAction] ?? 0
    const isBest = Object.entries(actions).every(([a, f]) => a === chosenAction || f <= freq)
    if (freq >= 0.5 && isBest) {
      return { stackBB, chartKey, frequency: freq }
    }
  }
  return undefined
}

export interface TableDecisionEvaluation {
  quality: ActionQuality
  chosenAction: MttAction
  correctAction: MttAction
  correctFrequency: number
  isMixed: boolean
  feedback: string
  stackConfusion?: StackConfusionMatch
}

/**
 * Pure, stateless — callable from both TableDecision.tsx's pre-submit inline reveal and
 * evaluator.ts's final scoring, so they can never disagree.
 */
export function evaluateTableDecision(
  chartKey: string,
  hand: string,
  chosenActionId: string,
): TableDecisionEvaluation | undefined {
  const chart: MttRfiChart | undefined = MTT_RFI_CHARTS[chartKey]
  if (!chart) return undefined

  const actions = cellActionsFor(chart, hand)
  const bestAction = (Object.entries(actions) as [MttAction, number][]).sort((a, b) => b[1] - a[1])[0][0]
  const bestFreq = actions[bestAction] ?? 0
  const isMixed = bestFreq < 0.9 && Object.keys(actions).length > 1

  const options = buildHandDecisionOptions(chart, hand, `${chartKey}:${hand}`)
  const matched = options.find((o) => o.id === chosenActionId)
  const chosenAction = (matched?.id ?? 'fold') as MttAction

  const evaluation: TableDecisionEvaluation = {
    quality: matched?.quality ?? 'mistake',
    chosenAction,
    correctAction: bestAction,
    correctFrequency: bestFreq,
    isMixed,
    feedback: matched?.feedback ?? `The baseline strategy plays ${bestAction} here, not ${chosenActionId}.`,
  }

  if (evaluation.quality !== 'perfect') {
    evaluation.stackConfusion = findStackConfusion(chart.positionKey, hand, chart.stackBB, chosenAction)
  }

  return evaluation
}
