/**
 * Postflop counterpart to `preflopTableState.ts` — turns a step's poker-context
 * fields into render-ready seat state for a flop/turn/river scene, so postflop
 * lessons can use the SAME seated table as every preflop lesson instead of a
 * text "Action so far" list.
 *
 * The split between streets is always AUTHORED, never inferred:
 *   `action_before_hero` = the preflop history (what built the pot)
 *   `postflop_action`    = what has happened on the CURRENT street
 *
 * Deriving that boundary from the sequence alone (guessing where preflop
 * "closed") would be exactly the kind of fabrication `parseActionBeforeHero`
 * refuses to do, so an unsplit history is simply rendered as a preflop pot with
 * no current-street action rather than being guessed at.
 */

import type { LessonStep } from './types'
import { normalizePosition } from '@/lib/replay/positions'
import {
  buildPreflopTableRenderState,
  parseActionBeforeHero,
  latestActionBySeat,
  preflopActionOrder,
  SHORT_STACK_THRESHOLD_BB,
  type ParsedSeatAction,
  type PreflopSeatState,
  type PreflopTableRenderState,
} from './preflopTableState'

/** Postflop streets only — 'preflop' is `PreflopTable`'s own default path. */
export type PostflopStreet = 'flop' | 'turn' | 'river'

/** How many community cards each street shows. Used to label a scene from its
 *  board length when `street` isn't authored, never to invent missing cards. */
export function streetForBoard(board: string[] | undefined): PostflopStreet | undefined {
  if (!board) return undefined
  if (board.length === 3) return 'flop'
  if (board.length === 4) return 'turn'
  if (board.length === 5) return 'river'
  return undefined
}

export interface PostflopTableRenderState extends PreflopTableRenderState {
  street: PostflopStreet
  /** Chips already in the middle from earlier streets — the pot Hero's decision
   *  is being priced against before any current-street bet. */
  deadPotBb: number
  /** Parsed `postflop_action`, or undefined when there's nothing reliable. */
  streetActions?: ParsedSeatAction[]
  /** Seats still live on this street, in POSTFLOP action order (first to act
   *  first) — which is not preflop order: postflop the blinds act first and the
   *  button acts last. */
  livePositions: string[]
}

/** Postflop action order for a table size — the preflop order rotated so the
 *  small blind leads and the button closes. Derived from the same canonical
 *  seat order as everything else, never hardcoded per table size. */
export function postflopActionOrder(tableSize: number): string[] {
  const preflop = preflopActionOrder(tableSize)
  const sbIdx = preflop.indexOf('SB')
  if (sbIdx < 0) return preflop
  return [...preflop.slice(sbIdx), ...preflop.slice(0, sbIdx)]
}

/** Current-street commitments, starting from a clean slate: postflop every seat
 *  begins at 0 (previous streets' chips are already in the dead pot) and there
 *  is no forced bet to match, so `currentBet` starts at 0 rather than 1bb.
 *  "bets N" / "raises to N" are both absolute totals, matching the preflop
 *  builder's convention. */
function computeStreetCommitments(actions: ParsedSeatAction[] | undefined): Map<string, number> {
  const committed = new Map<string, number>()
  if (!actions) return committed

  let currentBet = 0
  for (const entry of actions) {
    if (entry.kind === 'raise' || entry.kind === 'allin') {
      currentBet = entry.betBb ?? currentBet
      committed.set(entry.position, currentBet)
    } else if (entry.kind === 'call') {
      committed.set(entry.position, currentBet)
    } else if (entry.kind === 'check') {
      committed.set(entry.position, 0)
    }
    // fold leaves the seat's current-street commitment untouched
  }
  return committed
}

/**
 * Builds postflop seat state. Returns undefined when the step doesn't carry
 * enough to draw a table (no hero position, or no board).
 *
 * Pot model — the one thing that genuinely differs from preflop:
 *   deadPotBb   = whatever previous streets built (derived from the preflop
 *                 action when it parses, else the authored `pot_bb`)
 *   potBb       = deadPotBb + this street's commitments
 * A seat that folded preflop keeps its FOLD state and shows no chip: its
 * earlier chips are already counted inside `deadPotBb`, so re-rendering them
 * in front of the seat would double-count them visually.
 */
export function buildPostflopTableRenderState(
  step: Pick<
    LessonStep,
    | 'hero_position' | 'table_size' | 'action_before_hero' | 'postflop_action'
    | 'ante_bb' | 'effective_stack_bb' | 'stack_overrides_bb' | 'board' | 'street' | 'pot_bb'
  >,
): PostflopTableRenderState | undefined {
  const heroPosition = step.hero_position
  if (!heroPosition) return undefined

  const street = (step.street === 'flop' || step.street === 'turn' || step.street === 'river')
    ? step.street
    : streetForBoard(step.board)
  if (!street) return undefined

  const tableSize = step.table_size ?? 9
  const preflop = buildPreflopTableRenderState(step)
  if (!preflop) return undefined

  // Preflop chips are already in the middle. When the preflop history didn't
  // parse (or wasn't authored), fall back to the step's own `pot_bb` — never a
  // fabricated number, and 0 if neither exists.
  const preflopParsed = preflop.actionsBeforeHero !== undefined && preflop.actionsBeforeHero.length > 0
  const deadPotBb = preflopParsed ? preflop.potBb : (step.pot_bb ?? 0)

  const streetActions = parseActionBeforeHero(step.postflop_action, heroPosition, tableSize)
  if (step.postflop_action !== undefined && streetActions === undefined && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[PostflopTable] postflop_action has an unparseable entry — rendering without current-street action:', step.postflop_action)
  }
  const latestStreet = streetActions ? latestActionBySeat(streetActions) : undefined
  const streetCommitments = computeStreetCommitments(streetActions)

  const foldedEarlier = new Set(
    preflop.seats.filter((s) => s.action?.kind === 'fold').map((s) => s.position),
  )
  // A seat can also fold ON this street — both count as out of the hand.
  const foldedNow = new Set(
    (streetActions ?? []).filter((a) => a.kind === 'fold').map((a) => a.position),
  )

  const seats: PreflopSeatState[] = preflop.seats.map((seat) => {
    const isOut = foldedEarlier.has(seat.position) || foldedNow.has(seat.position)
    const streetCommitted = streetCommitments.get(seat.position) ?? 0
    const effectiveStackBb = seat.effectiveStackBb

    // Behind = starting stack minus EVERYTHING put in across all streets. The
    // preflop builder already netted out the preflop portion.
    const totalCommitted = seat.committedBb + streetCommitted

    return {
      ...seat,
      // Folded seats keep their fold marker; live seats show only what they've
      // done on THIS street (undefined = yet to act, a real postflop state).
      action: isOut
        ? (foldedNow.has(seat.position) ? latestStreet?.get(seat.position) : seat.action)
        : latestStreet?.get(seat.position),
      // Preflop blinds belong to the dead pot now, not to this street's display.
      postedBlindBb: undefined,
      committedBb: isOut ? 0 : streetCommitted,
      effectiveStackBb,
      stackBehindBb: effectiveStackBb != null ? effectiveStackBb - totalCommitted : undefined,
      isShortStack: effectiveStackBb != null && effectiveStackBb <= SHORT_STACK_THRESHOLD_BB,
    }
  })

  const potBb = deadPotBb + seats.reduce((sum, s) => sum + s.committedBb, 0)
  const order = postflopActionOrder(tableSize)

  return {
    tableSize,
    heroPosition: normalizePosition(heroPosition),
    seats,
    actionsBeforeHero: preflop.actionsBeforeHero,
    heroIsFirstToAct: streetActions !== undefined && streetActions.length === 0,
    anteBb: step.ante_bb,
    potBb,
    street,
    deadPotBb,
    streetActions,
    livePositions: order.filter((p) => !foldedEarlier.has(p) && !foldedNow.has(p)),
  }
}

/**
 * Whether a step carries enough real data to be drawn as a postflop TABLE
 * rather than the compact scenario card. Requires a hero seat, a real board,
 * and at least one parseable action sequence — a board with no hand attached
 * (the many "look at this texture" illustration steps) has no seats, chips or
 * pot to show, so it keeps the card. The single gate both `DecisionSpot` and
 * `ConceptReveal` consult, so the two can never disagree about which
 * visualization a given step gets.
 */
export function canRenderPostflopTable(
  step: Pick<
    LessonStep,
    | 'hero_position' | 'table_size' | 'action_before_hero' | 'postflop_action'
    | 'ante_bb' | 'effective_stack_bb' | 'stack_overrides_bb' | 'board' | 'street' | 'pot_bb'
  >,
): boolean {
  const state = buildPostflopTableRenderState(step)
  if (!state) return false
  const hasPreflopHistory = !!state.actionsBeforeHero?.length
  const hasStreetAction = !!state.streetActions?.length
  return hasPreflopHistory || hasStreetAction
}

/** One short line summarising the CURRENT street's action — the postflop
 *  equivalent of `deriveCenterStatus`. Returns undefined when there's nothing
 *  reliable to summarise. */
export function derivePostflopStatus(state: PostflopTableRenderState): string | undefined {
  if (!state.streetActions) return undefined
  if (state.streetActions.length === 0) return `${state.street.toUpperCase()} · FIRST TO ACT`

  const parts = state.streetActions.map((a) => {
    const verb =
      a.kind === 'allin' ? 'ALL-IN'
      : a.kind === 'raise' ? (a.betBb != null ? `BETS ${a.betBb}BB` : 'BETS')
      : a.kind === 'call' ? 'CALLS'
      : a.kind === 'check' ? 'CHECKS'
      : a.kind === 'limp' ? 'CALLS'
      : 'FOLDS'
    return `${a.position} ${verb}`
  })
  return `${state.street.toUpperCase()} · ${parts.join(' · ')}`
}
