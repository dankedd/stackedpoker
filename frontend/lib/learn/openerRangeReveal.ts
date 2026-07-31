/**
 * Post-answer "opener's opening range" reveal — the third leg of the
 * defend/3bet/opener reveal family (see `defendRangeReveal.ts` and
 * `threebetRangeReveal.ts` for the other two). Two jobs:
 *
 *   1. Standalone reveal (`range_reveal_direction: 'opener'`) for spots where
 *      Hero's OWN response chart doesn't exist or isn't the pedagogically
 *      relevant one — e.g. a FOLD decision, where what actually explains the
 *      answer is "here's the range Hero is up against," not a Hero-side
 *      strategy chart. This is exactly Modern Poker Theory's own framing of
 *      3-betting decisions: hand vs. opener's range, not hand in isolation.
 *   2. Secondary panel attached (by `evaluator.ts`) alongside an existing
 *      `'defend'`/`'3bet'` reveal, so a learner sees BOTH "here's how wide
 *      Villain opens" and "here's Hero's own response" side by side.
 *
 * Data source: `RFI_DEEP/MEDIUM/SHALLOW` (preflopBaselines.ts) — the SAME
 * canonical opening-range data `StackDepthRangeMorph.tsx` already renders
 * live as its own lesson step, just resolved automatically instead of
 * requiring its own dedicated step. Never a second, independently-invented
 * chart. `RFI_SEMANTICS` (binary raise/fold) is forwarded unchanged.
 *
 * A step gets a panel ONLY when every one of these holds — anything else
 * means the canonical data can't back one, so this returns `undefined` (no
 * fabrication):
 *   1. `villain_position` names a position `RFI_DEEP/MEDIUM/SHALLOW` covers
 *      (UTG, HJ, CO, BTN, SB — RFI_SHALLOW only has BTN/UTG, so a shallow
 *      request for any other position falls back to MEDIUM, same convention
 *      `StackDepthRangeMorph.tsx`'s threebet-dataset branch already uses).
 *   2. `hero_hand` is a concrete two-card holding (so a hand class can be derived).
 *   3. `effective_stack_bb` is set (needed to pick the shallow/medium/deep tier).
 *   4. `villain_position` is genuinely the (sole) opener before Hero — everyone
 *      else in `action_before_hero`, if authored at all, only folds or calls;
 *      nobody RE-RAISES over the opener before Hero acts. Unlike
 *      `isCleanFacingOpen` (which requires a clean HEADS-UP open), this
 *      deliberately tolerates an intervening call — a squeeze spot's "who
 *      opened" question has the same answer as a heads-up one.
 */
import type { LessonStep, DecisionSpotRangeReveal } from './types'
import type { RangeStrategyMap, RangeSemantics } from './rangeStrategy'
import { cardsToHandClass } from './combos'
import { stackBBToWorld, entriesToHandList } from './preflopBaselines'
import { RFI_DEEP, RFI_MEDIUM, RFI_SHALLOW, RFI_SEMANTICS } from './preflopBaselines'
import { rangeEntriesToStrategyMap } from './rangeStrategy'

export interface OpenerRangePanel {
  label: string
  range: string[]
  strategies: RangeStrategyMap
  strategySemantics: RangeSemantics
}

function isVillainSoleOpener(actionBeforeHero: string[] | undefined, villainPosition: string): boolean {
  if (!actionBeforeHero || actionBeforeHero.length === 0) return true
  const raises = actionBeforeHero.filter((a) => /raises/i.test(a))
  if (raises.length !== 1) return false
  return raises[0].startsWith(`${villainPosition} `)
}

/** Bare "range panel" shape — reused both by the standalone reveal below and
 *  by `evaluator.ts`'s `secondaryRange` attachment for `'defend'`/`'3bet'`. */
export function resolveOpenerRangePanel(step: LessonStep): OpenerRangePanel | undefined {
  if (step.type !== 'decision_spot') return undefined

  const { hero_position: heroPosition, villain_position: villainPosition, hero_hand: heroHand, effective_stack_bb: stackBb } = step
  if (!heroPosition || !villainPosition || !heroHand || heroHand.length !== 2 || stackBb == null) return undefined
  if (!isVillainSoleOpener(step.action_before_hero, villainPosition)) return undefined

  const world = stackBBToWorld(stackBb)
  // Same shallow -> medium -> deep fallback chain StackDepthRangeMorph.tsx's RFI
  // dataset branch already uses — never a second, independently-invented tiering rule.
  const entries =
    world === 'shallow'
      ? RFI_SHALLOW[villainPosition] ?? RFI_MEDIUM[villainPosition] ?? []
      : world === 'medium'
      ? RFI_MEDIUM[villainPosition] ?? []
      : RFI_DEEP[villainPosition] ?? []
  if (entries.length === 0) return undefined

  return {
    label: `${villainPosition} OPENING RANGE`,
    range: entriesToHandList(entries),
    strategies: rangeEntriesToStrategyMap(entries, RFI_SEMANTICS),
    strategySemantics: RFI_SEMANTICS,
  }
}

export function resolveOpenerRangeReveal(step: LessonStep): DecisionSpotRangeReveal | undefined {
  const panel = resolveOpenerRangePanel(step)
  if (!panel) return undefined

  const highlightHand = cardsToHandClass(step.hero_hand!)

  return {
    strategies: panel.strategies,
    strategySemantics: panel.strategySemantics,
    range: panel.range,
    highlightHand,
    heroPosition: step.hero_position!,
    villainPosition: step.villain_position!,
    label: panel.label,
    subtitle: `See where ${highlightHand} sits inside ${step.villain_position}'s opening range.`,
  }
}
