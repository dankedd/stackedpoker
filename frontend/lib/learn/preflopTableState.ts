/**
 * Shared, structured-data-driven state for the preflop table visualization used
 * across every preflop Learn step (RFI table decisions, position-mastery lessons,
 * 3-bet/squeeze/defend decision spots). Pure derivation functions only — no React,
 * no rendering. Every fact here is derived from existing LessonStep fields
 * (hero_position, table_size, action_before_hero) or from the canonical seat-order
 * primitives in lib/replay/positions.ts. Nothing is invented: a spot with no
 * reliable prior-action data simply yields `actionsBeforeHero: undefined`, and the
 * caller renders hero-only context rather than a guessed opponent action.
 */
import { POSITIONS_BY_SIZE, normalizePosition, preflopToClockwise } from '@/lib/replay/positions'
import type { LessonStep } from './types'

export type SeatActionKind = 'fold' | 'call' | 'raise' | 'limp' | 'check' | 'allin'

export interface ParsedSeatAction {
  position: string
  kind: SeatActionKind
  betBb?: number
  /** True when this entry is Hero's own already-completed action (e.g. a rejam
   *  spot: Hero opened, then got shoved on, and now faces a new decision). */
  isHero?: boolean
}

/** Preflop action order (first-to-act → last-to-act) for a given table size,
 *  derived from the canonical clockwise-from-BTN seat order — never hardcoded
 *  per table size. E.g. 9-max: UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB. */
export function preflopActionOrder(tableSize: number): string[] {
  const clockwise = POSITIONS_BY_SIZE[tableSize] ?? POSITIONS_BY_SIZE[9]
  const N = clockwise.length
  return clockwise.map((_, preflopIdx) => clockwise[preflopToClockwise(preflopIdx, N)])
}

/** Every position that acts before `heroPosition` in preflop order, in order. */
export function positionsBeforeHero(heroPosition: string, tableSize: number): string[] {
  const order = preflopActionOrder(tableSize)
  const heroIdx = order.indexOf(normalizePosition(heroPosition))
  return heroIdx > 0 ? order.slice(0, heroIdx) : []
}

/** Dealer always sits at the BTN seat — a structural fact, not per-lesson data. */
export function dealerPosition(): string {
  return 'BTN'
}

/** Standard forced-blind sizes in bb terms — fixed by the bb unit's own
 *  definition (1 big blind = 1bb), not derived per lesson. */
export const SB_BB = 0.5
export const BB_BB = 1

/** A seat at or below this depth is flagged `isShortStack` for the table's visual highlight —
 *  matches the "≤20 BB" threshold used throughout the curriculum's own short-stack framing
 *  (e.g. the "15-20bb" jam-threshold language in the-big-blind-discount lesson). */
export const SHORT_STACK_THRESHOLD_BB = 20

const ENTRY_PATTERNS: { re: RegExp; kind: SeatActionKind }[] = [
  { re: /^(.+?) raises all-in to ([\d.]+)\s*bb$/i, kind: 'allin' },
  { re: /^(.+?) raises to ([\d.]+)\s*bb$/i, kind: 'raise' },
  { re: /^(.+?) calls$/i, kind: 'call' },
  { re: /^(.+?) checks$/i, kind: 'check' },
  { re: /^(.+?) limps$/i, kind: 'limp' },
  { re: /^(.+?) folds$/i, kind: 'fold' },
]

/**
 * Parses the existing `action_before_hero` string array into structured per-seat
 * actions. Returns `undefined` when there is nothing reliable to parse (the
 * caller should render hero-only context, never a guessed table state).
 *
 * `entries` semantics (matching the existing field, no schema change):
 * - `undefined`            → unknown; caller renders no fold/action row.
 * - `[]`                   → Hero is first to act (nobody before them).
 * - `['Everyone folds']`   → every position before Hero folded (RFI shorthand).
 * - real entries           → parsed in chronological order; a position's most
 *                            recent entry wins if it appears more than once.
 *
 * A "Hero raises to Nbb" / "Hero raises all-in to Nbb" entry represents Hero's
 * OWN already-completed action (a rejam spot: Hero opened, then faced a
 * re-raise) — flagged via `isHero` so the renderer can show it on Hero's seat
 * rather than treating it as an opponent.
 */
export function parseActionBeforeHero(
  entries: string[] | undefined,
  heroPosition: string,
  tableSize: number,
): ParsedSeatAction[] | undefined {
  if (entries === undefined) return undefined

  if (entries.length === 0) return []

  if (entries.length === 1 && /^everyone folds$/i.test(entries[0])) {
    return positionsBeforeHero(heroPosition, tableSize).map((position) => ({ position, kind: 'fold' as const }))
  }

  const parsed: ParsedSeatAction[] = []
  for (const raw of entries) {
    const trimmed = raw.trim()
    let matched = false
    for (const { re, kind } of ENTRY_PATTERNS) {
      const m = trimmed.match(re)
      if (!m) continue
      const rawPos = m[1].trim()
      const isHero = /^hero$/i.test(rawPos)
      const position = isHero ? normalizePosition(heroPosition) : normalizePosition(rawPos)
      const betBb = m[2] !== undefined ? parseFloat(m[2]) : undefined
      parsed.push({ position, kind, betBb, ...(isHero ? { isHero: true } : {}) })
      matched = true
      break
    }
    if (!matched) return undefined // unparseable entry — don't guess, degrade gracefully
  }
  return parsed
}

/** Collapses a chronological parsed-action list into each seat's latest state
 *  (last action wins, matching real poker — a seat's displayed state is
 *  whatever it most recently did). */
export function latestActionBySeat(actions: ParsedSeatAction[]): Map<string, ParsedSeatAction> {
  const byPosition = new Map<string, ParsedSeatAction>()
  for (const action of actions) byPosition.set(action.position, action)
  return byPosition
}

export interface PreflopSeatState {
  position: string
  isHero: boolean
  isDealer: boolean
  /** undefined = not yet acted / unknown (neutral seat). */
  action?: ParsedSeatAction
  /** Forced blind this seat posts, in bb, if any. */
  postedBlindBb?: number
  /** This seat's total CURRENT-STREET commitment in bb — blinds, then whatever
   *  the action sequence adds on top ("raise to Nbb" always overwrites with the
   *  absolute total, never adds on top of a prior commitment). 0 for a seat that
   *  hasn't posted a blind or acted. A folded seat keeps its last commitment —
   *  those chips already belong to the pot. */
  committedBb: number
  /** This seat's own effective stack in bb — `stack_overrides_bb[position]` when
   *  authored, otherwise the table's overall `effective_stack_bb`. Undefined when
   *  neither is known (never fabricated). */
  effectiveStackBb?: number
  /** effectiveStackBb - committedBb. Undefined when effectiveStackBb isn't known
   *  (never fabricated). */
  stackBehindBb?: number
  /** True when effectiveStackBb is at or below SHORT_STACK_THRESHOLD_BB — drives
   *  PreflopTable's short-stack badge. Always derived, never authored directly. */
  isShortStack: boolean
}

export interface PreflopTableRenderState {
  tableSize: number
  heroPosition: string
  seats: PreflopSeatState[]
  /** Parsed action-before-hero, or undefined if no reliable data exists. */
  actionsBeforeHero?: ParsedSeatAction[]
  /** True when actionsBeforeHero is an empty array — Hero is first to act. */
  heroIsFirstToAct: boolean
  anteBb?: number
  /** Total pot: forced blinds + antes + every seat's current commitment, including
   *  chips already committed by a seat that has since folded. Always derived from
   *  the same seat/action data driving the rest of the table — never a separately
   *  hardcoded number. */
  potBb: number
}

/** Sequentially walks the parsed action list (seeded with forced blinds) to
 *  compute each seat's current-street commitment. A "raise to Nbb" entry is
 *  always the seat's new ABSOLUTE total — overwriting, never adding — which is
 *  what makes an already-in blind raising to Nbb correctly deduct only the
 *  incremental difference from its stack (spec item 5) with no separate
 *  bookkeeping. Calls/limps/checks commit whatever the current bet-to-call is;
 *  folds leave the seat's last commitment untouched (those chips already belong
 *  to the pot — spec item 6). */
function computeCommitments(order: string[], actionsBeforeHero: ParsedSeatAction[] | undefined): Map<string, number> {
  const committed = new Map<string, number>()
  for (const position of order) {
    committed.set(position, position === 'SB' ? SB_BB : position === 'BB' ? BB_BB : 0)
  }
  if (!actionsBeforeHero) return committed

  let currentBet = BB_BB
  for (const entry of actionsBeforeHero) {
    if (entry.kind === 'raise' || entry.kind === 'allin') {
      currentBet = entry.betBb ?? currentBet
      committed.set(entry.position, currentBet)
    } else if (entry.kind === 'call' || entry.kind === 'limp' || entry.kind === 'check') {
      committed.set(entry.position, currentBet)
    }
  }
  return committed
}

/** Full derivation entry point: turns a LessonStep's existing fields into
 *  render-ready seat state. Never fabricates data the step doesn't carry. */
export function buildPreflopTableRenderState(step: Pick<LessonStep, 'hero_position' | 'table_size' | 'action_before_hero' | 'ante_bb' | 'effective_stack_bb' | 'stack_overrides_bb'>): PreflopTableRenderState | undefined {
  const heroPosition = step.hero_position
  if (!heroPosition) return undefined
  const tableSize = step.table_size ?? 9
  const order = preflopActionOrder(tableSize)
  const dealer = dealerPosition()

  const actionsBeforeHero = parseActionBeforeHero(step.action_before_hero, heroPosition, tableSize)
  if (step.action_before_hero !== undefined && actionsBeforeHero === undefined && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[PreflopTable] action_before_hero has an unparseable entry — the table will render without action/fold/pot state:', step.action_before_hero)
  }
  const latest = actionsBeforeHero ? latestActionBySeat(actionsBeforeHero) : undefined
  const commitments = computeCommitments(order, actionsBeforeHero)

  const seats: PreflopSeatState[] = order.map((position) => {
    const committedBb = commitments.get(position) ?? 0
    const effectiveStackBb = step.stack_overrides_bb?.[position] ?? step.effective_stack_bb
    return {
      position,
      isHero: position === normalizePosition(heroPosition),
      isDealer: position === dealer,
      action: latest?.get(position),
      postedBlindBb: position === 'SB' ? SB_BB : position === 'BB' ? BB_BB : undefined,
      committedBb,
      effectiveStackBb,
      stackBehindBb: effectiveStackBb != null ? effectiveStackBb - committedBb : undefined,
      isShortStack: effectiveStackBb != null && effectiveStackBb <= SHORT_STACK_THRESHOLD_BB,
    }
  })

  const anteContribution = step.ante_bb ? step.ante_bb * tableSize : 0
  const potBb = anteContribution + seats.reduce((sum, s) => sum + s.committedBb, 0)

  return {
    tableSize,
    heroPosition: normalizePosition(heroPosition),
    seats,
    actionsBeforeHero,
    heroIsFirstToAct: actionsBeforeHero !== undefined && actionsBeforeHero.length === 0,
    anteBb: step.ante_bb,
    potBb,
  }
}

/**
 * A single short line summarizing what happened before Hero — orientation, not a
 * hand-history paragraph (spec item 17). Returns undefined when there's nothing
 * reliable to summarize (unknown action_before_hero); the caller should render
 * nothing rather than a fabricated status.
 */
export function deriveCenterStatus(state: PreflopTableRenderState): string | undefined {
  if (state.heroIsFirstToAct) return 'FIRST TO ACT'
  if (!state.actionsBeforeHero) return undefined

  // Hero's own already-completed action (e.g. an opening raise that's now being
  // 3-bet) counts toward this sequence just like any other seat's — a table
  // that hides Hero's own raise, or mislabels the next raise as a plain "RAISE"
  // instead of "3-BET", is exactly the question/table mismatch this derivation
  // exists to prevent (spec items 7, 11, 17).
  const nonFold = state.actionsBeforeHero.filter((a) => a.kind !== 'fold')
  if (nonFold.length === 0) return `ACTION FOLDED TO ${state.heroPosition}`

  let raiseCount = 0
  return nonFold
    .map((a) => {
      let verb: string
      if (a.kind === 'allin') {
        raiseCount += 1
        verb = 'JAM'
      } else if (a.kind === 'raise') {
        raiseCount += 1
        verb = raiseCount === 1 ? 'OPEN' : `${raiseCount + 1}-BET`
      } else if (a.kind === 'call') {
        verb = 'CALL'
      } else if (a.kind === 'limp') {
        verb = 'LIMP'
      } else {
        verb = 'CHECK'
      }
      return `${a.position} ${verb}`
    })
    .join(' · ')
}
