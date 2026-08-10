/**
 * Curriculum-wide answer-leakage heuristics.
 *
 * A learner must never be able to identify the correct option in a
 * `decision_spot`-style question from its FORM (length, sentence count,
 * connector words, extreme-vs-nuanced language, punctuation) instead of the
 * poker concept it tests. This module is a DETECTOR only — it flags
 * suspicious `options` arrays; it never rewrites content. See
 * `LEARN_QUESTION_QA.md` for the positional/sequencing leakage rules this
 * complements (concept-tag spoilers, reveal-before-quiz ordering, option
 * shuffling) — this file is specifically about the PROSE of the options
 * themselves.
 *
 * Used by:
 *  - `scripts/audit-answer-leakage.ts` (one-off/CI inventory dump)
 *  - `__tests__/answerLeakageAudit.test.ts` (permanent regression ratchet)
 */

import type { LessonStep, StepOption } from './types'

const EXPLANATION_CONNECTORS = [
  'because', 'therefore', 'while', 'but', 'so that', 'which means', 'since',
  'however', 'although', 'meaning', 'due to', 'given that', 'in order to',
]
const EXTREME_WORDS = [
  'always', 'never', 'every', 'none', 'completely', 'only', 'automatically',
  'regardless', 'all the time', 'no matter what', 'entirely', 'must',
]
const NUANCE_WORDS = [
  'generally', 'usually', 'depending', 'appropriate', 'selectively', 'some',
  'more often', 'less often', 'balanced', 'relative to', 'typically',
  'tends to', 'often', 'partially', 'somewhat', 'mostly',
]

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}
function sentenceCount(s: string): number {
  return (s.match(/[.!?]+(\s|$)/g) || []).length || 1
}
function countMatches(s: string, terms: string[]): string[] {
  const lower = s.toLowerCase()
  return terms.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower))
}
function hasNumericPrecision(s: string): boolean {
  return /\d+\.\d+%?/.test(s)
}
function hasPlainNumber(s: string): boolean {
  return /\b\d+%?\b/.test(s)
}

// ── Eligibility filters (categorical exemptions — see LEARN_QUESTION_QA.md /
// the leakage-audit brief §15). These are FORM exemptions: option sets whose
// labels are not comparable prose at all, so length/tone balancing doesn't
// apply. Never add a one-off step-id exception here — extend a category.

/** Poker-action button sets (Fold/Call/Raise/...) — canonical Fold→Check→Call→
 *  Raise→All-in ordering (see `interactionSafety.ts`), exempt from prose-form
 *  balancing entirely. Never randomize or length-balance these. */
const POKER_ACTION_RE =
  /^(fold|check|call|bet|raise|all-?in|shove|jam|limp|check-raise|donk bet|min-?raise|[2-5]-?bet|3bet|squeeze)(\s*\(.*\))?(\s+(to|for)?\s*[~\d.]+%?(bb|x)?\.?)?$/i

export function isPokerActionSet(options: StepOption[]): boolean {
  return options.length > 0 && options.every((o) => POKER_ACTION_RE.test(o.label.trim()))
}

/** Pure card/rank/notation labels (e.g. "A♠K♠", "22", "T9s") — not prose. */
const CARD_NOTATION_RE = /^[2-9TJQKA]{1,2}[shdc♠♥♦♣]{0,2}[so]?$/i
export function isCardNotationSet(options: StepOption[]): boolean {
  return options.length > 0 && options.every((o) => CARD_NOTATION_RE.test(o.label.trim()))
}

/** Pure numeric-only options (e.g. "25%", "6", "3.5x") with no other prose. */
const NUMERIC_ONLY_RE = /^~?\d+(\.\d+)?\s?(%|bb|x|combos?)?$/i
export function isNumericOnlySet(options: StepOption[]): boolean {
  return options.length > 0 && options.every((o) => NUMERIC_ONLY_RE.test(o.label.trim()))
}

export interface LeakageFlag {
  reason: string
  detail: string
}

export interface LeakageAuditResult {
  /** Category name when the option set is exempt from prose auditing entirely, else null. */
  exempt: string | null
  flags: LeakageFlag[]
}

/**
 * Audits one step's `options` array for form-based answer leakage. Returns
 * `exempt` for option sets that aren't comparable prose (poker actions, card
 * notation, numeric-only, or steps with no `quality: 'perfect'` option to
 * anchor the comparison). Otherwise returns zero or more heuristic `flags` —
 * each is a signal to REVIEW, not an automatic verdict; false positives are
 * expected and should be classified by a human/manual pass, never
 * auto-rewritten (see the leakage-audit brief §17).
 */
export function auditStepOptions(options: StepOption[]): LeakageAuditResult {
  if (isPokerActionSet(options)) return { exempt: 'canonical_poker_action_set', flags: [] }
  if (isCardNotationSet(options)) return { exempt: 'card_notation_set', flags: [] }
  if (isNumericOnlySet(options)) return { exempt: 'numeric_only_set', flags: [] }
  if (options.length < 2) return { exempt: 'single_option', flags: [] }

  const correctIdx = options.findIndex((o) => o.quality === 'perfect')
  if (correctIdx === -1) return { exempt: 'no_perfect_quality_option', flags: [] }

  const correct = options[correctIdx]
  const distractors = options.filter((_, i) => i !== correctIdx)

  const labels = options.map((o) => o.label)
  const words = labels.map(wordCount)
  const correctWords = words[correctIdx]
  const distractorWords = distractors.map((o) => wordCount(o.label))
  const medianDistractorWords = distractorWords.slice().sort((a, b) => a - b)[Math.floor(distractorWords.length / 2)] || 1

  const flags: LeakageFlag[] = []

  // A. Length leakage
  const ratio = correctWords / Math.max(1, medianDistractorWords)
  if (correctWords >= 8 && ratio >= 1.8) {
    flags.push({
      reason: 'length_leakage',
      detail: `correct option = ${correctWords} words, median distractor = ${medianDistractorWords} words, ratio = ${ratio.toFixed(2)}x`,
    })
  }
  const maxLen = Math.max(...words)
  const minLen = Math.min(...words)
  if (correctWords === maxLen && maxLen >= 6 && maxLen / Math.max(1, minLen) >= 1.8) {
    flags.push({
      reason: 'uniquely_longest',
      detail: `correct answer is the uniquely longest option (${maxLen} words vs shortest ${minLen})`,
    })
  }

  // B/C. Explanation-connector / nuance leakage — only correct option contains them
  const correctConnectors = countMatches(correct.label, EXPLANATION_CONNECTORS)
  const distractorConnectors = new Set(distractors.flatMap((o) => countMatches(o.label, EXPLANATION_CONNECTORS)))
  if (correctConnectors.length > 0 && distractorConnectors.size === 0) {
    flags.push({
      reason: 'explanation_connector_leakage',
      detail: `correct answer uniquely contains connector word(s): ${correctConnectors.join(', ')}`,
    })
  }
  const correctNuance = countMatches(correct.label, NUANCE_WORDS)
  const distractorNuance = new Set(distractors.flatMap((o) => countMatches(o.label, NUANCE_WORDS)))
  if (correctNuance.length > 0 && distractorNuance.size === 0) {
    flags.push({
      reason: 'nuance_leakage',
      detail: `correct answer uniquely contains nuance word(s): ${correctNuance.join(', ')}`,
    })
  }

  // D. Extreme distractors — every distractor has extreme language, correct has none
  const correctExtreme = countMatches(correct.label, EXTREME_WORDS)
  const distractorsWithExtreme = distractors.filter((o) => countMatches(o.label, EXTREME_WORDS).length > 0)
  if (correctExtreme.length === 0 && distractorsWithExtreme.length === distractors.length && distractors.length > 0) {
    flags.push({
      reason: 'extreme_distractor_imbalance',
      detail: `all ${distractors.length} distractor(s) contain extreme/absolute language; correct answer contains none`,
    })
  }

  // I. Numeric precision leakage
  const correctPrecise = hasNumericPrecision(correct.label)
  const distractorsPrecise = distractors.filter((o) => hasNumericPrecision(o.label))
  if (correctPrecise && distractorsPrecise.length === 0 && distractors.some((o) => hasPlainNumber(o.label))) {
    flags.push({
      reason: 'numeric_precision_leakage',
      detail: `correct answer uses decimal precision while numeric distractors are round numbers`,
    })
  }

  // J. Structural leakage — parentheses / dash only in correct
  const correctHasParens = /\(.*\)/.test(correct.label)
  const distractorsHaveParens = distractors.filter((o) => /\(.*\)/.test(o.label))
  if (correctHasParens && distractorsHaveParens.length === 0) {
    flags.push({ reason: 'structural_parens_leakage', detail: 'correct answer is the only option with a parenthetical' })
  }
  // A spaced em/en dash (" — "/" – ") introduces an explanatory clause; a bare
  // hyphen inside a compound word ("two-tone", "3-bet", "in-position") is not
  // leakage and must not trip this — only match the whitespace-delimited form.
  const CLAUSE_DASH_RE = /\s[–—]\s/
  const correctHasDash = CLAUSE_DASH_RE.test(correct.label)
  const distractorsHaveDash = distractors.filter((o) => CLAUSE_DASH_RE.test(o.label))
  if (correctHasDash && distractorsHaveDash.length === 0) {
    flags.push({ reason: 'structural_dash_leakage', detail: 'correct answer is the only option with an explanatory dash clause' })
  }

  // Sentence-count deviation
  const sentCounts = options.map((o) => sentenceCount(o.label))
  const correctSent = sentCounts[correctIdx]
  const otherSentMax = Math.max(...distractors.map((o) => sentenceCount(o.label)))
  if (correctSent >= 2 && correctSent > otherSentMax) {
    flags.push({
      reason: 'sentence_count_leakage',
      detail: `correct answer has ${correctSent} sentences vs distractor max ${otherSentMax}`,
    })
  }

  return { exempt: null, flags }
}

// ── Content leakage ───────────────────────────────────────────────────────────
// A second, independent class from the form heuristics above. Those ask "can I
// spot the correct option from how it's WRITTEN?" — this one asks "does the
// option set hand me the reasoning I'm supposed to produce?"
//
// The motivating bug: a step asking "did Hero's blocker remove value, bluffs,
// both, or neither?" whose options read `Value (AA)` / `Bluffs (76s)` /
// `Both` / `Neither`. The parentheticals name the exact hand classes the
// learner is meant to work out, turning a reasoning question into a
// read-the-label question. Note the form detector CANNOT catch this: two
// different options carry parentheticals, so `structural_parens_leakage`
// stays silent.
//
// Detector, not verdict — same contract as `auditStepOptions`. Categorical
// answer sets legitimately made OF hands or numbers (pick the hand, pick the
// frequency) are exempt via the same eligibility filters, because there the
// notation IS the answer rather than a hint toward it.

/** Concrete hand-class notation: AA, AKs, 76s, T8o, JJ. Requires two ranks so
 *  a bare 'A' or a stray 'K' in prose can't trip it. */
const HAND_CLASS_RE = /\b([2-9TJQKA])\1?[2-9TJQKA]?(?:s|o)?\b/

/**
 * Advisory-only signals. These were run curriculum-wide during the content
 * leakage pass and produced ~46 hits, of which all but three were legitimate:
 * a question like "which board favors the raiser?" MUST name boards in its
 * options, "which is rarer, trips or paired?" must name the structures, and a
 * reasoning option may quote a figure the step's own narrative already gave.
 *
 * They are therefore reported by `auditContentLeakage` for a human to triage
 * but are NOT part of the enforced gate — see `ENFORCED_CONTENT_LEAK_REASONS`.
 * The enforced rule is `appended_hand_leakage`, which is the shape that is
 * essentially always a real bug.
 */
const CONTENT_LEAK_PATTERNS: { reason: string; re: RegExp }[] = [
  // A specific hand class or concrete combo: AA, 76s, T8o, A♣T♦, K♥.
  //
  // Three shapes, because each needs a different anchor. The suited/offsuit
  // branch REQUIRES its s/o marker, so a pocket pair — which has none — needs
  // a branch of its own, and that is what the backreference is for: the same
  // rank twice ('AA'), not any two ranks ('AK' is not a hand class without a
  // marker). The concrete-combo branch sits outside the leading \b because a
  // suit symbol is not a word character.
  {
    reason: 'names_specific_hand',
    re: /\b(?:[2-9TJQKA]{2}(?:s|o)\b|([2-9TJQKA])\1\b)|[2-9TJQKA][♠♥♦♣]/,
  },
  // A concrete board: three or more cards written out.
  { reason: 'names_specific_board', re: /(?:[2-9TJQKA][♠♥♦♣]\s*){3,}/ },
  // An exact frequency/EV figure the learner is being asked to derive.
  { reason: 'names_exact_frequency', re: /\b\d+(?:\.\d+)?\s*%/ },
]

/** A hand class inside a parenthetical or after a dash — the specific shape
 *  that appends "here's the answer" to an otherwise clean categorical label
 *  ("Value (AA)"), as opposed to a label that legitimately IS a hand. */
const APPENDED_HAND_RE = /[(–—-]\s*[^)]*(?:[2-9TJQKA]{2}(?:s|o)\b|[2-9TJQKA][♠♥♦♣])/

export interface ContentLeakageFlag extends LeakageFlag {
  /** Which option labels tripped it. */
  optionIds: string[]
}

/** The subset of content-leak reasons that are a hard failure rather than a
 *  review prompt. Keep this tight: a gate that cries wolf gets muted. */
export const ENFORCED_CONTENT_LEAK_REASONS = new Set(['appended_hand_leakage'])

/**
 * Audits an option set for CONTENT leakage — option labels that name the
 * specific hands, boards, or figures the question asks the learner to derive.
 *
 * Exempt when the options are themselves the categorical answer space (pure
 * card notation, numeric-only, poker actions): "which hand blocks more?" with
 * hand-notation options is a legitimate question, not a leak.
 */
export function auditContentLeakage(options: StepOption[]): ContentLeakageFlag[] {
  if (options.length < 2) return []
  if (isCardNotationSet(options)) return []
  if (isNumericOnlySet(options)) return []
  if (isPokerActionSet(options)) return []

  // The signature case: SOME options are a bare category word and others append
  // a hand. A set where every label names a hand is a hand-comparison question.
  //
  // One principled exception: when the text BEFORE the parenthetical is a bare
  // referent ("Board A", "Hand B", "Option 1"), the parenthetical is what the
  // option even MEANS, not evidence for it — the learner cannot pick "Board A"
  // without being told which board that is. Contrast "Value (AA)", where
  // "Value" is already a complete, answerable label and "(AA)" only supplies
  // the reasoning the question asked for.
  const IDENTIFIER_LABEL_RE = /^(board|hand|option|scenario|line|player|spot)\s+[A-Z0-9]\b/i
  const appended = options.filter(
    (o) => APPENDED_HAND_RE.test(o.label) && !IDENTIFIER_LABEL_RE.test(o.label.trim()),
  )
  const bare = options.filter((o) => !HAND_CLASS_RE.test(o.label) && wordCount(o.label) <= 3)
  const flags: ContentLeakageFlag[] = []

  if (appended.length > 0 && bare.length > 0) {
    flags.push({
      reason: 'appended_hand_leakage',
      detail: `${appended.length} option(s) append a specific hand to a category label while ${bare.length} stay bare — the appended hands name the reasoning the learner should produce`,
      optionIds: appended.map((o) => o.id),
    })
  }

  for (const { reason, re } of CONTENT_LEAK_PATTERNS) {
    const hits = options.filter((o) => re.test(o.label))
    // Only interesting when it's a MINORITY of the set: if every option names a
    // board or a percentage, that's the answer space, not a hint.
    if (hits.length > 0 && hits.length < options.length) {
      flags.push({
        reason,
        detail: `${hits.length} of ${options.length} options name a specific ${reason.replace('names_specific_', '').replace('names_exact_', '')}: ${hits.map((o) => `"${o.label}"`).join(', ')}`,
        optionIds: hits.map((o) => o.id),
      })
    }
  }

  return flags
}

export interface LeakageAuditRow extends LeakageAuditResult {
  stepId: string
  stepType: string
}

/** Audits every `options`-bearing step in a flat step list (a lesson's `steps`, or any concatenation). */
export function auditSteps(steps: readonly LessonStep[]): LeakageAuditRow[] {
  const rows: LeakageAuditRow[] = []
  for (const step of steps) {
    if (!step.options || step.options.length === 0) continue
    const result = auditStepOptions(step.options)
    rows.push({ stepId: step.id, stepType: step.type, ...result })
  }
  return rows
}
