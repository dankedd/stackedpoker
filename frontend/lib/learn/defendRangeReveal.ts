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
 *      the only side either data source covers) AND `villain_position` is one
 *      of the charted openers (BTN/CO/SB/UTG/HJ).
 *   2. `hero_hand` is a concrete two-card holding (so a hand class can be derived).
 *   3. `effective_stack_bb` is set (needed to pick the right tier/source).
 *   4. `action_before_hero`, if authored at all, describes a clean single open
 *      (everyone else folds) — never a squeeze/4bet/limp sequence, which
 *      neither data source below represents. Steps that omit the field
 *      entirely (common in Module 5 — the narrative already says "X opens,
 *      Hero is in the BB") are treated as the plain single-open case.
 *
 * TWO DATA SOURCES, deliberately not merged into one (see bbDefenseComplete.ts
 * and defendBaselines.ts's own doc comments for why they never can be):
 *   - `BB_DEFENSE_COMPLETE_100BB` (bbDefenseComplete.ts) — a genuine
 *     `complete_strategy` (fold+call+3bet all known), sourced from Modern
 *     Poker Theory's own solved diagrams, but ONLY valid at exactly 100bb —
 *     preferred whenever the step's `effective_stack_bb` matches that exactly.
 *   - `DEFEND_DEEP/MEDIUM/SHALLOW` (defendBaselines.ts) — calling-frequency-only
 *     (`action_slice`), covering other stack tiers and matchups the book data
 *     doesn't reach. Falls back to this whenever the complete source doesn't apply.
 */
import type { LessonStep, DecisionSpotRangeReveal } from './types'
import { cardsToHandClass } from './combos'
import { stackBBToWorld } from './preflopBaselines'
import { DEFEND_DEEP, DEFEND_SEMANTICS, resolveDefendEntries, type DefendMatchup } from './defendBaselines'
import { BB_DEFENSE_COMPLETE_100BB, type BBOpenDefenseMatchup } from './bbDefenseComplete'
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

  const highlightHand = cardsToHandClass(heroHand)

  // Prefer the book-verified COMPLETE strategy, but only when the scenario is an
  // exact match for the conditions it was solved under (100bb, 6-max cash) — never
  // stretched across a different stack depth (see bbDefenseComplete.ts's SCOPE note).
  const completeMatchup = `${heroPosition}_vs_${villainPosition}` as BBOpenDefenseMatchup
  if (stackBb === 100 && completeMatchup in BB_DEFENSE_COMPLETE_100BB) {
    const strategies = BB_DEFENSE_COMPLETE_100BB[completeMatchup]
    return {
      strategies,
      strategySemantics: { kind: 'complete_strategy' },
      range: Object.keys(strategies),
      highlightHand,
      heroPosition,
      villainPosition,
      // "DEFENSE", not "CALLING RANGE" — fold/call/3bet are all genuinely known here.
      label: `${heroPosition} DEFENSE vs ${villainPosition} OPEN`,
      subtitle: `See where ${highlightHand} sits inside your full defending strategy — fold, call, and 3-bet.`,
    }
  }

  // Fall back to the calling-frequency-only chart for every other tier/matchup.
  const matchup = `${heroPosition}_vs_${villainPosition}` as DefendMatchup
  if (!(matchup in DEFEND_DEEP)) return undefined

  const world = stackBBToWorld(stackBb)
  const entries = resolveDefendEntries(matchup, world)
  if (entries.length === 0) return undefined

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
