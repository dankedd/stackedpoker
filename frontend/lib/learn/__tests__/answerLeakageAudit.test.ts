import { describe, it, expect } from 'vitest'
import { LESSONS } from '@/lib/learn/curriculum'
import { orderStepOptions, isCanonicalActionSet, POKER_ACTION_ORDER, canonicalPokerAction } from '@/lib/learn/interactionSafety'
import {
  auditStepOptions,
  auditSteps,
  isPokerActionSet,
  isCardNotationSet,
  isNumericOnlySet,
  auditContentLeakage,
  ENFORCED_CONTENT_LEAK_REASONS,
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

// 99 -> 98: the content-leakage pass rewrote the option labels on fl2-s8,
// dip-s8a-reason, dip-s8b-reason, pce-s3b and hfc-s6b to be parallel bare
// categories, which also cleared one of them from the form heuristics.
const BASELINE_MAX_FLAGGED = 98

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

// ── Content leakage ──────────────────────────────────────────────────────────
// The second, independent class: option labels that hand over the specific
// hands/boards/figures the question asks the learner to derive. The form
// heuristics above cannot see this — in the motivating bug (`rtr-s3`, "did
// Hero's blocker remove value or bluffs?" with options `Value (AA)` /
// `Bluffs (76s)` / `Both` / `Neither`) TWO options carried a parenthetical, so
// `structural_parens_leakage` stayed silent while the answer sat on screen.
//
// Unlike the form ratchet above this is ZERO-TOLERANCE, which is only
// affordable because the enforced rule is deliberately narrow — see
// `ENFORCED_CONTENT_LEAK_REASONS`. The broader `names_specific_*` signals are
// advisory: a "which board favours the raiser?" question must name boards.

describe('content leakage — unit behavior', () => {
  it('flags the original rtr-s3 shape: category labels with the reasoning appended', () => {
    const flags = auditContentLeakage([
      fixtureOption('value', 'Value (AA)', 'perfect'),
      fixtureOption('bluffs', 'Bluffs (76s)'),
      fixtureOption('both', 'Both'),
      fixtureOption('neither', 'Neither'),
    ])
    expect(flags.some((f) => f.reason === 'appended_hand_leakage')).toBe(true)
  })

  it('passes the same question once the hands are moved into the feedback', () => {
    const flags = auditContentLeakage([
      fixtureOption('value', 'Value', 'perfect'),
      fixtureOption('bluffs', 'Bluffs'),
      fixtureOption('both', 'Both'),
      fixtureOption('neither', 'Neither'),
    ])
    expect(flags).toEqual([])
  })

  it('does NOT flag identifier labels, where the parenthetical defines the option', () => {
    // "Board A" is unanswerable without being told which board it is — the
    // parenthetical is the option's meaning, not evidence for choosing it.
    const flags = auditContentLeakage([
      fixtureOption('a', 'Board A (8♥7♥3♦)', 'perfect'),
      fixtureOption('b', 'Board B (K♠7♦2♥)'),
      fixtureOption('same', 'About the same'),
    ])
    expect(flags.some((f) => f.reason === 'appended_hand_leakage')).toBe(false)
  })

  // ── names_specific_hand ────────────────────────────────────────────────
  // The pocket-pair branch of this pattern carried a backreference to a group
  // that was never opened, which is a TypeScript error rather than a silently
  // wrong regex — so the shapes it is meant to catch had never actually been
  // exercised. These pin them down.

  it('flags a pocket pair appended to one option but not the others', () => {
    const flags = auditContentLeakage([
      fixtureOption('value', 'Value AA', 'perfect'),
      fixtureOption('bluffs', 'Bluffs'),
      fixtureOption('both', 'Both'),
    ])
    expect(flags.some((f) => f.reason === 'names_specific_hand')).toBe(true)
  })

  it('flags suited, offsuit and concrete-combo notation', () => {
    for (const label of ['Value 76s', 'Value T8o', 'Value A♣']) {
      const flags = auditContentLeakage([
        fixtureOption('value', label, 'perfect'),
        fixtureOption('bluffs', 'Bluffs'),
        fixtureOption('both', 'Both'),
      ])
      expect(flags.some((f) => f.reason === 'names_specific_hand'), label).toBe(true)
    }
  })

  it('does NOT read ordinary prose as a hand', () => {
    // A single rank letter, two DIFFERENT ranks with no suited/offsuit marker,
    // and plain English all have to stay quiet or the advisory signal is noise.
    for (const label of ['Ace high', 'Value', 'The turn card', 'Neither', 'A pair']) {
      const flags = auditContentLeakage([
        fixtureOption('a', label, 'perfect'),
        fixtureOption('b', 'Bluffs'),
        fixtureOption('c', 'Both'),
      ])
      expect(flags.some((f) => f.reason === 'names_specific_hand'), label).toBe(false)
    }
  })

  it('stays quiet when every option names a hand — that is the answer space', () => {
    // The minority rule, and the reason the pair branch must not fire here.
    expect(auditContentLeakage([
      fixtureOption('aa', 'Value AA', 'perfect'),
      fixtureOption('kk', 'Value KK'),
      fixtureOption('qq', 'Value QQ'),
    ]).some((f) => f.reason === 'names_specific_hand')).toBe(false)
  })

  it('does NOT flag an answer space genuinely made of hands', () => {
    expect(auditContentLeakage([
      fixtureOption('aa', 'AA', 'perfect'),
      fixtureOption('kk', 'KK'),
      fixtureOption('qq', 'QQ'),
    ])).toEqual([])
  })
})

describe('curriculum-wide content leakage — zero tolerance on the enforced rule', () => {
  it('no step appends the answer to a categorical option label', () => {
    const offenders: string[] = []
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (!step.options?.length) continue
        const enforced = auditContentLeakage(step.options)
          .filter((f) => ENFORCED_CONTENT_LEAK_REASONS.has(f.reason))
        for (const f of enforced) {
          offenders.push(`${lesson.id}/${step.id}: ${f.detail}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
