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
