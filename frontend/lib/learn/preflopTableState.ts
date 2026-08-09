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

/** The most recent OPPONENT raise/all-in in the sequence — i.e. whoever set the current
 *  bet Hero faces. Used by the scenario validator to cross-check an authored
 *  `villain_position` against what the structured action data actually says Hero is
 *  facing (catches an author naming the wrong seat as Villain). Skips entries flagged
 *  `isHero` — a rejam spot's LAST entry is often Hero's own already-completed raise
 *  ("Hero raises all-in to 15bb"), which is what Hero just DID, not who Hero is facing;
 *  the real Villain is whoever Hero was reraising. `undefined` when there's no data or
 *  no opponent raise yet (an unopened/limped pot has no "current aggressor"). */
export function lastAggressorBeforeHero(actions: ParsedSeatAction[] | undefined): ParsedSeatAction | undefined {
  if (!actions) return undefined
  let last: ParsedSeatAction | undefined
  for (const action of actions) {
    if ((action.kind === 'raise' || action.kind === 'allin') && !action.isHero) last = action
  }
  return last
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

// ── Scenario/text consistency helpers ───────────────────────────────────────
// The functions below back the "narrative must never contradict the structured
// scenario" invariant (see __tests__/tableStateIntegrity.test.ts's repo-wide
// sweep). They only ever DETECT a mismatch between authored fields — never
// infer/fabricate table state from prose, matching this module's existing
// contract.

const POSITION_TOKEN = 'UTG\\+2|UTG\\+1|UTG|LJ|HJ|CO|BTN|SB|BB'
// Every raise-family verb this corpus's narratives actually use, including the
// re-raise-count words (3-bet/4-bet/5-bet) — a plain "opens?|raises?" alone
// missed "SB 3-bets to 9bb"/"CO 3-bets to a standard 8bb" entirely.
const RAISE_VERB = '(?:opens?|raises?|re-?raises?|3-?bets?|4-?bets?|5-?bets?)'
const JAM_VERB = '(?:jams?|shoves?|goes all-?in|raises? all-?in)'
// Tolerates a short sizing caveat between the verb and the amount — "SB 3-bets
// (non-all-in) to 7bb", "BB 3-bets large, to 13bb" — without opening the door
// to matching across an entire unrelated sentence (bounded, non-greedy).
const FILLER = '[^.]{0,25}?'

/** One narrative sentence's action claim about a named seat — e.g. "SB folds."
 *  parses to `{ position: 'SB', kind: 'fold' }`. Only matches a POSITION TOKEN
 *  at the START of a sentence (start-of-string or right after `.`/`—`) directly
 *  followed by the verb — the same short declarative-sentence shape this
 *  corpus's own narratives already use ("BTN raises to 2.5bb. Hero calls.").
 *  This deliberately does NOT match mid-sentence/hypothetical phrasing like
 *  "if BTN folds here" — those aren't claims about what actually happened. */
export interface NarrativeActionClaim {
  position: string
  kind: SeatActionKind
  betBb?: number
}

interface ActionPattern {
  re: RegExp
  kind: SeatActionKind
  /** Capture group holding the position name, or 'SELF' when the subject is
   *  literally "Hero" with no seat name to read (resolved to the step's own
   *  hero_position by the caller). */
  positionGroup: number | 'SELF'
  sizeGroup?: number
  /** Drop the claim when it lands on Hero's OWN seat. Only set on the unsized
   *  raise pattern: an unsized mention of Hero's seat raising is normally the
   *  decision the step is ASKING about, not history ("BTN opens at a 15bb
   *  effective stack. Which factor matters MOST for hand selection right now?"
   *  — scr-s9, where Hero is the BTN and hasn't acted yet). An unsized mention
   *  of an OPPONENT raising is history by necessity: it has to have happened
   *  already for Hero to be facing it. Sized patterns don't need this — a chip
   *  amount is itself the disambiguator. */
  skipHeroSeat?: boolean
}

const NARRATIVE_ACTION_PATTERNS: ActionPattern[] = [
  // Sized raise/3-bet/4-bet/5-bet — anchor-free: the explicit size is itself a
  // strong enough disambiguator against hypothetical phrasing. "BTN opens to
  // 2.3bb", "SB 3-bets (non-all-in) to 7bb", "BB 3-bets large, to 13bb".
  { re: new RegExp(`\\b(${POSITION_TOKEN})\\s+${RAISE_VERB}\\b${FILLER}\\bto\\s+([\\d.]+)\\s*bb`, 'gi'), kind: 'raise', positionGroup: 1, sizeGroup: 2 },
  // "Hero opens BTN to 2bb" — Hero's own seat restated after the verb.
  { re: new RegExp(`\\bHero\\s+${RAISE_VERB}\\s+(${POSITION_TOKEN})\\s+to\\s+([\\d.]+)\\s*bb`, 'gi'), kind: 'raise', positionGroup: 1, sizeGroup: 2 },
  // "Hero raises to 2.2bb" / "Hero opens to 2.5bb" — no seat named, it's Hero's own.
  { re: new RegExp(`\\bHero\\s+${RAISE_VERB}\\b${FILLER}\\bto\\s+([\\d.]+)\\s*bb`, 'gi'), kind: 'raise', positionGroup: 'SELF', sizeGroup: 1 },
  // Sized jam/shove — "BB jams all-in for 15bb", "BTN jams all-in for 100bb".
  { re: new RegExp(`\\b(${POSITION_TOKEN})\\s+${JAM_VERB}\\b[^.]{0,20}?\\b(?:to|for)\\s+([\\d.]+)\\s*bb`, 'gi'), kind: 'allin', positionGroup: 1, sizeGroup: 2 },
  { re: new RegExp(`\\bHero\\s+${JAM_VERB}\\b[^.]{0,20}?\\b(?:to|for)\\s+([\\d.]+)\\s*bb`, 'gi'), kind: 'allin', positionGroup: 'SELF', sizeGroup: 1 },
  // Fold/call/limp/check/unsized-jam carry no numeric disambiguator, so — to
  // avoid tripping on hypothetical/conditional prose ("if BTN folds here...")
  // — these only match a SENTENCE-INITIAL seat+verb, the same short
  // declarative shape this corpus's own narratives already use ("BTN raises
  // to 2.5bb. Hero calls.").
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+${JAM_VERB}\\b`, 'gi'), kind: 'allin', positionGroup: 1 },
  { re: new RegExp(`(?:^|[.—]\\s+)Hero\\s+${JAM_VERB}\\b`, 'gi'), kind: 'allin', positionGroup: 'SELF' },
  // UNSIZED raises, same sentence-initial guard. Without these, a terminology
  // narrative written entirely without chip amounts ("UTG opens. Hero (BTN)
  // 3-bets. UTG reraises again.") yields NO claims at all, so the cross-check
  // below has nothing to verify and a table missing two of those three actions
  // passes silently — exactly how lab-r1d shipped showing only the open.
  // `dedupeClaims` drops these whenever a sized claim already covers the same
  // seat+kind, so adding them never double-reports an already-sized action.
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+${RAISE_VERB}\\b`, 'gi'), kind: 'raise', positionGroup: 1, skipHeroSeat: true },
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+folds?\\b`, 'gi'), kind: 'fold', positionGroup: 1 },
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+calls?\\b`, 'gi'), kind: 'call', positionGroup: 1 },
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+limps?\\b`, 'gi'), kind: 'limp', positionGroup: 1 },
  { re: new RegExp(`(?:^|[.—]\\s+)(${POSITION_TOKEN})\\s+checks?\\b`, 'gi'), kind: 'check', positionGroup: 1 },
  { re: new RegExp(`(?:^|[.—]\\s+)Hero\\s+folds?\\b`, 'gi'), kind: 'fold', positionGroup: 'SELF' },
  { re: new RegExp(`(?:^|[.—]\\s+)Hero\\s+calls?\\b`, 'gi'), kind: 'call', positionGroup: 'SELF' },
  { re: new RegExp(`(?:^|[.—]\\s+)Hero\\s+limps?\\b`, 'gi'), kind: 'limp', positionGroup: 'SELF' },
  { re: new RegExp(`(?:^|[.—]\\s+)Hero\\s+checks?\\b`, 'gi'), kind: 'check', positionGroup: 'SELF' },
]

/** A handful of narrative shapes are deliberately covered by more than one
 *  pattern above (e.g. "Hero opens BTN to 2bb" matches both the "Hero ... POS
 *  to Nbb" pattern AND the plain "Hero ... to Nbb" self-attribution pattern,
 *  which treats "BTN" as incidental filler text) — collapsing to duplicate or
 *  redundant claims for the exact same fact. This keeps the patterns simple
 *  (no pattern needs to know about the others) and removes the redundancy
 *  after the fact instead: an unsized claim is dropped when a sized claim for
 *  the same seat+kind exists, then exact duplicates are collapsed. */
function dedupeClaims(claims: NarrativeActionClaim[]): NarrativeActionClaim[] {
  const sizedKeys = new Set(claims.filter((c) => c.betBb != null).map((c) => `${c.position}|${c.kind}`))
  const seen = new Set<string>()
  const result: NarrativeActionClaim[] = []
  for (const claim of claims) {
    if (claim.betBb == null && sizedKeys.has(`${claim.position}|${claim.kind}`)) continue
    const key = `${claim.position}|${claim.kind}|${claim.betBb ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(claim)
  }
  return result
}

/** Extracts every "SEAT/Hero verb[s]..." action claim from a narrative string,
 *  across every recognized verb kind (open/raise/3-bet/4-bet/5-bet/jam/shove/
 *  fold/call/limp/check). `heroPosition` resolves a bare "Hero" subject to a
 *  concrete seat, matching `parseActionBeforeHero`'s own convention. Used to
 *  cross-check narrative prose against `action_before_hero` — see
 *  `lib/learn/scenarioValidator.ts` and its repo-wide sweep test. */
export function extractNarrativeActionClaims(narrative: string, heroPosition: string): NarrativeActionClaim[] {
  const heroPos = normalizePosition(heroPosition)
  const claims: NarrativeActionClaim[] = []
  for (const { re, kind, positionGroup, sizeGroup, skipHeroSeat } of NARRATIVE_ACTION_PATTERNS) {
    for (const m of narrative.matchAll(re)) {
      const position = positionGroup === 'SELF' ? heroPos : normalizePosition(m[positionGroup])
      if (skipHeroSeat && position === heroPos) continue
      const betBb = sizeGroup !== undefined && m[sizeGroup] !== undefined ? parseFloat(m[sizeGroup]) : undefined
      claims.push({ position, kind, betBb })
    }
  }
  return dedupeClaims(claims)
}

/** A narrative's claim about a named seat's EFFECTIVE STACK — e.g. "100bb
 *  effective", "the BB... has only 10bb left", "20bb deep". Returns one claim
 *  per matched sentence; `position` is undefined for a table-wide claim not
 *  attributed to any specific seat (e.g. "Cash game, 100bb effective."). */
export interface NarrativeStackClaim {
  position?: string
  stackBb: number
}

const TABLE_WIDE_STACK_RE = /\b(\d+(?:\.\d+)?)\s*bb\s+(?:effective|deep)\b/gi
const SEAT_STACK_AMOUNT_RE = /(\d+(?:\.\d+)?)\s*bb\b[^.]{0,20}?\b(?:left|remaining|behind|deep)\b/gi
const POSITION_ONLY_RE = new RegExp(`\\b(${POSITION_TOKEN})\\b`, 'gi')

export function extractNarrativeStackClaims(narrative: string): NarrativeStackClaim[] {
  const claims: NarrativeStackClaim[] = []
  for (const m of narrative.matchAll(TABLE_WIDE_STACK_RE)) {
    claims.push({ stackBb: parseFloat(m[1]) })
  }
  // Per SENTENCE (not the whole narrative): find each qualifying "Nbb left/
  // remaining/behind/deep" amount, then attribute it to the CLOSEST preceding
  // position token in that same sentence — not just any earlier one. A naive
  // "any position token within N chars before the number" match mis-attributes
  // e.g. "Hero is in the SB — and the BB, still to act, has only 10bb left" to
  // SB (the first token it finds), when BB is the seat the number is actually
  // about.
  for (const sentence of narrative.split(/(?<=[.!?])\s+/)) {
    for (const m of sentence.matchAll(SEAT_STACK_AMOUNT_RE)) {
      const amountIdx = m.index ?? 0
      let closestPosition: string | undefined
      for (const pm of sentence.matchAll(POSITION_ONLY_RE)) {
        if ((pm.index ?? 0) >= amountIdx) break
        closestPosition = pm[1]
      }
      if (closestPosition) claims.push({ position: normalizePosition(closestPosition), stackBb: parseFloat(m[1]) })
    }
  }
  return claims
}

/** A narrative's claim about the ante — "no ante", "ante active", or an explicit
 *  size ("0.125bb ante"/"ante of 0.125bb"). `present: false` claims come from
 *  "no ante" phrasing; `present: true` with `anteBb` undefined means the
 *  narrative asserts an ante exists without naming its size. */
export interface NarrativeAnteClaim {
  present: boolean
  anteBb?: number
}

const NO_ANTE_RE = /\bno\s+ante\b/i
const EXPLICIT_ANTE_RE = /\b(\d+(?:\.\d+)?)\s*bb\s+ante\b|\bante\s+(?:of\s+|at\s+)?(\d+(?:\.\d+)?)\s*bb\b/i
const ANTE_ACTIVE_RE = /\bantes?\s+(?:active|on)\b/i

export function extractNarrativeAnteClaims(narrative: string): NarrativeAnteClaim[] {
  const claims: NarrativeAnteClaim[] = []
  if (NO_ANTE_RE.test(narrative)) claims.push({ present: false })
  const explicit = narrative.match(EXPLICIT_ANTE_RE)
  if (explicit) {
    claims.push({ present: true, anteBb: parseFloat(explicit[1] ?? explicit[2]) })
  } else if (ANTE_ACTIVE_RE.test(narrative)) {
    claims.push({ present: true })
  }
  return claims
}
