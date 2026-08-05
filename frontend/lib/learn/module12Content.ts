/**
 * The Language of Bet Sizing (Module 12) — centralized scenario data for Lessons 1-5, per
 * `docs/module-12-blueprint.md`'s Evidence Ledger, `docs/module-12-lessons.md`'s Part 2 content,
 * and `docs/module-12-architecture.md` Section 9's Data Architecture.
 *
 * SOURCE DISCIPLINE (see LEARN_QUESTION_QA.md + types.ts's SourceEvidenceType):
 *   - `HAND_RANGE_337_340` (Lessons 3-4) — the book's own [0-1] Toy Game Examples A-D
 *     (Modern Poker Theory, Ch.10 pp.603-609). Examples C and D's per-combo frequencies are
 *     EXACT quotes (Table 89's own 30%/70% aggregate for C; the book's explicit "AA 42%/58%,
 *     55 26%/74%, KK 100%" figures for D) — `source_reconstructed` in the strict sense that
 *     they reproduce a specific book example, not `exact_derived` from a live formula. Examples
 *     A and B's per-combo frequencies are an ILLUSTRATIVE RECONSTRUCTION: the book states each
 *     example's aggregate range-wide percentages (e.g. Example A: "Bet Full Pot 15% / Bet 2/3
 *     Pot 14% / Bet 1/3 Pot 15% / Check 56%") and describes the qualitative per-hand structure
 *     in prose ("AA using the biggest bet-size, KK using the second biggest... QQ using the
 *     smallest... balancing it out with 55, and 66 using all three-bet-sizes... JJ-77 are
 *     always checked") — but the book's own PRINTED per-combo percentage table (Hand Range 337)
 *     is a diagram that did not survive this project's PDF text extraction as inline digits.
 *     The per-hand splits below are constructed to match that qualitative structure exactly
 *     (which hand uses which size, in which order) without claiming to reproduce the book's
 *     unavailable exact digits — flagged `source_reconstructed` with this caveat stated
 *     explicitly, never presented to a learner as a claimed-precise book number. Only the
 *     aggregate EV figures (56.11%, 54.98%) are the book's own exact, quoted numbers.
 *   - `TOY_GAMES_A_TO_E` (Lesson 5) — the book gives the EXACT hand lists for all five Range
 *     Polarization Effect toy games (Ch.10 pp.615-618) but does not itself present them as
 *     Equity-Bucket (Strong/Good/Weak/Trash) percentages. The distributions below are a direct,
 *     straightforward combo-weighted computation FROM those exact book-stated hand lists —
 *     simple ordinal ranking (AA > KK > QQ > ... > 44, ties split, no card-removal adjustment,
 *     matching the toy game's own stated abstraction), classified against Module 10/11's own
 *     already-established Equity Bucket thresholds (Strong >=75%, Good 50-<75%, Weak 33-<50%,
 *     Trash <33%, Ch.10 p.597). Real ranges, real derived numbers, zero invented frequencies —
 *     classified `source_reconstructed`, not `exact_derived`, because the BUCKETING PRESENTATION
 *     itself is this project's own application of an existing framework to these five ranges,
 *     not something the book prints in this exact form.
 *   - `MISCONCEPTION_BY_CONCEPT_ID` / `MENTAL_MODEL_AUDIT` are non-runtime traceability constants
 *     only (see docs/module-11-architecture.md's identical precedent for `MISCONCEPTION_BY_CONCEPT_ID`).
 */

import type { LessonSource } from './types'
import type { RangeStrategyMap } from './rangeStrategy'
// Reused directly from Module 10's own constants — never re-declared, so the book/author
// string can't silently drift between content files (matches module11Content.ts's own precedent).
import { MPT_SOURCE, MPT_AUTHOR } from './gameTheoryContent'

// ── Lessons 3-4 — "One Size Rarely Fits All" / "The Small Cost of Simplifying" ────────────────

export const HAND_RANGE_337_340_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Splitting Your Range Into Multiple Bet-sizes — the [0-1] Toy Game (Ch.10 pp.603-609)',
  example: 'Hand Range 337-340',
  type: 'source_reconstructed',
}

/** The fixed 10-combo pool every Example A-D uses: AA down through 55, no suits shared, on a
 *  blank board chosen so no card-removal effects influence the results (p.603-604). */
export const HAND_RANGE_POOL = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55']

const CHECK_ALL: RangeStrategyMap = Object.fromEntries(
  ['JJ', 'TT', '99', '88', '77'].map((h) => [h, { check: 1 }]),
)

export const RANGE_COMPRESSION_EXAMPLE_A: { id: string; label: string; strategies: RangeStrategyMap; ev_label: string } = {
  id: 'example_a',
  label: 'No raise threat (Example A)',
  ev_label: '56.11% of the pot',
  strategies: {
    AA: { full_pot: 1 },
    KK: { two_thirds_pot: 1 },
    QQ: { one_third_pot: 1 },
    55: { one_third_pot: 1 },
    // "66 using all three-bet-sizes (the fraction of 55 in the range is not enough to make up
    // all the bluffing frequency so a small portion of 66 is used to make up the difference)" —
    // p.604-605. Illustrative split, not the book's own unavailable exact digits (see header).
    66: { full_pot: 0.05, two_thirds_pot: 0.05, one_third_pot: 0.4, check: 0.5 },
    ...CHECK_ALL,
  },
}

export const RANGE_COMPRESSION_EXAMPLE_B: { id: string; label: string; strategies: RangeStrategyMap; ev_label: string } = {
  id: 'example_b',
  label: 'Check-raise vs. 1/3-pot only (Example B)',
  ev_label: '54.98% of the pot',
  strategies: {
    AA: { full_pot: 1 },
    KK: { two_thirds_pot: 1 },
    // "QQ will shift entirely to the 2/3-pot bet-size" — p.605-606. The exposed 1/3-pot size is
    // abandoned entirely, not merely used less often (this module's central teaching moment).
    QQ: { two_thirds_pot: 1 },
    // 55's home (1/3-pot) is gone; with nothing left to pair it with, it gives up rather than
    // move to an exposed size — consistent with the book's later toy games' "give up with the
    // rest of the air" logic (p.789-790).
    55: { check: 1 },
    66: { full_pot: 0.05, two_thirds_pot: 0.55, check: 0.4 },
    ...CHECK_ALL,
  },
}

export const RANGE_COMPRESSION_EXAMPLE_C: { id: string; label: string; strategies: RangeStrategyMap; ev_label: string } = {
  id: 'example_c',
  label: 'Check-raise vs. every size (Example C)',
  // Table 89's own exact aggregate: "Bet Full Pot 30% / Bet 2/3 Pot 0% / Bet 1/3 Pot 0% / Check 70%".
  // AA(10%)+KK(10%)+55(10%)=30% exactly; the remaining 7 hands (70%) check — an exact match to
  // the book's own quoted totals, not an approximation.
  ev_label: 'EV falls further — collapsed to a single size',
  strategies: {
    AA: { full_pot: 1 },
    KK: { full_pot: 1 },
    55: { full_pot: 1 },
    QQ: { check: 1 },
    66: { check: 1 },
    ...CHECK_ALL,
  },
}

export const RANGE_COMPRESSION_EXAMPLE_D: { id: string; label: string; strategies: RangeStrategyMap; ev_label: string } = {
  id: 'example_d',
  label: 'All-in option added (Example D)',
  // Exact, fully-quoted book figures (p.607-609): "the all-in bet-size is used by AA 42% of the
  // time and balanced by bluffing with 55 26% of the time... The full pot bet-size is used by KK
  // 100% of the time and is balanced with AA 58% of the time... and with 55 74% of the time."
  ev_label: '55.06% of the pot (SPR 2)',
  strategies: {
    AA: { all_in: 0.42, full_pot: 0.58 },
    KK: { full_pot: 1 },
    55: { all_in: 0.26, full_pot: 0.74 },
    QQ: { check: 1 },
    66: { check: 1 },
    ...CHECK_ALL,
  },
}

export const RANGE_COMPRESSION_STATES = [
  RANGE_COMPRESSION_EXAMPLE_A,
  RANGE_COMPRESSION_EXAMPLE_B,
  RANGE_COMPRESSION_EXAMPLE_C,
  RANGE_COMPRESSION_EXAMPLE_D,
]

// ── Lesson 5 — "Why Your Range Shape Picks Your Bet Size" ────────────────────────────────────

export const TOY_GAMES_A_TO_E_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Range Polarization Effect — the [0-1] Toy Game A-E (Ch.10 pp.615-618, Table 92)',
  type: 'source_reconstructed',
}

interface EqbDist { label: string; strong: number; good: number; weak: number; trash: number }

/** Every entry below is a direct combo-weighted computation from the book's own exact stated
 *  hand lists for each toy game (simple ordinal ranking AA>KK>...>44, ties split evenly, no
 *  card-removal adjustment — matching the toy game's own abstraction), classified against
 *  Module 10/11's existing Equity Bucket thresholds. See file header for full sourcing note. */
export const TOY_GAME_A: { hero: EqbDist; villain: EqbDist } = {
  hero: { label: 'Hero (QQ-66)', strong: 14.3, good: 42.9, weak: 14.3, trash: 28.6 },
  villain: { label: 'Villain (AA-44)', strong: 36.4, good: 18.2, weak: 9.1, trash: 36.4 },
}

export const TOY_GAME_B: { hero: EqbDist; villain: EqbDist } = {
  hero: { label: 'Hero (KK-55)', strong: 22.2, good: 33.3, weak: 11.1, trash: 33.3 },
  villain: { label: 'Villain (AA-44)', strong: 27.3, good: 27.3, weak: 9.1, trash: 36.4 },
}

export const TOY_GAME_C: { hero: EqbDist; villain: EqbDist } = {
  hero: { label: 'Hero (AA-44)', strong: 27.3, good: 27.3, weak: 9.1, trash: 36.4 },
  villain: { label: 'Villain (AA-44)', strong: 27.3, good: 27.3, weak: 9.1, trash: 36.4 },
}

export const TOY_GAME_D: { hero: EqbDist; villain: EqbDist } = {
  hero: { label: 'Hero (AA-44)', strong: 27.3, good: 27.3, weak: 9.1, trash: 36.4 },
  villain: { label: 'Villain (KK-55)', strong: 22.2, good: 33.3, weak: 11.1, trash: 33.3 },
}

export const TOY_GAME_E: { hero: EqbDist; villain: EqbDist } = {
  hero: { label: 'Hero (AA-44)', strong: 36.4, good: 18.2, weak: 9.1, trash: 36.4 },
  villain: { label: 'Villain (QQ-66)', strong: 14.3, good: 42.9, weak: 14.3, trash: 28.6 },
}

export const TOY_GAMES_A_TO_E = [TOY_GAME_A, TOY_GAME_B, TOY_GAME_C, TOY_GAME_D, TOY_GAME_E]

// ── Traceability constants (Concept Registry / Misconception Ledger cross-reference) ─────────
// Purely for authoring/analytics traceability (see docs/module-12-architecture.md Section 7/9
// and Section 10's Mental Model Architecture) — never mutated at runtime, never rendered as a
// claim. Mirrors module11Content.ts's own identical MISCONCEPTION_BY_CONCEPT_ID precedent.

export const MISCONCEPTION_BY_CONCEPT_ID: Record<string, string> = {
  sizing_as_action_abstraction: '#5 / #6 — sizing chosen after the hand / solver sizes are arbitrary',
  alpha_size_dependence: 'none primary — mechanical fluency lesson',
  size_abandonment_mechanism: '#9 (first half) — more sizes are always more sophisticated',
  simplification_ev_cost: '#9 (concluding half) — more sizes are always more sophisticated',
  one_size_fits_board_caveat: '#4 — one sizing fits every board',
  polarization_sizing_direction: 'none primary — builds the prediction skill Lesson 8 corrects',
}

/** Mental Model Audit — Section 10's static authoring/QA traceability table (Blueprint's own
 *  Elite Quality Pass instruction), for Lessons 1-5 only (this phase's scope). Each row's
 *  `interactionType`/`concept_id` values are cross-checked against real, authored content by
 *  `module12Content.test.ts` — this constant is never read at runtime by any learner-facing
 *  component. */
export const MENTAL_MODEL_AUDIT: {
  lesson: number
  before: string
  after: string
  interactionType: string
  conceptId: string
}[] = [
  {
    lesson: 1,
    before: 'A bet-size is the amount of chips I decide to risk with this specific hand, chosen in the moment.',
    after: 'A bet-size is one entry from a small menu my whole strategy commits to in advance, before any specific hand is considered.',
    interactionType: 'bet_size_translator',
    conceptId: 'sizing_as_action_abstraction',
  },
  {
    lesson: 2,
    before: "I know a half-pot bet 'feels' like a medium-sized bet.",
    after: 'I can compute exactly what any bet-size demands — pot odds, Alpha, MDF, value:bluff ratio — as one connected cascade.',
    interactionType: 'bet_size_translator',
    conceptId: 'alpha_size_dependence',
  },
  {
    lesson: 3,
    before: 'More bet-sizes on the menu is more sophisticated — a strong strategy should split into as many sizes as possible.',
    after: "A size survives on the menu only if it can survive being raised — exposure causes total abandonment, not reduced usage.",
    interactionType: 'range_compression_explorer',
    conceptId: 'size_abandonment_mechanism',
  },
  {
    lesson: 4,
    before: 'If splitting into more sizes is theoretically best, simplifying to one size must be a real sacrifice.',
    after: 'A single, well-chosen size costs surprisingly little EV on average and is a legitimate default, with specific, nameable exceptions.',
    interactionType: 'range_compression_explorer',
    conceptId: 'simplification_ev_cost',
  },
  {
    lesson: 5,
    before: 'Whether I bet big or small is mostly a matter of style or how strong my hand feels.',
    after: "My range's polarization relative to my opponent's sets both the direction and magnitude of my sizing, on one smooth, predictable curve.",
    interactionType: 'board_and_street_sizing_matcher',
    conceptId: 'polarization_sizing_direction',
  },
]
