/**
 * Post-answer "full 3-betting range" reveal for preflop 3-bet decision_spot steps
 * (Module 4, "Preflop Aggression") — the mirror image of `defendRangeReveal.ts`'s
 * DEFEND reveal, dispatched via `step.range_reveal_direction === '3bet'` in
 * `evaluator.ts`. After the learner answers a single-hand 3-betting question, this
 * shows the FULL canonical 3-betting range with the just-asked hand highlighted,
 * not just "here's the one right answer."
 *
 * This module only RESOLVES data — it decides nothing about the UI and invents no
 * frequencies. Everything it returns is read straight out of `threebetBaselines.ts`
 * (the same canonical source `StackDepthRangeMorph.tsx` already renders), using the
 * exact shallow -> medium -> deep tiering fallback that component already
 * establishes for `ThreebetMatchup`s.
 *
 * A step gets a reveal ONLY when every one of these holds — anything else means the
 * canonical data can't actually back a reveal, so this returns `undefined` and the
 * step falls back to its existing text-only feedback (no fabrication):
 *   1. `${hero_position}_vs_${villain_position}` (Hero as 3-bettor, Villain as
 *      opener) is one of the charted `ThreebetMatchup`s — currently SB/BB/BTN/CO
 *      only (see threebetBaselines.ts's own doc comment). A matchup naming HJ or
 *      UTG as either seat has no chart yet and correctly resolves to no reveal.
 *   2. `hero_hand` is a concrete two-card holding (so a hand class can be derived).
 *   3. `effective_stack_bb` is set (needed to pick the shallow/medium/deep tier).
 *   4. `action_before_hero`, if authored at all, describes a clean single open
 *      (everyone else folds) — never a squeeze/4bet/limp sequence, which this
 *      chart doesn't represent.
 */
import type { LessonStep, DecisionSpotRangeReveal } from './types'
import { cardsToHandClass } from './combos'
import { stackBBToWorld, entriesToHandList } from './preflopBaselines'
import {
  THREEBET_DEEP,
  THREEBET_MEDIUM,
  THREEBET_SHALLOW,
  THREEBET_SEMANTICS,
  type ThreebetMatchup,
} from './threebetBaselines'
import { rangeEntriesToStrategyMap } from './rangeStrategy'
import { isCleanFacingOpen } from './defendRangeReveal'

export function resolveThreebetRangeReveal(step: LessonStep): DecisionSpotRangeReveal | undefined {
  if (step.type !== 'decision_spot') return undefined

  const { hero_position: heroPosition, villain_position: villainPosition, hero_hand: heroHand, effective_stack_bb: stackBb } = step
  if (!heroPosition || !villainPosition || !heroHand || heroHand.length !== 2 || stackBb == null) return undefined
  if (!isCleanFacingOpen(step.action_before_hero)) return undefined

  const matchup = `${heroPosition}_vs_${villainPosition}` as ThreebetMatchup
  const world = stackBBToWorld(stackBb)
  // Same shallow -> medium -> deep fallback chain StackDepthRangeMorph.tsx already
  // uses for this exact dataset — never a second, independently-invented tiering rule.
  const entries =
    world === 'shallow'
      ? THREEBET_SHALLOW[matchup] ?? THREEBET_MEDIUM[matchup] ?? []
      : world === 'medium'
      ? THREEBET_MEDIUM[matchup] ?? []
      : THREEBET_DEEP[matchup] ?? []
  if (entries.length === 0) return undefined

  const highlightHand = cardsToHandClass(heroHand)
  const strategies = rangeEntriesToStrategyMap(entries, THREEBET_SEMANTICS)

  return {
    strategies,
    strategySemantics: THREEBET_SEMANTICS,
    range: entriesToHandList(entries),
    highlightHand,
    heroPosition,
    villainPosition,
    // Deliberately "3-BET RANGE", never "3-BETTING STRATEGY" — this chart is Hero's
    // 3-bet frequency only (see THREEBET_SEMANTICS); calls and true folds live in a
    // separate, unmerged chart (defendBaselines.ts), exactly mirroring the "CALLING
    // RANGE, never DEFENSE" framing in defendRangeReveal.ts's fallback tier.
    label: `${heroPosition} 3-BET RANGE vs ${villainPosition} OPEN`,
    subtitle: `See where ${highlightHand} sits in Hero's 3-betting frequency — calls and true folds aren't broken out separately here.`,
  }
}
