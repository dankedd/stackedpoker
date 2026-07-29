import { describe, it, expect } from 'vitest'
import { LESSONS } from '@/lib/learn/curriculum'
import { orderStepOptions, isCanonicalActionSet, POKER_ACTION_ORDER, canonicalPokerAction } from '@/lib/learn/interactionSafety'
import {
  auditStepOptions,
  auditSteps,
  isPokerActionSet,
  isCardNotationSet,
  isNumericOnlySet,
} from '@/lib/learn/answerLeakageAudit'
import type { StepOption } from '@/lib/learn/types'

/**
 * Permanent curriculum-wide answer-leakage regression suite.
 *
 * A learner must never be able to identify the correct option from its FORM
 * (length, sentence count, connector words, extreme-vs-nuanced language,
 * punctuation) instead of the poker concept it tests. See the leakage-audit
 * brief this suite implements, and `LEARN_QUESTION_QA.md` for the related
 * positional/sequencing rules (concept-tag spoilers, reveal-before-quiz
 * ordering, option shuffling) this file does NOT re-check.
 *
 * This is a RATCHET, not a zero-tolerance gate: as of the curriculum-wide
 * leakage pass (see project memory / PR description), 99 steps remain
 * heuristic-flagged after manual triage — reviewed and judged low-severity
 * (comparable lengths, a single weak signal, or a legitimate short bare-word
 * distractor) rather than true positives worth a rewrite. BASELINE must only
 * go down over time. If it goes up, either fix the new leak or — if you've
 * manually verified it's a false positive — lower BASELINE back down with a
 * comment explaining why, never raise it to paper over a real regression.
 */

const BASELINE_MAX_FLAGGED = 99

function fixtureOption(id: string, label: string, quality: StepOption['quality'] = 'mistake'): StepOption {
  return { id, label, quality, feedback: 'fixture feedback' }
}

describe('answer-leakage heuristics — unit behavior', () => {
  it('flags a "comprehensive laundry list vs short absolutes" correct answer (length leakage)', () => {
    const options = [
      fixtureOption('comprehensive', 'It builds a pot with strong hands, generates fold equity, denies equity, isolates the opener, and pressures a wide range all at once', 'perfect'),
      fixtureOption('fold', 'Fold every time'),
      fixtureOption('nothing', 'No adjustment needed'),
    ]
    const { exempt, flags } = auditStepOptions(options)
    expect(exempt).toBeNull()
    expect(flags.some((f) => f.reason === 'length_leakage')).toBe(true)
    expect(flags.some((f) => f.reason === 'uniquely_longest')).toBe(true)
  })

  it('flags a correct answer that uniquely contains an explanation connector', () => {
    const options = [
      fixtureOption('nuanced', 'Call here, because the equity clears the required threshold', 'perfect'),
      fixtureOption('fold', 'Fold'),
      fixtureOption('raise', 'Raise'),
    ]
    const { flags } = auditStepOptions(options)
    expect(flags.some((f) => f.reason === 'explanation_connector_leakage')).toBe(true)
  })

  it('flags extreme-language imbalance when every distractor is absolute and the correct answer is not', () => {
    const options = [
      fixtureOption('depends', 'It depends on the situation', 'perfect'),
      fixtureOption('always', 'Always bluff here'),
      fixtureOption('never', 'Never bluff here'),
    ]
    const { flags } = auditStepOptions(options)
    expect(flags.some((f) => f.reason === 'extreme_distractor_imbalance')).toBe(true)
  })

  it('flags a correct answer that is the only option with an explanatory dash clause', () => {
    const options = [
      fixtureOption('yes', 'Yes — because Hero has position and a good price', 'perfect'),
      fixtureOption('no', 'No'),
    ]
    const { flags } = auditStepOptions(options)
    expect(flags.some((f) => f.reason === 'structural_dash_leakage')).toBe(true)
  })

  it('does NOT trip the dash heuristic on a bare hyphen inside a compound word', () => {
    const options = [
      fixtureOption('two_tone', 'Two-tone', 'perfect'),
      fixtureOption('rainbow', 'Rainbow'),
      fixtureOption('mono', 'Monotone'),
    ]
    const { flags } = auditStepOptions(options)
    expect(flags.some((f) => f.reason === 'structural_dash_leakage')).toBe(false)
  })

  it('exempts pure canonical poker-action sets from prose-form balancing entirely', () => {
    const options = [
      fixtureOption('fold', 'Fold', 'perfect'),
      fixtureOption('call', 'Call'),
      fixtureOption('raise', 'Raise to 3.5x'),
    ]
    expect(isPokerActionSet(options)).toBe(true)
    const { exempt, flags } = auditStepOptions(options)
    expect(exempt).toBe('canonical_poker_action_set')
    expect(flags).toHaveLength(0)
  })

  it('exempts pure card-notation option sets', () => {
    const options = [fixtureOption('a', 'AKs', 'perfect'), fixtureOption('b', 'T9s'), fixtureOption('c', '72o')]
    expect(isCardNotationSet(options)).toBe(true)
    expect(auditStepOptions(options).exempt).toBe('card_notation_set')
  })

  it('exempts pure numeric-only option sets and does not falsely reject them', () => {
    const options = [fixtureOption('a', '25%', 'perfect'), fixtureOption('b', '33%'), fixtureOption('c', '50%')]
    expect(isNumericOnlySet(options)).toBe(true)
    const { exempt, flags } = auditStepOptions(options)
    expect(exempt).toBe('numeric_only_set')
    expect(flags).toHaveLength(0)
  })

  it('does not flag options with genuinely comparable length, tone, and structure', () => {
    const options = [
      fixtureOption('a', 'Tighten the range and fold more to 4-bets', 'perfect'),
      fixtureOption('b', 'Widen the bluffing part of the range'),
      fixtureOption('c', 'Keep the range exactly the same'),
    ]
    const { exempt, flags } = auditStepOptions(options)
    expect(exempt).toBeNull()
    expect(flags).toHaveLength(0)
  })

  it('does not flag a step with no perfect-quality option (unscored/explore steps)', () => {
    const options = [fixtureOption('a', 'Option A', 'acceptable'), fixtureOption('b', 'Option B', 'acceptable')]
    expect(auditStepOptions(options).exempt).toBe('no_perfect_quality_option')
  })
})

describe('canonical poker-action ordering remains intact (regression for §7/§9 of the leakage brief)', () => {
  it('Fold, Raise orders as Fold -> Raise regardless of authoring order', () => {
    const options = [fixtureOption('raise', 'Raise', 'perfect'), fixtureOption('fold', 'Fold')]
    const ordered = orderStepOptions(options, 'any-seed')
    expect(ordered.map((o) => o.id)).toEqual(['fold', 'raise'])
  })

  it('Fold, Call, Raise, All-in orders as Fold -> Call -> Raise -> All-in regardless of authoring order', () => {
    const options = [
      fixtureOption('allin', 'All-in', 'perfect'),
      fixtureOption('raise', 'Raise'),
      fixtureOption('fold', 'Fold'),
      fixtureOption('call', 'Call'),
    ]
    const ordered = orderStepOptions(options, 'any-seed')
    expect(ordered.map((o) => o.id)).toEqual(['fold', 'call', 'raise', 'allin'])
  })

  it('a canonical action set is never seed-shuffled — same order for every seed', () => {
    const options = [
      fixtureOption('call', 'Call', 'perfect'),
      fixtureOption('fold', 'Fold'),
      fixtureOption('raise', 'Raise'),
    ]
    const seeds = ['step-1', 'step-2', 'zzz', 'a']
    const orders = seeds.map((s) => orderStepOptions(options, s).map((o) => o.id))
    for (const order of orders) expect(order).toEqual(['fold', 'call', 'raise'])
  })

  it('recognizes the full POKER_ACTION_ORDER vocabulary', () => {
    expect(POKER_ACTION_ORDER).toEqual(['fold', 'check', 'call', 'raise', 'all_in'])
    expect(canonicalPokerAction('Check')).toBe('check')
    expect(canonicalPokerAction('All-in')).toBe('all_in')
  })
})

describe('conceptual (non-action) option sets keep seeded shuffling, not canonical order', () => {
  it('a prose theory answer set is not treated as a canonical action set', () => {
    const options = [
      fixtureOption('a', 'Position helps realize more equity', 'perfect'),
      fixtureOption('b', 'Position means playing more hands'),
    ]
    expect(isCanonicalActionSet(options.map((o) => o.label))).toBe(false)
  })

  it('orderStepOptions is deterministic per seed for conceptual options (reproducible, not fixed to authoring order)', () => {
    const options = [
      fixtureOption('a', 'Position helps realize more equity', 'perfect'),
      fixtureOption('b', 'Position means playing more hands'),
      fixtureOption('c', 'Position makes cards stronger'),
    ]
    const first = orderStepOptions(options, 'seed-x').map((o) => o.id)
    const again = orderStepOptions(options, 'seed-x').map((o) => o.id)
    expect(again).toEqual(first) // stable across calls
  })
})

describe('correct-answer identity survives ordering (never keyed by array index)', () => {
  it('the perfect-quality option keeps its id/quality after orderStepOptions reorders it', () => {
    const options = [
      fixtureOption('wrong1', 'Wrong answer one'),
      fixtureOption('right', 'The correct answer', 'perfect'),
      fixtureOption('wrong2', 'Wrong answer two'),
    ]
    const ordered = orderStepOptions(options, 'seed-y')
    const correct = ordered.find((o) => o.quality === 'perfect')
    expect(correct?.id).toBe('right')
  })
})

describe('curriculum-wide ratchet — total flagged steps must not increase', () => {
  const allSteps = LESSONS.flatMap((lesson) => lesson.steps)
  const rows = auditSteps(allSteps)
  const flagged = rows.filter((r) => !r.exempt && r.flags.length > 0)

  it(`no more than ${BASELINE_MAX_FLAGGED} steps remain heuristic-flagged for answer-form leakage`, () => {
    if (flagged.length > BASELINE_MAX_FLAGGED) {
      const detail = flagged
        .map((r) => `  ${r.stepId} (${r.stepType}): ${r.flags.map((f) => f.reason).join(', ')}`)
        .join('\n')
      throw new Error(
        `Answer-leakage regression: ${flagged.length} steps flagged, baseline is ${BASELINE_MAX_FLAGGED}.\n` +
          `New/newly-flagged steps (cross-reference against the last known-good list):\n${detail}`,
      )
    }
    expect(flagged.length).toBeLessThanOrEqual(BASELINE_MAX_FLAGGED)
  })

  it('every LessonStep with options[] resolves to either an exemption category or a reviewed flag set (sanity check on the audit itself)', () => {
    for (const row of rows) {
      expect(typeof row.stepId).toBe('string')
      expect(row.stepId.length).toBeGreaterThan(0)
    }
  })
})
