/**
 * Polarization & Range Construction (Module 11) — centralized scenario data for
 * Lessons 1-5, per `docs/module-11-blueprint.md`'s Evidence Ledger and
 * `docs/module-11-architecture.md` Section 5's Data Model.
 *
 * SOURCE DISCIPLINE (see LEARN_QUESTION_QA.md + types.ts's SourceEvidenceType):
 *   - The Clairvoyance Game itself (Lesson 1) is NOT re-declared here — it is
 *     Module 10's `CLAIRVOYANCE_GAME` (gameTheoryContent.ts), reused directly.
 *     `faceUpEV` (gameTheoryEngine.ts) computes the face-up comparison live from
 *     those same source-cited inputs — EXACT_DERIVED, nothing new to source here.
 *   - `HALF_POT_ALPHA_MDF_EXAMPLE` (Lesson 4) is likewise NOT re-declared — it is
 *     Module 10's own constant (gameTheoryContent.ts), reused directly, since it
 *     is the exact same Ch.1 p.137 half-pot river citation Lesson 4 needs.
 *   - A76r/654r (Lesson 3) are NOT re-declared — they are Module 8's own
 *     `A76R_SCENARIO`/`CS_654R_SCENARIO` (rangeVsRangeContent.ts), reused
 *     directly and explicitly re-framed with "remember this board?" continuity
 *     copy in the lesson content, per the blueprint's continuity discipline.
 *   - `RANGE_MIRROR_*` (Lesson 2) is PEDAGOGICAL_MODEL: the book states the
 *     underlying principle directly (a range's shape is relative to its specific
 *     comparison — Ch.13 p.750) but gives no single worked "same range vs two
 *     named opponents" numeric example to transcribe. The percentages below are
 *     an original, clearly-illustrative construction built ONLY to demonstrate
 *     that principle — never presented as a book-cited number.
 *   - `CAPPED_NOT_CONDENSED_EXAMPLE` (Lesson 2) is SOURCE for its underlying claim
 *     (Ch.1 p.83's own 543-flop counter-example, transcribed) — the claim itself
 *     is the book's, not invented.
 *   - `PROTECTION_SURGERY_BOARD` (Lesson 5) is PEDAGOGICAL_MODEL: the book states
 *     the underlying principle repeatedly and explicitly (protect the checking
 *     range with some genuine strength — Ch.10 pp.596-597, Ch.11 pp.641/645,
 *     Ch.12 pp.680-682/693/695) but Lesson 5's own content deliberately simplifies
 *     this into a small, single-street illustrative board (see
 *     `docs/module-11-lessons.md` Lesson 5 Visual Explanation: "introduced here
 *     in a simplified, single-street form") rather than reproducing one of
 *     Ch.12's five fully-worked examples combo-for-combo — that full-fidelity
 *     reuse is reserved for Lesson 8/10 (out of scope for this phase).
 */

import type { LessonSource } from './types'
// Reused directly from Module 10's own constants — never re-declared, so the book/author
// string can't silently drift between the two content files.
import { MPT_SOURCE, MPT_AUTHOR } from './gameTheoryContent'

// ── Lesson 2 — "The Same Range, Two Faces" ────────────────────────────────────

export const CAPPED_NOT_CONDENSED_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Range Morphology — Capped/Uncapped Range',
  example: '543 flop counter-example',
  type: 'exact_derived',
}

/** Ch.1 p.83's own counter-example: a capped range is not necessarily condensed.
 *  On a low, connected board a range can be missing its structural nuts (capped)
 *  while still holding hands functionally close to the best possible holding on
 *  that specific board (straights) — far from a pure "middle-only" range. */
export const CAPPED_NOT_CONDENSED_EXAMPLE = {
  board: ['5h', '4d', '3s'],
  boardLabel: '5♥4♦3♠',
  claim:
    'On this flop, a range missing sets/two-pair/AA-type structural nuts is genuinely capped — but ' +
    'because 5-4-3 makes an unusually large number of straight-completing hands plausible, that same ' +
    'range can still be loaded with straights, hands functionally close to the nuts on this exact board. ' +
    'Capped describes what is missing at the ceiling. Condensed describes what is missing at BOTH ends. ' +
    'A condensed range is always capped — but this range shows a capped range is not always condensed.',
  source: CAPPED_NOT_CONDENSED_SOURCE,
}

export const RANGE_MIRROR_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Range shape is relative, not intrinsic (Ch.13 p.750\'s checking-back principle, illustrated)',
  type: 'pedagogical_model',
}

/** The center range never changes across the exercise — only which opponent it's being
 *  compared against does. Percentages are an original, illustrative construction (no
 *  single book-cited numeric example exists for this exact comparison) built solely to
 *  make Ch.13 p.750's real principle ("the same range is polarized vs. one opponent,
 *  condensed vs. another") directly observable. Never presented as book data. */
export const RANGE_MIRROR = {
  centerLabel: "Hero's range",
  centerStrong: 38,
  opponentA: {
    label: 'Opponent A — has taken no action yet, still very wide',
    strong: 6,
    good_note: 'a real, if modest, share of good hands',
    weak_note: 'the bulk of this wide, unfiltered range',
    trash_note: 'a meaningful trash share too, but nowhere near dominant',
  },
  opponentB: {
    label: "Opponent B — already bet most of their own strong hands, checking back what's left",
    strong: 34,
    good_note: 'comparable in size to Strong — a genuinely condensed middle',
    weak_note: 'a modest remaining share',
    trash_note: 'very little — this range already filtered most of its air out earlier',
  },
  source: RANGE_MIRROR_SOURCE,
}

// ── Lesson 5 — "Protect the Checking Range" ───────────────────────────────────

export const PROTECTION_SURGERY_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Protected Checking Range (Ch.10 pp.596-597; Ch.11 pp.641,645; Ch.12 pp.680-682,693,695)',
  type: 'pedagogical_model',
}

/** A small, single-street illustrative board — NOT one of Ch.12's five fully-worked
 *  examples (those are reserved, full-fidelity, for the Lesson 8/10 capstone reuse).
 *  Every pool entry is a real, parseable hand-class notation (so the existing
 *  combo-weighted range_bucket scoring — pair=6/suited=4/offsuit=12 combos — is
 *  numerically accurate, not a mis-applied preflop weighting on postflop labels). */
export const PROTECTION_SURGERY_BOARD = {
  board: ['9h', '8h', '4d'],
  boardLabel: '9♥8♥4♦',
  pool: ['AA', '99', '88', 'AKs', 'AQo', '76s', '32o'],
  /** Which pool entries are this board's genuinely strong hands — overpairs/sets. */
  strongHands: ['AA', '99', '88'],
  /** The naive, unprotected split every learner sees first: every strong hand bet,
   *  nothing held back. */
  naiveSplit: { AA: 'bet', 99: 'bet', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' } as Record<string, string>,
  /** The book-consistent, protected split: one of the three strong hands (99, the most
   *  vulnerable-if-overplayed middle set) is checked back for protection; everything
   *  else bets. Matches the theory's own "a modest minority, not a majority" framing. */
  correctSplit: { AA: 'bet', 99: 'check', 88: 'bet', AKs: 'bet', AQo: 'bet', '76s': 'bet', '32o': 'bet' } as Record<string, string>,
  /** A defensible second-strong-hand-checked variant, accepted as equally "protected". */
  acceptableAlternateChecks: { 88: ['check'] } as Record<string, string[]>,
  minCheckStrongShare: 0.15,
  maxCheckStrongShare: 0.55,
  source: PROTECTION_SURGERY_SOURCE,
}

// ── Traceability constant (Concept Registry / Misconception Ledger cross-reference) ──
// Purely for authoring/analytics traceability (see docs/module-11-architecture.md
// Section 5 and Section 9) — never mutated at runtime, never rendered as a claim.

export const MISCONCEPTION_BY_CONCEPT_ID: Record<string, string> = {
  informational_advantage: 'preventative (precedes Misconceptions #1/#3/#5)',
  relative_range_shape: '#8 — a range has one fixed shape',
  capped_vs_condensed: '#9 — a capped range is the same as a condensed/weak range',
  range_composition: '#2 — more equity means bet more often',
  bluff_to_value_ratio: '#6 — MDF always determines my defense',
  protected_checking_range: '#1 / #5 — strong hands must always bet / checking always signals weakness',
}
