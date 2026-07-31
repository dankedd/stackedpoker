/**
 * Post-answer "full facing-a-3-bet response range" reveal — the fourth leg of
 * the reveal family (defend/3bet/opener/facing_3bet). For spots where HERO
 * opened, Villain 3-bet, and Hero now chooses 4-bet/call/fold: shows Hero's
 * full call/4bet/fold response with the just-asked hand highlighted, not just
 * "here's the one right answer" (Module 4, "They Raised Back").
 *
 * Data source: `THREEBET_RESPONSE_CHARTS` (threebetResponseBaselines.ts) — the
 * SAME chart `trb-range-lab`/`trb-repair-fix` (range_build_multi) and
 * `trb-flip-reveal` (range_compare) already use directly in curriculum.ts.
 * Never a second, independently-invented chart. Every hand in a chart's
 * `cells` carries exactly one pure action (never fabricated as mixed), and —
 * per this domain's own established convention (see `trb-range-lab`'s
 * `range_hint`: "Only hands Hero actually opened are in play here — everything
 * else defaults to fold") — a hand absent from `cells` is a genuine fold, so
 * `strategySemantics` is `complete_strategy`, matching how `trb-flip-reveal`
 * already presents this exact data.
 *
 * A step gets a reveal ONLY when every one of these holds — anything else
 * means the canonical data can't back one, so this returns `undefined` (no
 * fabrication):
 *   1. `${hero_position}_vs_${villain_position}_3bet_response` is a real key
 *      in `THREEBET_RESPONSE_CHARTS` — currently only `BTN_vs_BB` and
 *      `HJ_vs_CO` have a real hand-level chart (see that file's own doc
 *      comment); every other opener/3-bettor pairing has no per-hand data.
 *   2. `hero_hand` is a concrete two-card holding (so a hand class can be derived).
 *   3. `action_before_hero`, if authored at all, is exactly "Hero opens, then
 *      Villain 3-bets" — the last two non-fold entries, in order, no
 *      squeeze/cold-4bet/limp shape this chart doesn't represent.
 */
import type { LessonStep, DecisionSpotRangeReveal } from './types'
import { cardsToHandClass } from './combos'
import { THREEBET_RESPONSE_CHARTS } from './threebetResponseBaselines'
import { chartToStrategyMap, chartHandList } from './threebetResponseRanges'

function isHeroOpenThenVillainThreebet(
  actionBeforeHero: string[] | undefined,
  heroPosition: string,
  villainPosition: string,
): boolean {
  if (!actionBeforeHero || actionBeforeHero.length === 0) return false
  const raises = actionBeforeHero.filter((a) => /raises/i.test(a))
  if (raises.length !== 2) return false
  return raises[0].startsWith(`${heroPosition} `) && raises[1].startsWith(`${villainPosition} `)
}

export function resolveFacingThreebetRangeReveal(step: LessonStep): DecisionSpotRangeReveal | undefined {
  if (step.type !== 'decision_spot') return undefined

  const { hero_position: heroPosition, villain_position: villainPosition, hero_hand: heroHand } = step
  if (!heroPosition || !villainPosition || !heroHand || heroHand.length !== 2) return undefined
  if (!isHeroOpenThenVillainThreebet(step.action_before_hero, heroPosition, villainPosition)) return undefined

  const chart = THREEBET_RESPONSE_CHARTS[`${heroPosition}_vs_${villainPosition}_3bet_response`]
  if (!chart) return undefined

  const highlightHand = cardsToHandClass(heroHand)

  return {
    strategies: chartToStrategyMap(chart),
    strategySemantics: { kind: 'complete_strategy' },
    range: chartHandList(chart),
    highlightHand,
    heroPosition,
    villainPosition,
    label: `${heroPosition} RESPONSE vs ${villainPosition} 3-BET`,
    subtitle: `See where ${highlightHand} sits inside Hero's full 4-bet/call/fold response to this 3-bet.`,
  }
}
