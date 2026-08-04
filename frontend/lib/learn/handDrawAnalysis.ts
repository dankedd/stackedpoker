/**
 * Concrete-card draw analysis — extends `handBoardInteraction.ts`'s deterministic
 * hand-CLASS classifier with the facts that genuinely require real suits (flush
 * draws, backdoor flush draws) and a finer straight-draw split (gutshot vs.
 * open-ended vs. backdoor) than that file's rank-only `classifyHandVsBoard`
 * needs for its range-grid use case.
 *
 * Built for `handDescriptionValidator.ts` — the tool that checks a lesson step's
 * own narrative prose ("two overcards", "a backdoor flush draw", ...) against
 * what the actual `hero_hand`/`board` cards say, catching the class of error
 * where a fixed hand's card-facts get described by hand and drift from the
 * cards (e.g. K♦J♦ on Q73 being called "two overcards" when only the King
 * clears the board's Queen).
 *
 * Deliberately reuses rather than re-derives: `classifyHandVsBoard` (pair/
 * two-pair/overpair/set/made-straight/generic-overcards) and `cardsToHandClass`
 * (concrete cards -> rank-only class notation) are both already-tested exports
 * this module builds on top of, never duplicates.
 */

import { RANK_VALUE, type Rank } from './flopClassifier'
import { classifyHandVsBoard, type HandBoardCategory } from './handBoardInteraction'
import { cardsToHandClass } from './combos'

export type StraightDrawType = 'oesd' | 'gutshot' | 'none'

export interface HandDrawFacts {
  /** Reused verbatim from `classifyHandVsBoard` — pair status, made straight,
   *  or the generic 'overcards'/'straight_draw'/'none' rank-only read. */
  category: HandBoardCategory
  /** Hero's hole cards ranked strictly above the flop's highest card. Only
   *  really meaningful pre-pair, but always computed — a claim of "N
   *  overcards" on a hand that also pairs the board is still checkable. */
  overcardCount: 0 | 1 | 2
  hasFlushDraw: boolean
  hasBackdoorFlushDraw: boolean
  /** Refines `category === 'straight_draw'` — classifyHandVsBoard doesn't
   *  distinguish gutshot from open-ended, this does. */
  straightDrawType: StraightDrawType
  hasBackdoorStraightDraw: boolean
  /** A real (non-backdoor) flush draw combined with a real straight draw —
   *  the standard "combo draw" meaning, not two backdoors stacked. */
  isComboDraw: boolean
}

interface ParsedCard {
  rank: Rank
  suit: string
}

function parseCard(card: string): ParsedCard {
  return { rank: card[0].toUpperCase() as Rank, suit: card[1].toLowerCase() }
}

/** Same 10-window table as `handBoardInteraction.ts`'s (unexported) one —
 *  duplicated rather than imported for the same reason that file gives for
 *  duplicating flopClassifier's own copy: small, easily-tested, not part of
 *  either module's public API. */
const STRAIGHT_WINDOWS: { values: number[]; isWheel: boolean }[] = []
for (let top = 14; top >= 6; top--) {
  STRAIGHT_WINDOWS.push({ values: [top, top - 1, top - 2, top - 3, top - 4], isWheel: false })
}
STRAIGHT_WINDOWS.push({ values: [5, 4, 3, 2, 1], isWheel: true })

function valueOf(rank: Rank, isWheel: boolean): number {
  return rank === 'A' && isWheel ? 1 : RANK_VALUE[rank]
}

/** Analyzes a concrete 2-card hand against a concrete 3-card flop. Returns
 *  `undefined` for anything other than a real 2-card hand + 3-card flop
 *  (turn/river boards aren't this function's job — the "backdoor"/"draw"
 *  vocabulary this checks is specifically flop-stage). */
export function analyzeHandVsFlop(heroHand: string[], flop: string[]): HandDrawFacts | undefined {
  if (heroHand.length !== 2 || flop.length !== 3) return undefined

  const category = classifyHandVsBoard(cardsToHandClass(heroHand), flop)

  const hero = heroHand.map(parseCard) as [ParsedCard, ParsedCard]
  const board = flop.map(parseCard)
  const maxBoard = Math.max(...board.map((c) => RANK_VALUE[c.rank]))
  const overcardCount = hero.filter((c) => RANK_VALUE[c.rank] > maxBoard).length as 0 | 1 | 2

  // ── Flush draw / backdoor flush draw — per suit hero actually holds ──────
  let hasFlushDraw = false
  let hasBackdoorFlushDraw = false
  for (const suit of new Set(hero.map((c) => c.suit))) {
    const heroCount = hero.filter((c) => c.suit === suit).length
    const boardCount = board.filter((c) => c.suit === suit).length
    const total = heroCount + boardCount
    if (total === 4) hasFlushDraw = true
    else if (total === 3) hasBackdoorFlushDraw = true
  }

  // ── Straight draw type + backdoor straight potential ──────────────────────
  const outRanks = new Set<number>()
  let hasBackdoorStraightDraw = false
  for (const window of STRAIGHT_WINDOWS) {
    const windowSet = new Set(window.values)
    const boardVals = board.map((c) => valueOf(c.rank, window.isWheel)).filter((v) => windowSet.has(v))
    const heroVals = hero.map((c) => valueOf(c.rank, window.isWheel)).filter((v) => windowSet.has(v))
    if (heroVals.length === 0) continue // hero doesn't contribute to this window at all
    const covered = new Set([...boardVals, ...heroVals])
    const missing = 5 - covered.size
    if (missing === 1) {
      for (const v of window.values) if (!covered.has(v)) outRanks.add(v)
    } else if (missing === 2) {
      hasBackdoorStraightDraw = true
    }
  }
  const straightDrawType: StraightDrawType = outRanks.size >= 2 ? 'oesd' : outRanks.size === 1 ? 'gutshot' : 'none'

  return {
    category,
    overcardCount,
    hasFlushDraw,
    hasBackdoorFlushDraw,
    straightDrawType,
    hasBackdoorStraightDraw,
    isComboDraw: hasFlushDraw && straightDrawType !== 'none',
  }
}
