/**
 * Game Theory Foundations (Module 10) — centralized scenario data.
 *
 * SOURCE DISCIPLINE (see LEARN_QUESTION_QA.md + types.ts's SourceEvidenceType):
 *   - `PUSH_FOLD_ITERATION` and `INDIFFERENCE_EXAMPLE` below are SOURCE_RECONSTRUCTED:
 *     specific numbers the user's module spec cites directly from Michael Acevedo's
 *     "Modern Poker Theory" (the heads-up push/fold iteration example and its
 *     accompanying indifference frequencies). They are NOT computed by this app —
 *     there is no real hand-equity model here to derive them from, and inventing
 *     a formula that merely happens to hit these numbers would misrepresent them
 *     as solved rather than sourced. They are presented as fixed, discrete data
 *     points the learner reasons ABOUT, never as a continuous slider target.
 *   - `CLAIRVOYANCE_GAME` constants (board/pot/stacks) are also SOURCE_RECONSTRUCTED
 *     (Acevedo's own worked example), but its EV surface across ANY frequency
 *     combination — not just the cited equilibrium — is EXACT_DERIVED, computed
 *     live by `gameTheoryEngine.ts`'s `clairvoyanceEV` from the game's explicitly
 *     stated rules (pot, bet, hand rankings). See that engine's doc comment for
 *     the full derivation and its test-suite verification against these exact
 *     source numbers.
 *   - `HALF_POT_ALPHA_MDF_EXAMPLE` is EXACT_DERIVED (`alpha`/`mdf` applied to a
 *     stated half-pot bet) but is independently corroborated by the book citing
 *     the same 33%/67% result — both classifications are true simultaneously here.
 */

import type { LessonSource } from './types'

export const MPT_SOURCE = 'Modern Poker Theory' as const
export const MPT_AUTHOR = 'Michael Acevedo' as const

// ── The heads-up push/fold Strategy Loop (Lesson 10.4) ────────────────────────
//
// Acevedo's iterative push/fold example: BN (the pusher) and BB (the caller)
// repeatedly best-respond to each other's fixed strategy. Only the frequency/EV
// pairs the user's spec explicitly cites are represented — no interpolation
// between them, per instruction AF ("never interpolate").

export interface PushFoldIterationStep {
  id: string
  label: string
  /** Whose strategy this step describes. */
  actor: 'BN' | 'BB'
  /** The strategy frequency being described, as a fraction of range width (0-1). */
  freq: number
  /** BB's resulting EV in this state, in bb — only defined where the source gives one. */
  bbEV?: number
  note: string
}

export const PUSH_FOLD_ITERATION: PushFoldIterationStep[] = [
  {
    id: 'iter-1-bn',
    actor: 'BN',
    label: 'Iteration 1 — BN pushes 100%',
    freq: 1.0,
    note: "BN's opening iteration: push every hand.",
  },
  {
    id: 'iter-1-bb',
    actor: 'BB',
    label: "BB's Maximally Exploitative Strategy vs. a 100% push",
    freq: 0.6621,
    bbEV: 13.77,
    note: 'Calling with the widest range that stays profitable against an unconditional push is BB\'s MES here — this is the most profitable response to BN\'s exact stated strategy, calculated from the full known BN range.',
  },
  {
    id: 'iter-2-bn',
    actor: 'BN',
    label: "Iteration 2 — BN adjusts to 46.61%",
    freq: 0.4661,
    note: "BN counter-adjusts, tightening the push range now that BB is calling wide.",
  },
  {
    id: 'iter-2-bb-stale',
    actor: 'BB',
    label: "BB keeps calling the SAME 66.21% against BN's new range",
    freq: 0.6621,
    bbEV: 8.48,
    note: "The exact same calling range that was highly profitable against BN's 100% push is far less profitable now — BN's range is tighter and stronger on average. The exploit was conditional on BN's old mistake continuing.",
  },
  {
    id: 'equilibrium-bn',
    actor: 'BN',
    label: 'Equilibrium — BN pushes 58.3%',
    freq: 0.583,
    note: "BN's strategy settles here — no further BB response can make this range unprofitable to keep pushing.",
  },
  {
    id: 'equilibrium-bb',
    actor: 'BB',
    label: 'Equilibrium — BB calls 37.4%',
    freq: 0.374,
    bbEV: 10.45,
    note: "BB's equilibrium calling range. Its defining property: it guarantees this EV regardless of what BN does — deviating to a wider or narrower BN push range cannot make BB's fixed 37.4% response worse.",
  },
]

export const PUSH_FOLD_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'The Nash Equilibrium — heads-up push/fold iteration example',
  example: 'Table 9',
  type: 'source_reconstructed',
}

// ── The Indifference Principle worked example (Lesson 10.6) ───────────────────

export interface MixedHandExample {
  hand: string
  actorLabel: string
  actionA: string
  actionB: string
  /** Frequency of actionA at equilibrium, 0-1. */
  freqA: number
  /** Frequency of actionB at equilibrium, 0-1. */
  freqB: number
}

export const INDIFFERENCE_EXAMPLE: {
  bnEquilibriumPush: number
  bbEquilibriumCall: number
  bottomPushingHand: MixedHandExample
  bottomCallingHand: MixedHandExample
  source: LessonSource
} = {
  bnEquilibriumPush: 0.583,
  bbEquilibriumCall: 0.374,
  bottomPushingHand: {
    hand: '43s',
    actorLabel: 'BN',
    actionA: 'Push',
    actionB: 'Fold',
    freqA: 0.74,
    freqB: 0.26,
  },
  bottomCallingHand: {
    hand: 'Q6s',
    actorLabel: 'BB',
    actionA: 'Call',
    actionB: 'Fold',
    freqA: 0.39,
    freqB: 0.61,
  },
  source: {
    book: MPT_SOURCE,
    author: MPT_AUTHOR,
    section: 'The Indifference Principle — heads-up push/fold equilibrium',
    example: '43s / Q6s boundary hands, Table 9',
    type: 'source_reconstructed',
  },
}

// ── The Clairvoyance Toy Game (Lessons 10.7-10.8) ──────────────────────────────

export const CLAIRVOYANCE_GAME = {
  board: ['3s', '3h', '3c', '2d', '2s'],
  pot: 100,
  bet: 100, // pot-sized bet; stacks are also $100, so this is an effective shove
  stacks: 100,
  p1Label: 'P1',
  p2Label: 'P2',
  p1Range: ['AA', 'QQ'] as const,
  p2Hand: 'KK',
  /** Combo-derived prior — AA and QQ each have 6 unblocked combos on this board (no ace or queen is on the board), so the 50/50 weighting is EXACT_DERIVED from the stated range, not assumed. */
  probAA: 0.5,
  source: {
    book: MPT_SOURCE,
    author: MPT_AUTHOR,
    section: 'The Clairvoyance Toy Game',
    type: 'source_reconstructed' as const,
  } satisfies LessonSource,
}

// ── Alpha / MDF worked example (Lesson 10.8) ───────────────────────────────────

export const HALF_POT_ALPHA_MDF_EXAMPLE = {
  pot: 100,
  bet: 50, // half pot
  alphaPct: 33.33,
  mdfPct: 66.67,
  valuePct: 75,
  bluffPct: 25,
  source: {
    book: MPT_SOURCE,
    author: MPT_AUTHOR,
    section: 'Minimum Defense Frequency — half-pot river bet example',
    type: 'source_reconstructed' as const,
  } satisfies LessonSource,
}

// ── The generic "Pressure Game" — pedagogical toy model (Lessons 10.1-10.6) ──
//
// A single simplified bet/check-vs-call/fold spot used purely to let the
// learner discover best response, counter-exploitation, unilateral deviation,
// and indifference INTERACTIVELY before the real Clairvoyance numbers arrive.
// Explicitly labeled a pedagogical model on screen wherever it's used — never
// presented as a real poker frequency or solver output. Hero's hand has ZERO
// equity if called (a pure bluff) so its EV surface is driven by exactly the
// same evOfBetting/evOfChecking math as the Clairvoyance Game and Alpha/MDF,
// keeping the module's mental model consistent end-to-end.

export const PRESSURE_GAME_DEFAULT = {
  pot: 100,
  bet: 100,
  equityWhenCalled: 0,
  equityWhenChecked: 0,
  source: {
    book: MPT_SOURCE,
    section: 'Maximally Exploitative Strategy / Counter-Exploitation — teaching model',
    type: 'pedagogical_model' as const,
  } satisfies LessonSource,
}
