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

/** One line in the action strip. */
export interface HistoryLine {
  street: Street
  /** Seat label — 'BTN', 'UTG', 'BB'. */
  actor: string
  /** What they did, amounts included: 'Raises to 2.5 bb'. */
  text: string
  isHero?: boolean
}

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
  /**
   * Button text, and nothing else. A poker action verb — 'Call', 'Bet 67% pot'.
   *
   * Amounts deliberately do NOT live here. A button reading "Call / 2.5bb" is
   * actively wrong in the commonest spot in poker: when the button opens TO
   * 2.5bb and the big blind has already posted 1, the call is 1.5. Putting a
   * number under the verb invites exactly that confusion, so the money lives in
   * the hand-info panel and on the felt, where "raise to" and "to call" can be
   * named as the different quantities they are.
   */
  label: string
  verdict: OptionVerdict
  /** Compact post-answer feedback. Shown immediately; full theory stays folded. */
  shortWhy: string
  /**
   * How this action renders on the felt once chosen — the table updates to show
   * what the learner actually did, not what they should have done.
   * Maps onto `PreflopTableProps.heroAction`.
   */
  tableAction?: { label: string; betBb?: number }
  /** How this choice reads in the action strip. Falls back to `label`. */
  historyText?: string
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
  /**
   * Overrides `PuzzleSetup.villainSeat` for this decision only.
   *
   * Exists because a puzzle can legitimately hold everything fixed and vary the
   * OPPONENT — same hero, same stack, same price, different seat opening. Without
   * this, the hand-info panel would keep announcing the setup's villain while the
   * felt showed a different one, which is precisely the kind of quiet mismatch
   * this schema exists to prevent. Omit it whenever one villain plays the whole
   * puzzle, which is the normal case.
   */
  villainSeat?: string
  /** Cumulative board at the moment of this decision. Empty for preflop. */
  board: string[]
  /** Pot before Hero acts, in bb — INCLUDING any bet Hero is facing. */
  potBb: number
  /** Effective stack at this decision, in bb. */
  effectiveStackBb: number
  /**
   * Money Hero has ALREADY put in on this street (the posted blind preflop, a
   * called bet postflop). Needed to compute a call correctly, and validated
   * against `facingBetBb` so the arithmetic can't silently drift.
   */
  heroInvestedBb?: number
  /**
   * The TOTAL a villain has bet or raised TO on this street — not the increment.
   * Preflop, a button opening to 2.5bb is `facingBetBb: 2.5`.
   */
  facingBetBb?: number
  /**
   * What Hero must actually add to continue: `facingBetBb - heroInvestedBb`.
   * Authored rather than derived so `validate.ts` can check the author's
   * arithmetic instead of blessing whatever it computes.
   */
  toCallBb?: number
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
  /**
   * Everything played before Hero acts at this decision, cumulative from the
   * start of the hand. Hero's own choice is appended by the runner once made,
   * so the strip can never show a street the learner has not reached.
   */
  history?: HistoryLine[]
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
  /**
   * Hero's two hole cards — or an EMPTY array for a puzzle that asks about the
   * board instead of about a hand, in which case `InteractivePuzzle.readsTheBoardOnly`
   * must say so. `validate.ts` enforces that pairing in both directions: two
   * cards, or a stated reason for none, but never zero cards and silence.
   *
   * The felt already falls back to two face-down placeholders, which is exactly
   * what "you were dealt nothing that matters here" should look like.
   */
  heroCards: string[]
  effectiveStackBb: number
  /**
   * Ante PER PLAYER, in bb. `PreflopTable` multiplies it by `tableSize` to get
   * the dead money, so a 9-max MTT with the book's 12.5% ante is `0.125` here
   * and 1.125bb in the pot.
   *
   * Omitted means no ante, which is right for a cash spot and wrong for a
   * tournament one: leaving it off an MTT puzzle silently solves a different
   * game than the source did, and dead money is precisely what decides how wide
   * a big blind may defend.
   */
  anteBb?: number
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
  /**
   * Why two decisions sit on the same street with DIFFERENT boards.
   *
   * Almost every puzzle is one hand advancing, and the invariant that goes with
   * that shape — a later board extends an earlier one, never rewrites it — is
   * worth keeping enforced, because a silently rewritten flop card is a bug the
   * learner would read as a dealing error. But a controlled comparison of two
   * boards is a real teaching shape too, and it breaks that invariant by design.
   * So it is authored rather than inferred: state it here, or `validate.ts`
   * treats the second board as an accident.
   */
  comparesAlternativeBoards?: string
  /**
   * Why two decisions sit on the same street with the SAME board and a
   * DIFFERENT opener.
   *
   * The sibling of `comparesAlternativeBoards`, for the other controlled
   * comparison a puzzle can run: hold the board, the hand, the stack and the
   * price fixed, and move the raiser's seat. It needs its own declaration for
   * the same reason — a second decision that looks identical to the first is
   * either a deliberate re-deal or a duplicated question, and the learner
   * cannot tell which unless the puzzle says.
   */
  comparesAlternativeOpeners?: string
  /**
   * Why this puzzle deals Hero no cards.
   *
   * Reading a board is a skill that comes BEFORE choosing an action, and putting
   * two cards in front of the learner teaches the wrong order: given a hand, you
   * start working out what you want to do and stop looking at what the card did.
   * A puzzle that only asks "what did this card change?" therefore deals nothing,
   * and `setup.heroCards` is empty.
   *
   * Same contract as the two fields above: the unusual shape must be authored, so
   * `validate.ts` accepts an empty `heroCards` only when this says why. Without
   * it, a missing hand is a data error — which is the far commoner cause.
   */
  readsTheBoardOnly?: string
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
