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

// ── Lesson 4 — SPR bands (Table 90) ───────────────────────────────────────────────────────────

export const SPR_TABLE_90_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Splitting Your Range Into Multiple Bet-sizes — Table 90 (Ch.10 pp.609-610)',
  example: 'Table 90',
  type: 'source_reconstructed',
}

/** The book's own four SPR-band descriptions (p.609-610) — exact quoted bands, not interpolated. */
export const SPR_TABLE_90: { id: string; sprRange: string; band: string; description: string }[] = [
  { id: 'spr_1_or_below', sprRange: 'SPR 1 or below', band: 'All-in only', description: "Not enough stack behind a pot-size bet to make it meaningfully different from all-in, so the strategy doesn't bother maintaining the distinction." },
  { id: 'spr_1_to_2', sprRange: 'SPR 1-2', band: 'Pot / all-in split', description: 'The range splits between a pot-size bet and all-in — Example D\'s exact structure.' },
  { id: 'spr_3', sprRange: 'SPR 3', band: '75%-pot / 125%-pot split', description: "The all-in size stops being used; the betting range splits instead between two large-but-not-total sizes." },
  { id: 'spr_5_to_10', sprRange: 'SPR 5-10', band: '75%-pot / 150%-pot split', description: 'The two sizes drift further apart as more stack becomes available across the additional space.' },
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

// ── Lesson 7 — "Wrong Size, Real Cost" ────────────────────────────────────────────────────────

export const J22_SIZING_MISTAKE_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Overall Flop Metrics — the J♠2♥2♦ c-bet-sizing example (Ch.10 p.620)',
  type: 'source_reconstructed',
}

/** BB vs UTG, 30bb, flop J♠2♥2♦, x/b. Three exact, book-quoted EV figures for UTG's c-bet:
 *  correct (min-bet, full frequency) vs. the wrong-size mistake, unchanged vs. corrected frequency. */
export const J22_SIZING_MISTAKE = {
  board: ['Js', '2h', '2d'],
  correct: { label: 'Min-bet, 100% of range (correct)', ev: 77.05 },
  wrongSizeUnchangedFrequency: { label: '2/3-pot, unchanged frequency (the mistake)', ev: 71.01 },
  wrongSizeCorrectedFrequency: { label: '2/3-pot, corrected to 42.45% frequency', ev: 74.10 },
}

export const REVERSE_LINEAR_654R_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Donk-betting Ranges — the 6♠5♥4♦ Ace-high reverse-linear example (Ch.11 p.642)',
  type: 'source_reconstructed',
}

/** BB-vs-UTG donk-betting range on 6♠5♥4♦, 30bb. The weaker Ace-high combo (A9s) bets far MORE
 *  often than the stronger one (AQs) — showdown-value-rich hands want pot control; fold-equity-
 *  dependent hands need to bet to realize any value at all. */
export const REVERSE_LINEAR_654R = {
  board: ['6s', '5h', '4d'],
  strongerCombo: { hand: 'AQs', label: 'AQs — real showdown value', betFrequency: 40, mechanism: 'Pot control' },
  weakerCombo: { hand: 'A9s', label: 'A9s — little showdown value', betFrequency: 99, mechanism: 'Fold equity' },
}

// ── Lesson 8 — "Reading the Board Like the Solver Does" ──────────────────────────────────────
//
// Every entry below carries ONLY the numeric evidence the book actually states for that specific
// board category — never a full, invented Strong/Good/Weak/Trash quadruple. Unlike Toy Games A-E
// (Lesson 5, computed from the book's own EXACT hand lists) or J22/654r above (exact EV/frequency
// figures), most of this lesson's board evidence is prose-plus-one-statistic (an EV-of-pot share,
// a frequency-of-flops count, or — for two-tone specifically — a genuine Strong-hand percentage
// pair). Forcing every entry into range_distribution's 4-bucket bar would require inventing the
// missing Good/Weak/Trash splits for every category except none — so this data is authored for
// decision_spot's qualitative predict-then-justify pattern instead (see curriculum.ts's Lesson 8
// authoring note for the full, disclosed reasoning behind this component choice).

export const BOARD_GALLERY_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'Overall Flop Metrics (Ch.12 pp.655-674); Donk-betting Ranges (Ch.11 pp.631-651); Turn Play (Ch.13 pp.749-756)',
  type: 'source_reconstructed',
}

export const BOARD_GALLERY: {
  id: string
  category: 'structure' | 'texture' | 'donk_tier' | 'turn_shift'
  label: string
  board: string[]
  direction: 'small' | 'large' | 'min_bet' | 'check_heavy'
  preferredSize: string
  evidence: string
  /** Only present where the book states an actual Strong-bucket percentage pair (two-tone). */
  heroStrongPct?: number
  villainStrongPct?: number
}[] = [
  {
    id: 'trips', category: 'structure', label: 'Trips (e.g. 8♠8♥8♦)', board: ['8s', '8h', '8d'],
    direction: 'large', preferredSize: 'Bigger on lower trips; 1/3-pot still most frequent overall',
    evidence: 'The best flops in the book\'s evidence set for IP, who captures an average of 81% of the pot — the largest range-advantage gap of any structural category.',
  },
  {
    id: 'paired', category: 'structure', label: 'Paired (e.g. J♠2♥2♦)', board: ['Js', '2h', '2d'],
    direction: 'min_bet', preferredSize: 'Min-bet dominant; 2/3-pot essentially never used',
    evidence: 'Small bets force the checking range to reveal a lot of information, folding trash/weak hands regardless of size — IP loses the minimum by betting the smallest size that already does the job.',
  },
  {
    id: 'unpaired_generic', category: 'structure', label: 'Unpaired (82.82% of all flops)', board: ['Kh', '9d', '4c'],
    direction: 'large', preferredSize: "Depends on texture — see the Texture section",
    evidence: "The overwhelming majority of flops. \"Unpaired\" alone doesn't specify enough of the relative-polarization structure to predict sizing — texture (monotone/two-tone/rainbow) does the rest of the work.",
  },
  {
    id: 'monotone', category: 'texture', label: 'Monotone (e.g. J♠8♠4♠)', board: ['Js', '8s', '4s'],
    direction: 'small', preferredSize: 'Small, and the LOWEST-EV texture of the three for IP',
    evidence: "The most-c-bet texture by raw frequency, and simultaneously the lowest-EV for IP — the shared suit disproportionately upgrades OOP's previously-worthless hands into live flush draws, polarizing OOP and depolarizing IP. \"Betting large on monotone flops... forces the BB to fold the weak hands that would continue against a smaller bet and isolates yourself against the top of their range.\"",
  },
  {
    id: 'two_tone', category: 'texture', label: 'Two-tone (e.g. K♠9♠4♥)', board: ['Ks', '9s', '4h'],
    direction: 'large', preferredSize: 'Bigger than monotone, smaller than rainbow',
    evidence: 'IP holds roughly 24% Strong-bucket hands against OOP\'s roughly 5% — a real, meaningfully larger range-advantage gap than monotone produces, since the one extra off-suit card removes much of monotone\'s flush-completing symmetry.',
    heroStrongPct: 24, villainStrongPct: 5,
  },
  {
    id: 'rainbow', category: 'texture', label: 'Rainbow (e.g. K♠9♥4♦)', board: ['Ks', '9h', '4d'],
    direction: 'large', preferredSize: 'The biggest, most frequent sizing of the three textures',
    evidence: "IP's advantage here is the largest of the three textures, AND tends to hold up turn-to-river more reliably than two-tone's strength does, since there's no flush-completing card lurking to abruptly swing the texture.",
  },
  {
    id: 'donk_high', category: 'donk_tier', label: 'High donk-frequency (50%+, ~34 flops, e.g. 6♠5♥4♦)', board: ['6s', '5h', '4d'],
    direction: 'large', preferredSize: '1/4-pot at 30-40bb; 2/3-pot at a shallower 20bb',
    evidence: 'OOP holds the polarization advantage here, structurally resembling the Clairvoyance Toy Game directly — sizing shifts with SPR exactly as Table 90 predicts.',
  },
  {
    id: 'donk_mid', category: 'donk_tier', label: 'Mid donk-frequency (25-50%, ~100 flops)', board: ['Qs', 'Qh', '7d'],
    direction: 'large', preferredSize: 'Bigger on paired sub-families, smaller on unpaired ones',
    evidence: 'A smaller but still-real polarization edge for OOP; an even more polarized, bigger-sizing-leaning donking range at 20bb than at 30-40bb, confirming Table 90\'s SPR logic again.',
  },
  {
    id: 'donk_low', category: 'donk_tier', label: 'Low donk-frequency (10-25%, ~181 flops)', board: ['Ah', 'Ts', '6c'],
    direction: 'large', preferredSize: '67%-pot preferred over 25%-pot — bigger size, used less often',
    evidence: "OOP's donking range becomes \"a little more polarized\" even as overall frequency drops — a direct real-board confirmation of Lesson 5's curve: a smaller relative advantage still trends toward a bigger size when it does bet, it just bets less often overall.",
  },
  {
    id: 'donk_none', category: 'donk_tier', label: 'No-donk boards (0-10%, the large majority of flops)', board: ['Ac', 'Kd', 'Qh'],
    direction: 'check_heavy', preferredSize: 'Check 100% — near-zero EV cost to removing the donk-bet option',
    evidence: "IP's advantage is simply too large for OOP to profitably split at all — the real-board analogue of Toy Game A's pure-check result.",
  },
  {
    id: 'turn_dynamic', category: 'turn_shift', label: 'Dynamic turn: 9♥8♥4♦', board: ['9h', '8h', '4d'],
    direction: 'large', preferredSize: '2/3-pot stab after a flop check-back',
    evidence: 'After IP checks back a dynamic flop, IP\'s range becomes more capped/depolarized (strongest hands already bet on the flop), while OOP stays wide and uncapped — reversing the polarization relationship.',
  },
  {
    id: 'turn_static', category: 'turn_shift', label: 'Static turn: J♠6♥6♦', board: ['Js', '6h', '6d'],
    direction: 'small', preferredSize: '1/3-pot stab — smaller than the dynamic case',
    evidence: 'OOP\'s range stays meaningfully more polarized even after checking twice on a static texture — a smaller stab already collects enough folds against this specific structure.',
  },
]

// ── Lesson 9 — "The River's Blunt Instruments" ────────────────────────────────────────────────

export const TRAP_CURVE_DATA_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'River Calling Strategies — Diagrams 132-133, the polarized-vs-bluff-catcher-with-traps model (Ch.14 pp.791-793)',
  example: 'Diagrams 132-133',
  type: 'source_reconstructed',
}

/** Diagrams 132/133's own cited anchor points ONLY — never interpolated between them. At 0%
 *  traps, EV rises smoothly and caps near 90-95% of the pot by 4x-10x pot. At 10% traps, EV
 *  peaks around SPR 1.25 and then DECLINES — the book states the SPR location of the peak but
 *  not its exact EV value, so that value is intentionally left unstated here, not invented. */
export const TRAP_CURVE_DATA = {
  noTraps: {
    trapPct: 0,
    points: [
      { betSizeMultiple: 0, evPctOfPot: 50 }, // checking always: P1 has the winning hand 50% of the time
      { betSizeMultiple: 4, evPctOfPot: 90 },
      { betSizeMultiple: 10, evPctOfPot: 95 },
    ],
    shape: 'rises then flattens' as const,
  },
  tenPctTraps: {
    trapPct: 10,
    points: [
      // Checking 100% of the time: wins the pot 90% of the time -> EV = 45% of the pot.
      { betSizeMultiple: 0, evPctOfPot: 45 },
    ],
    peakSPR: 1.25,
    shape: 'rises then declines' as const,
  },
}

export const RIVER_MODEL_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: 'River Calling Strategies — minimum bet-size to deny equity (Ch.14 pp.786-789)',
  type: 'source_reconstructed',
}

// ── Lesson 10 — Capstone ──────────────────────────────────────────────────────────────────────

export const CAPSTONE_SCENARIO_SOURCE: LessonSource = {
  book: MPT_SOURCE,
  author: MPT_AUTHOR,
  section: "Module 12's own synthesis scenario — not a book-cited hand",
  type: 'pedagogical_model',
}

/** BB vs CO, 25bb — a stack depth Module 12 has not used anywhere else, chosen deliberately so no
 *  prior lesson's specific numbers can be recalled and reused without genuine re-reasoning.
 *  Explicitly `pedagogical_model`: this exact hand is Module 12's own construction, not a book
 *  example — every PRINCIPLE it requires (Lesson 8's texture reasoning, Module 11's range-merging,
 *  Lesson 9's river formulas) is book-sourced; the specific cards or by which the scenario weaves
 *  them together are not. */
export const CAPSTONE_SCENARIO = {
  heroPosition: 'BB' as const,
  villainPosition: 'CO' as const,
  effectiveStackBb: 25,
  flop: { board: ['Kd', '9d', '4s'], texture: 'two-tone, unpaired', principle: 'Lesson 8 — texture-calibrated sizing' },
  turn: { card: '2d', note: 'completes a possible flush, shifting relative polarization', principle: 'Module 11 range-merging + Lesson 5 Toy Game C' },
  river: { card: 'blank low card', villainEquityPct: 20, villainTrapPct: 10, principle: 'Lesson 9 — minimum-bet-to-deny + trap cap' },
}

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
  geometric_sizing_formula: 'none primary — self-contained theoretical-ceiling caveat',
  size_vs_frequency_fix: 'none primary — stress-tests Lessons 2-6, primes Lesson 8',
  reverse_linear_mechanism: 'none primary — stress-tests Lessons 2-6, primes Lesson 8',
  monotone_board_sizing: '#2 (primary) — a small bet means weakness',
  minimum_bet_formula: '#3, #7, #8 — overbet is a bluff / bigger is always safer / value density alone sizes',
  trap_cap_mechanism: '#3, #7, #8 — overbet is a bluff / bigger is always safer / value density alone sizes',
  capstone_synthesis: 'all nine ledger rows re-tested at once, per-street',
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
  {
    lesson: 6,
    before: "There isn't really one 'correct' size across multiple streets — you just bet big when you're ahead and let the pot grow naturally.",
    after: "There is a precise, computable ceiling — the geometric bet-size — that tells me exactly how aggressively a maximal, multi-street polarization advantage should be pressed, even though no real hand ever hits that ceiling exactly.",
    interactionType: 'spr_geometry_builder',
    conceptId: 'geometric_sizing_formula',
  },
  {
    lesson: 7,
    before: 'If I choose the wrong bet-size in a spot, I can just fix it later by adjusting how often I bet at that size.',
    after: 'A wrong size is only ever partially repairable by frequency — real EV is lost the moment the wrong size is chosen. And within a hand class, the WEAKEST combo often bets most, because value can come from fold equity instead of showdown strength.',
    interactionType: 'reverse_linear_sizing_lab',
    conceptId: 'reverse_linear_mechanism',
  },
  {
    lesson: 8,
    before: 'A scary-looking, draw-heavy board calls for a big bet to protect my hand — the more dangerous the texture looks, the bigger I should bet.',
    after: "A board's texture only matters through what it does to each range's RELATIVE composition — on monotone flops specifically, it's MY range that got weaker, calling for a smaller bet, not a bigger one.",
    interactionType: 'board_and_street_sizing_matcher',
    conceptId: 'monotone_board_sizing',
  },
  {
    lesson: 9,
    before: 'On the river, bigger bets are always safer, because they deny more equity and there is no more risk of a future card changing anything.',
    after: "River sizing is a precise calculation: there is a minimum bet that fully denies a stated equity, and a trap-defined ceiling past which going bigger actively LOSES EV rather than merely plateauing.",
    interactionType: 'river_sizing_calculator',
    conceptId: 'trap_cap_mechanism',
  },
  {
    lesson: 10,
    before: "I understand each of Module 12's sizing principles individually — separate, well-practiced facts.",
    after: 'I can look at an unfamiliar hand, street by street, and know which specific principle each street calls for, apply it, and reassess fresh at the next street. Sizing reasoning is one integrated skill, not nine separate facts.',
    interactionType: 'capstone_sizing_strategy',
    conceptId: 'capstone_synthesis',
  },
]
