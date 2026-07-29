/**
 * Post-answer "full defending range" reveal for preflop DEFEND decision_spot steps
 * (Module 5, "Defending the Open") — the same didactic pattern `table_decision`
 * steps already use (see `tableDecisionEngine.ts` / `TableDecision.tsx`'s
 * `InlineReveal`): after the learner answers a single-hand question, show the
 * FULL canonical Hero response strategy with the just-asked hand highlighted,
 * not just "here's the one right answer."
 *
 * This module only RESOLVES data — it decides nothing about the UI and invents
 * no frequencies. Everything it returns is read straight out of
 * `defendBaselines.ts` (the same canonical source `StackDepthRangeMorph.tsx`
 * already renders), via the exact tested `action_slice` adapter (see
 * `RangeSemantics` in rangeStrategy.ts / `__tests__/defendBaselines.test.ts`)
 * that keeps hands like AA from being mislabeled "Fold" just because this
 * chart only tracks BB's calling frequency, not its (separately-sourced, and
 * for some matchups entirely absent) 3-bets. The returned `strategySemantics`
 * must be forwarded to `PokerRangeGrid` unchanged — it's what stops a hand
 * that's simply ABSENT from the chart (like the K9o regression case) from
 * silently rendering as a confident "Fold" the data never actually proved.
 *
 * A step gets a reveal ONLY when every one of these holds — anything else means
 * the canonical data can't actually back a reveal, so this returns `undefined`
 * and the step falls back to its existing text-only feedback (no fabrication):
 *   1. `hero_position` is a defender this app has real data for (currently BB,
 *      the only side `defendBaselines.ts` covers) AND `villain_position` is one
 *      of the four charted openers (BTN/CO/SB/UTG) — i.e. `${hero}_vs_${villain}`
 *      is a real `DefendMatchup` key.
 *   2. `hero_hand` is a concrete two-card holding (so a hand class can be derived).
 *   3. `effective_stack_bb` is set (needed to pick the shallow/medium/deep tier).
 *   4. `action_before_hero`, if authored at all, describes a clean single open
 *      (everyone else folds) — never a squeeze/4bet/limp sequence, which this
 *      calling-range chart does not represent. Steps that omit the field
 *      entirely (common in Module 5 — the narrative already says "X opens,
 *      Hero is in the BB") are treated as the plain single-open case.
 */
import type { LessonStep, DecisionSpotRangeReveal } from './types'
import { cardsToHandClass } from './combos'
import { stackBBToWorld } from './preflopBaselines'
import { DEFEND_DEEP, DEFEND_SEMANTICS, resolveDefendEntries, type DefendMatchup } from './defendBaselines'
import { rangeEntriesToStrategyMap } from './rangeStrategy'
import { entriesToHandList } from './preflopBaselines'

function isCleanFacingOpen(actionBeforeHero: string[] | undefined): boolean {
  if (!actionBeforeHero || actionBeforeHero.length === 0) return true
  const raises = actionBeforeHero.filter((a) => /raises/i.test(a))
  const others = actionBeforeHero.filter((a) => !/raises/i.test(a))
  return raises.length === 1 && others.every((a) => /folds/i.test(a))
}

export function resolveDefendRangeReveal(step: LessonStep): DecisionSpotRangeReveal | undefined {
  if (step.type !== 'decision_spot') return undefined

  const { hero_position: heroPosition, villain_position: villainPosition, hero_hand: heroHand, effective_stack_bb: stackBb } = step
  if (!heroPosition || !villainPosition || !heroHand || heroHand.length !== 2 || stackBb == null) return undefined
  if (!isCleanFacingOpen(step.action_before_hero)) return undefined

  const matchup = `${heroPosition}_vs_${villainPosition}` as DefendMatchup
  if (!(matchup in DEFEND_DEEP)) return undefined

  const world = stackBBToWorld(stackBb)
  const entries = resolveDefendEntries(matchup, world)
  if (entries.length === 0) return undefined

  const highlightHand = cardsToHandClass(heroHand)
  const strategies = rangeEntriesToStrategyMap(entries, DEFEND_SEMANTICS)

  return {
    strategies,
    strategySemantics: DEFEND_SEMANTICS,
    range: entriesToHandList(entries),
    highlightHand,
    heroPosition,
    villainPosition,
    // Deliberately "CALLING RANGE", never "DEFENSE"/"DEFENDING STRATEGY" — this chart is
    // BB's calling frequency only (see the module doc comment above); calling it a complete
    // defending strategy would overclaim exactly the thing this fix is about (a hand's
    // 3-bets, where they exist, live in a separate, unmerged chart — see RangeSemantics).
    label: `${heroPosition} CALLING RANGE vs ${villainPosition} OPEN`,
    subtitle: `See where ${highlightHand} sits in Hero's calling frequency — raises and true folds aren't broken out separately here.`,
  }
}
