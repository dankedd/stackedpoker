/**
 * Regression tests for Module 4 ("Preflop Aggression"), focused on the rule the
 * squeeze-lesson audit produced:
 *
 *   EVERY POST-ANSWER VISUALIZATION MUST REINFORCE THE CONCEPT THAT WAS JUST TESTED.
 *
 * The failure this pins is Lesson 7 (`the-squeeze`), where a question about
 * Hero's squeeze decision was followed by a chart of CO's OPENING RANGE — an
 * answer to a question nobody asked ("what does CO open?"), which quietly taught
 * the wrong concept at the exact moment the learner was most receptive. The same
 * mismatch had already been caught once at `pce-s5a` in Lesson 4, so this file
 * turns the one-off audit into a standing check across the whole module.
 *
 * The three rules below are deliberately structural rather than a hardcoded list
 * of known-good step ids, so a NEW step authored with the same mistake fails too.
 *
 * Sibling audits: module1Audit / module3Audit / module6Audit / module8Audit.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS, LESSONS_BY_MODULE } from '../curriculum'
import { evaluateStepLocally } from '../evaluator'
import type { LessonStep, StepOption } from '../types'

const MODULE_ID = 'preflop-aggression-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)

function findStep(id: string): LessonStep {
  const step = allSteps.find((s) => s.id === id)
  if (!step) throw new Error(`Fixture step "${id}" not found in Module 4 — did content change?`)
  return step
}

/** The only step types that can carry a post-answer range reveal or theory panel
 *  (evaluator.ts resolves both from a `decision_spot`-shaped step). Restricting the
 *  sweeps below to these isn't just an optimization: feeding a made-up option id to
 *  a range/builder step's evaluator exercises paths those steps never see in the
 *  app, and the resulting failures say nothing about visualization relevance. */
const REVEAL_CAPABLE = new Set(['decision_spot', 'table_decision'])
const revealCapableSteps = allSteps.filter((s) => REVEAL_CAPABLE.has(s.type))

/** Resolves a step exactly as the learner's screen would, by grading its FIRST
 *  option. Every post-answer visual is a passthrough of `step` alone (never of
 *  the grading — see DecisionSpotRangeReveal's doc comment), so which option is
 *  submitted can't change what's shown; the `range_reveal` identity assertion
 *  further down pins that invariant rather than assuming it. */
function reveals(step: LessonStep) {
  return evaluateStepLocally(step, step.options?.[0]?.id ?? '__none__', 0)
}

function optionsOf(step: LessonStep): StepOption[] {
  return step.options ?? []
}

function perfectOption(step: LessonStep): StepOption | undefined {
  return optionsOf(step).find((o) => o.quality === 'perfect')
}

// ── Rule 1: an opener's OPENING RANGE may only be shown when the step actually ──
//    tests reading the opener's range.

describe('Module 4 — an opening-range reveal requires the step to test opening-range strength', () => {
  const openerSteps = allSteps.filter((s) => s.range_reveal_direction === 'opener')

  it('every "opener" reveal sits on a step whose concepts include opener_range_strength', () => {
    for (const step of openerSteps) {
      expect(
        step.concept_ids ?? [],
        `${step.id} shows the opener's own opening range after the answer, but doesn't test ` +
          `opener_range_strength — the learner is being shown a chart for a question they weren't asked. ` +
          `Either test the opener's range here, or replace the chart with a Hero-side reveal / theory_panel.`
      ).toContain('opener_range_strength')
    }
  })

  it('the squeeze lesson shows no opening-range chart at all (the original regression)', () => {
    const squeeze = lessons.find((l) => l.slug === 'the-squeeze')
    expect(squeeze, 'Lesson 7 "the-squeeze" is missing from Module 4').toBeTruthy()
    for (const step of squeeze!.steps) {
      expect(
        step.range_reveal_direction,
        `${step.id}: a squeeze question must never be answered with an opening-range chart`
      ).not.toBe('opener')
      expect(reveals(step).range_reveal?.label ?? '', `${step.id} resolved an unexpected range chart`)
        .not.toMatch(/OPENING RANGE/i)
    }
  })
})

// ── Rule 2: a Hero-side reveal must actually be Hero's ─────────────────────────

describe('Module 4 — Hero-side reveals describe Hero, not Villain', () => {
  it('every non-opener range reveal is keyed to the step\'s own hero_position', () => {
    for (const step of revealCapableSteps) {
      if (step.range_reveal_direction === 'opener') continue
      const reveal = reveals(step).range_reveal
      if (!reveal) continue
      expect(reveal.heroPosition, `${step.id}: reveal hero seat drifted from the step's hero_position`)
        .toBe(step.hero_position)
      expect(
        reveal.label,
        `${step.id}: the primary panel is labelled "${reveal.label}" but should lead with Hero's seat (${step.hero_position})`
      ).toMatch(new RegExp(`^${step.hero_position}\\b`))
    }
  })

  it('a reveal describes the SPOT, so it never changes with the answer submitted', () => {
    for (const step of revealCapableSteps) {
      const opts = optionsOf(step)
      if (opts.length < 2) continue
      const a = evaluateStepLocally(step, opts[0].id, 0)
      const b = evaluateStepLocally(step, opts[opts.length - 1].id, 0)
      expect(b.range_reveal, `${step.id}: range_reveal leaked into grading`).toEqual(a.range_reveal)
      expect(b.theory_panel, `${step.id}: theory_panel leaked into grading`).toEqual(a.theory_panel)
    }
  })
})

// ── Rule 3: theory_panel is the no-chart fallback, and it must agree with the ──
//    answer key it explains.

describe('theory_panel is well-formed and agrees with the step it explains', () => {
  // Curriculum-wide, not Module 4 only — theory_panel is a shared mechanism, so the
  // rules that keep it honest should bind wherever it gets used next.
  const panelSteps = LESSONS.flatMap((l) => l.steps).filter((s) => s.theory_panel && REVEAL_CAPABLE.has(s.type))

  it('is only used where no range chart is shown (never both competing for the same slot)', () => {
    for (const step of panelSteps) {
      expect(
        reveals(step).range_reveal,
        `${step.id} renders BOTH a range chart and a theory panel — theory_panel exists for spots ` +
          `the canonical data can't back, so a chart resolving here means one of the two is wrong.`
      ).toBeUndefined()
    }
  })

  it('names the same action the answer key grades as perfect', () => {
    for (const step of panelSteps) {
      const panel = step.theory_panel!
      const perfect = perfectOption(step)
      if (!perfect) continue
      expect(
        perfect.label.toLowerCase(),
        `${step.id}: the theory panel tells the learner "${panel.verdict}" but the step scores ` +
          `"${perfect.label}" as the perfect answer — the panel must reinforce the grading, not contradict it.`
      ).toContain(panel.verdict.toLowerCase())
    }
  })

  it('carries the hand it is about, at least two weighed factors, and a takeaway', () => {
    for (const step of panelSteps) {
      const panel = step.theory_panel!
      expect(panel.hand.length, `${step.id}: theory panel has no hand`).toBeGreaterThan(0)
      expect(panel.label.length, `${step.id}: theory panel has no label`).toBeGreaterThan(0)
      expect(panel.factors.length, `${step.id}: a one-factor panel isn't an explanation`).toBeGreaterThanOrEqual(2)
      expect(panel.takeaway.length, `${step.id}: theory panel has no key takeaway`).toBeGreaterThan(0)
      for (const factor of panel.factors) {
        expect(factor.term.length, `${step.id}: factor with an empty term`).toBeGreaterThan(0)
        expect(factor.description.length, `${step.id}: factor "${factor.term}" has no description`).toBeGreaterThan(0)
      }
    }
  })

  it('weighs both sides — a panel where every factor points the same way is a verdict, not reasoning', () => {
    for (const step of panelSteps) {
      const weights = new Set(step.theory_panel!.factors.map((f) => f.weight ?? 'context'))
      expect(
        weights.size,
        `${step.id}: every factor carries the same weight, so the panel never shows the learner ` +
          `what argues the other way. Boundary hands are boundary hands because both sides have a case.`
      ).toBeGreaterThan(1)
    }
  })
})

// ── The squeeze lesson's own content, pinned ─────────────────────────────────
// Source: Modern Poker Theory — "Overcalling" (entering a pot after a raise AND
// a call: play TIGHTER than against a lone open; the caller's range withstands a
// 3-bet even with its premiums stripped; hands that hold value multiway are
// suited Ax / suited connectors / suited broadways / medium-small pairs, while
// offsuit high-card hands are usually dominated and realize equity poorly,
// especially OOP) plus the Small Blind defence sections (every SB-vs-open chart
// is 3-bet / fold, with no flatting range).

describe('Lesson 7 "The Squeeze" — Hero-side answer key', () => {
  it('KQo folds by default, squeezes at the boundary, and never calls', () => {
    const step = findStep('sqz-s5b')
    const byId = Object.fromEntries(optionsOf(step).map((o) => [o.id, o.quality]))
    expect(byId.fold).toBe('perfect')
    expect(byId['3bet']).toBe('acceptable')
    expect(byId.call).toBe('mistake')
    expect(step.theory_panel?.hand).toBe('KQo')
  })

  it('76s folds by default, with an overcall defensible (a suited connector holds value multiway)', () => {
    const step = findStep('sqz-s5c')
    const byId = Object.fromEntries(optionsOf(step).map((o) => [o.id, o.quality]))
    expect(byId.fold).toBe('perfect')
    expect(byId.call).toBe('acceptable')
    expect(byId['3bet']).toBe('mistake')
    expect(step.theory_panel?.hand).toBe('76s')
  })

  it('the sorting step offers no "call" bucket — from the SB the spot is squeeze or fold', () => {
    const step = findStep('sqz-s5')
    const ids = (step.range_bucket_categories ?? []).map((c) => c.id)
    expect(ids).toEqual(['squeeze', 'fold'])
    expect(step.range_bucket_correct?.KQo).toBe('fold')
    expect(step.range_bucket_acceptable?.KQo).toContain('squeeze')
  })

  it('the built squeezing range agrees with KQo folding, and stays tighter than a heads-up 3-bet range', () => {
    const combos = findStep('sqz-s7a').range_combos ?? []
    expect(combos, 'sqz-s7a would contradict sqz-s5b by putting KQo in the squeezing range').not.toContain('KQo')
    expect(combos.length).toBeLessThan(15)
  })
})
