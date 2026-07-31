/**
 * Turns a preflop scenario's existing, already-derived `PreflopTableRenderState`
 * into an ORDERED TIMELINE of intermediate table states — one frame per event
 * (blinds posting, then each parsed `action_before_hero` entry) — so the shared
 * playback engine (see hooks/usePlaybackEngine.ts) can step the table forward
 * one event at a time instead of painting straight to the final state.
 *
 * Reuses `buildPreflopTableRenderState` for every frame rather than re-deriving
 * commitments/pot/stack-behind from scratch: each intermediate frame is computed
 * by asking that SAME function for the render state after only a PREFIX of the
 * actions, using a synthetic raw `action_before_hero` string array reconstructed
 * from the already-parsed prefix (round-tripping through the exact same
 * `ENTRY_PATTERNS` grammar `parseActionBeforeHero` already understands). The
 * final frame is the caller's own already-computed final state, reused verbatim
 * — never recomputed — so the last frame is always byte-identical to what
 * `PreflopTable` renders today.
 *
 * The only genuinely new logic here is the two frames that exist BEFORE both
 * blinds are posted (frame 0 = nobody has posted, frame 1 = only SB has
 * posted) — `buildPreflopTableRenderState`'s own `computeCommitments` always
 * seeds both blinds unconditionally, so those two frames are produced by
 * masking the not-yet-posted blind back out of the all-blinds-posted state
 * (`maskUnpostedBlind`), not by a parallel commitment walker.
 */
import {
  buildPreflopTableRenderState,
  preflopActionOrder,
  SB_BB,
  BB_BB,
  type ParsedSeatAction,
  type SeatActionKind,
  type PreflopTableRenderState,
} from './preflopTableState'

export type PlaybackEventKind = 'post_sb' | 'post_bb' | SeatActionKind

export interface PlaybackEvent {
  position: string
  kind: PlaybackEventKind
  betBb?: number
  isHero?: boolean
}

export interface PreflopPlaybackTimeline {
  /** In chronological order: blind posts first (SB then BB, when the table has
   *  a distinct SB seat — heads-up tables don't), then every parsed
   *  `action_before_hero` entry. */
  events: PlaybackEvent[]
  /** frames.length === events.length + 1. frames[0] is the table before
   *  anything has happened (blinds not yet posted); frames[i] is the state
   *  after events[0..i-1] have played; frames[frames.length - 1] is exactly
   *  today's existing final render state (Hero's turn). */
  frames: PreflopTableRenderState[]
}

export type PlaybackTimelineStep = Parameters<typeof buildPreflopTableRenderState>[0]

/** Reconstructs the exact raw-string shape `parseActionBeforeHero` produces
 *  entries from, so re-parsing a prefix through `buildPreflopTableRenderState`
 *  yields identical structured output to the original parse — this is what
 *  lets every intermediate frame reuse the real derivation instead of a
 *  parallel one. Preserves the `isHero` convention exactly ("Hero" as the
 *  literal subject text, not the resolved position name) since that's the only
 *  signal `parseActionBeforeHero` uses to set `isHero` on re-parse. */
function toRawEntry(action: ParsedSeatAction): string {
  const subject = action.isHero ? 'Hero' : action.position
  switch (action.kind) {
    case 'fold':
      return `${subject} folds`
    case 'call':
      return `${subject} calls`
    case 'check':
      return `${subject} checks`
    case 'limp':
      return `${subject} limps`
    case 'raise':
      return `${subject} raises to ${action.betBb}bb`
    case 'allin':
      return `${subject} raises all-in to ${action.betBb}bb`
  }
}

/** Frames 0/1 (before blinds are fully posted) can't be produced by
 *  `buildPreflopTableRenderState` directly — it always seeds both blinds. This
 *  takes the all-blinds-posted, zero-actions state and masks a not-yet-posted
 *  blind's commitment back out (a no-op for a seat that doesn't exist at this
 *  table size, e.g. heads-up's missing 'SB' seat). */
function maskUnpostedBlind(state: PreflopTableRenderState, sbPosted: boolean, bbPosted: boolean): PreflopTableRenderState {
  if (sbPosted && bbPosted) return state
  let potBb = state.potBb
  const seats = state.seats.map((seat) => {
    const mustMask = (seat.position === 'SB' && !sbPosted) || (seat.position === 'BB' && !bbPosted)
    if (!mustMask) return seat
    potBb -= seat.committedBb
    return {
      ...seat,
      committedBb: 0,
      postedBlindBb: undefined,
      stackBehindBb: seat.effectiveStackBb,
    }
  })
  return { ...state, seats, potBb }
}

/**
 * Builds the full playback timeline for a preflop scenario, or `undefined`
 * when `buildPreflopTableRenderState` itself would be (no hero position, or
 * unparseable/absent `action_before_hero`) — the caller falls back to
 * rendering today's static final state directly, unchanged.
 */
export function buildPlaybackTimeline(step: PlaybackTimelineStep): PreflopPlaybackTimeline | undefined {
  const finalState = buildPreflopTableRenderState(step)
  if (!finalState || !finalState.actionsBeforeHero) return undefined

  const tableSize = step.table_size ?? 9
  const order = preflopActionOrder(tableSize)
  const hasSbSeat = order.includes('SB')
  const actions = finalState.actionsBeforeHero

  const events: PlaybackEvent[] = []
  if (hasSbSeat) events.push({ position: 'SB', kind: 'post_sb', betBb: SB_BB })
  events.push({ position: 'BB', kind: 'post_bb', betBb: BB_BB })
  events.push(...actions)

  const blindEventCount = events.length - actions.length // 1 or 2

  const frames: PreflopTableRenderState[] = []
  for (let i = 0; i <= events.length; i++) {
    if (i === events.length) {
      // The last frame is exactly the caller's own final state — reused
      // verbatim, never recomputed, so it's always identical to today's output.
      frames.push(finalState)
      continue
    }

    if (i < blindEventCount) {
      const sbPosted = !hasSbSeat || i >= 1
      const bbPosted = false
      const zeroActionState = buildPreflopTableRenderState({ ...step, action_before_hero: [] })!
      frames.push(maskUnpostedBlind(zeroActionState, sbPosted, bbPosted))
      continue
    }

    const actionsSoFar = actions.slice(0, i - blindEventCount)
    const rawSoFar = actionsSoFar.map(toRawEntry)
    frames.push(buildPreflopTableRenderState({ ...step, action_before_hero: rawSoFar })!)
  }

  return { events, frames }
}
