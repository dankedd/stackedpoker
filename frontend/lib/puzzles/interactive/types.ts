/**
 * Interactive puzzle schema.
 *
 * Design rule that shapes everything below: a poker CLAIM and its EVIDENCE are
 * never separated. Any field that asserts something about poker — a frequency,
 * a range percentage, a sizing, a board classification, a reason one action
 * beats another — sits next to a `sources: SourceId[]` on the same object.
 * `validate.ts` refuses to publish a puzzle where any such list is empty, so
 * "we'll add the citation later" is not a reachable state.
 *
 * The counterpart to that is `UnsourcedNote`: the explicit, first-class way to
 * say "the book does not answer this". It exists because the failure mode this
 * product actually has to survive is not a missing citation — it's a plausible
 * number quietly invented to fill a gap. Giving "the source is silent here" its
 * own type, its own renderer and its own place in the flow makes saying so the
 * easy path rather than the awkward one.
 */

export type SourceId = string

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

/** Ordered for the progress rail. A puzzle uses a prefix of this, never a gap. */
export const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river']

export const STREET_LABEL: Record<Street, string> = {
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

/**
 * How good an option is.
 *
 * Three grades rather than right/wrong, because the source itself is graded:
 * on this flop the book has the BB betting good hands 64% of the time, which
 * makes checking the minority branch of a mixed strategy — a worse choice, but
 * emphatically not a blunder. Collapsing that into a red ✕ would teach a
 * falsehood about how GTO strategies are shaped.
 *
 *   'best'       — the action the source supports as the primary strategy.
 *   'defensible' — a real part of the strategy at lower frequency, or a choice
 *                  the source supports under conditions that don't hold here.
 *   'mistake'    — the source contradicts it, or gives it no support at all.
 */
export type OptionVerdict = 'best' | 'defensible' | 'mistake'

export interface PuzzleOption {
  id: string
  /** Button text. Short — 'Donk bet 25% pot'. */
  label: string
  /** Concrete consequence, e.g. '1.4bb into a 5.6bb pot'. Arithmetic, not a claim. */
  detail?: string
  verdict: OptionVerdict
  /** Compact post-answer feedback. Shown immediately; full theory stays folded. */
  shortWhy: string
  /**
   * How this action renders on the felt once chosen — the table updates to show
   * what the learner actually did, not what they should have done.
   * Maps onto `PreflopTableProps.heroAction`.
   */
  tableAction?: { label: string; betBb?: number }
  sources: SourceId[]
}

/**
 * A place where the source genuinely does not answer the question.
 *
 * `question` is what a learner would reasonably want to know; `answer` is what
 * can honestly be said instead. Rendered as a distinct, visible panel — never
 * as a footnote — so the boundary of the evidence is as legible as the evidence.
 */
export interface UnsourcedNote {
  question: string
  answer: string
  /** Optional refs to what the source DOES cover nearby, so the note isn't a dead end. */
  nearestSources?: SourceId[]
}

/** A labelled statistic with its own scope. `sources` is mandatory. */
export interface StatRow {
  label: string
  /** Display value exactly as the source prints it — '73%', '51% vs 49%', '6.5bb/100'. */
  value: string
  /** 0-100, for the bar. Omit when the value isn't a single percentage. */
  pct?: number
  note?: string
}

export interface StatExhibit {
  /** What the numbers are, e.g. 'Donk bet frequency by hand strength'. */
  caption: string
  /**
   * Which simulation these numbers come from, in plain language, e.g.
   * 'General strategy across all high-donk boards at 30-40bb — not 654r alone'.
   * Rendered with the exhibit, always.
   */
  scope: string
  rows: StatRow[]
  sources: SourceId[]
}

export interface TheoryBullet {
  text: string
  sources: SourceId[]
}

/** One expandable theory card, shown only after the learner has answered. */
export interface TheoryBlock {
  id: string
  title: string
  body: string
  bullets?: TheoryBullet[]
  exhibit?: StatExhibit
  unsourced?: UnsourcedNote[]
  sources: SourceId[]
}

/**
 * A range shown in the Range Explorer.
 *
 * `kind` is what stops this component from lying by omission:
 *   'aggregate'   — the source prints a single percentage for the whole range
 *                   (e.g. "a standard 64% GTO range") and NO per-hand chart.
 *   'composition' — the source prints how the range breaks down by strength.
 *   'grid'        — the source prints an actual per-hand 13x13 chart, and the
 *                   repo holds a reviewed extraction of it.
 *
 * There is no 'grid' range in this puzzle, and that is a finding rather than an
 * omission: Modern Poker Theory prints per-hand BB vs BN charts at 25bb and
 * 40bb but not at 30bb, and the repo's own extracted chart data
 * (lib/learn/bbDefenseComplete.ts) is 100bb and says in its own file comment
 * that it must not be reused at another stack depth. Interpolating a 30bb grid
 * between the 25bb and 40bb charts would be invented solver output. So the
 * explorer shows the aggregate the book actually prints, the composition data
 * it actually prints, and an `UnsourcedNote` naming what is missing.
 */
export type RangeExhibitKind = 'aggregate' | 'composition' | 'grid'

export interface RangeBar {
  label: string
  pct: number
  note?: string
}

export interface RangeExhibit {
  id: string
  /** Whose range, e.g. 'Button opening range'. */
  label: string
  /** Headline figure as printed, e.g. '49%'. */
  headline?: string
  kind: RangeExhibitKind
  description: string
  bars?: RangeBar[]
  /** Which seat this belongs to, for grouping in the explorer UI. */
  seat: 'hero' | 'villain' | 'both'
  unsourced?: UnsourcedNote[]
  sources: SourceId[]
}

export interface PuzzleDecision {
  id: string
  street: Street
  /** Cumulative board at the moment of this decision. Empty for preflop. */
  board: string[]
  /** Pot before Hero acts, in bb. */
  potBb: number
  /** Effective stack at this decision, in bb. */
  effectiveStackBb: number
  /** What just happened, in the second person. */
  situation: string
  /**
   * The preflop betting sequence, in the same prose format the Learn curriculum
   * already uses for `LessonStep.action_before_hero` — e.g.
   * `['CO folds', 'BTN raises to 2.5bb', 'SB folds']`. `PreflopTable` parses it
   * to place chips, fold-out the seats that are gone, and derive the pot, so the
   * table's numbers are computed from the same history the learner is shown
   * rather than authored twice and left to drift.
   */
  actionBeforeHero?: string[]
  /** Action on the CURRENT postflop street before hero acts. Empty array = hero
   *  is first to act, which is a real state and different from "unknown". */
  postflopAction?: string[]
  question: string
  /** >= 3, enforced by validate.ts. Order is authored, not sorted by quality. */
  options: PuzzleOption[]
  bestOptionId: string
  /** Shown with the immediate feedback. Compact — the deep material lives in `theory`. */
  explanation: string
  /** Progressive disclosure: revealed behind "See the theory". */
  theory: TheoryBlock[]
  /** Gaps in the source, surfaced at the decision level. */
  unsourced?: UnsourcedNote[]
}

export interface Takeaway {
  text: string
  sources: SourceId[]
}

export interface PuzzleSetup {
  /** e.g. '30bb effective'. */
  format: string
  /** Seats at the table, 2-9. Drives the same seat geometry the Learn tables use. */
  tableSize: number
  heroSeat: string
  villainSeat: string
  heroCards: string[]
  effectiveStackBb: number
  gameNotes?: string
}

export interface InteractivePuzzle {
  id: string
  /** URL slug. */
  slug: string
  /** Display number, e.g. 1. */
  number: number
  title: string
  topic: string
  difficulty: Difficulty
  /** One or two sentences under the title. */
  description: string
  setup: PuzzleSetup
  decisions: PuzzleDecision[]
  ranges: RangeExhibit[]
  /** The closing "what you should remember" bullets. */
  takeaways: Takeaway[]
  /** Headline takeaway sentence above the bullets. */
  takeawayHeadline: string
  headlineSources: SourceId[]
  /** XP awarded for completing. */
  xp: number
  /**
   * Why the hand stops where it does. Required whenever `decisions` does not
   * reach the river, so a puzzle can never look truncated by accident — the
   * stopping point is always an authored, explained decision.
   */
  endsEarlyBecause?: string
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}

/** Streets a puzzle actually plays, in order. Drives the progress rail. */
export function puzzleStreets(puzzle: InteractivePuzzle): Street[] {
  const seen = new Set(puzzle.decisions.map((d) => d.street))
  return STREET_ORDER.filter((s) => seen.has(s))
}
