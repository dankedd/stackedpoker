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
}

/** Full derivation entry point: turns a LessonStep's existing fields into
 *  render-ready seat state. Never fabricates data the step doesn't carry. */
export function buildPreflopTableRenderState(step: Pick<LessonStep, 'hero_position' | 'table_size' | 'action_before_hero' | 'ante_bb'>): PreflopTableRenderState | undefined {
  const heroPosition = step.hero_position
  if (!heroPosition) return undefined
  const tableSize = step.table_size ?? 9
  const order = preflopActionOrder(tableSize)
  const dealer = dealerPosition()

  const actionsBeforeHero = parseActionBeforeHero(step.action_before_hero, heroPosition, tableSize)
  const latest = actionsBeforeHero ? latestActionBySeat(actionsBeforeHero) : undefined

  const seats: PreflopSeatState[] = order.map((position) => ({
    position,
    isHero: position === normalizePosition(heroPosition),
    isDealer: position === dealer,
    action: latest?.get(position),
    postedBlindBb: position === 'SB' ? SB_BB : position === 'BB' ? BB_BB : undefined,
  }))

  return {
    tableSize,
    heroPosition: normalizePosition(heroPosition),
    seats,
    actionsBeforeHero,
    heroIsFirstToAct: actionsBeforeHero !== undefined && actionsBeforeHero.length === 0,
    anteBb: step.ante_bb,
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

  const nonFold = state.actionsBeforeHero.filter((a) => a.kind !== 'fold' && !a.isHero)
  if (nonFold.length === 0) return `ACTION FOLDED TO ${state.heroPosition}`

  return nonFold
    .map((a, i) => {
      const verb =
        a.kind === 'allin' ? 'JAM'
        : a.kind === 'raise' ? (i === 0 ? 'OPEN' : 'RAISE')
        : a.kind === 'call' ? 'CALL'
        : a.kind === 'limp' ? 'LIMP'
        : 'CHECK'
      return `${a.position} ${verb}`
    })
    .join(' · ')
}
