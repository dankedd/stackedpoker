import { describe, it, expect } from 'vitest'
import { LESSONS } from '../curriculum'
import {
  buildPreflopTableRenderState,
  parseActionBeforeHero,
  SB_BB,
  BB_BB,
} from '../preflopTableState'
import { normalizePosition } from '@/lib/replay/positions'
import type { LessonStep } from '../types'

/**
 * The core invariant this whole file protects (see the "Realizing Equity" bug
 * that motivated it, re-s8a-d): the poker table must always visualize the
 * game state that exists at the moment the learner is asked to decide — not
 * the hand's starting state. `buildPreflopTableRenderState` already derives
 * everything (commitments, pot, stack-behind, fold state) from a step's
 * `hero_position`/`table_size`/`action_before_hero`/`ante_bb`/`effective_stack_bb`
 * fields ONLY — never from prose. These tests exist at two levels:
 *
 *  1. Scenario-level (A-H): pin the derivation engine's behavior for the
 *     exact hand shapes described in the spec, using the SAME engine every
 *     PreflopTable step already goes through — no second poker-state system.
 *  2. Repo-wide sweep: walk every authored step and catch content bugs
 *     (missing/incomplete action_before_hero, non-monotonic raises, a folded
 *     Hero, etc.) BEFORE they reach a learner — this is what makes the
 *     "Realizing Equity" bug class a permanent regression, not a one-off fix.
 */

// ── All PreflopTable-rendering steps in the curriculum ──────────────────────
// Matches the ACTUAL rendering gate exactly (confirmed by grepping which step
// components import PreflopTable: only DecisionSpot.tsx, TableDecision.tsx,
// and ConceptReveal.tsx — every other step type, e.g. range_bucket or
// spr_visualizer, never renders a table even when hero_position is set, so
// they're correctly out of scope for this invariant). A board means postflop —
// a different visualization path, also out of scope here.
const TABLE_RENDERING_TYPES = new Set(['decision_spot', 'table_decision'])
const allSteps: { lessonId: string; lessonTitle: string; step: LessonStep }[] = LESSONS.flatMap((lesson) =>
  lesson.steps.map((step) => ({ lessonId: lesson.id, lessonTitle: lesson.title, step })),
)
const tableSteps = allSteps.filter(
  ({ step }) =>
    !!step.hero_position &&
    !(step.board?.length ?? 0) &&
    (TABLE_RENDERING_TYPES.has(step.type) || (step.type === 'concept_reveal' && step.visual === 'table')),
)

describe('Repo-wide sweep — every PreflopTable-rendering step exists and is non-trivial', () => {
  it('found a substantial number of steps to audit (sanity guard against an empty/broken sweep)', () => {
    expect(tableSteps.length).toBeGreaterThan(100)
  })
})

describe('Scenario A — unopened pot (blinds only)', () => {
  it('SB 0.5 + BB 1 = 1.5 BB, no aggressor', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'UTG', table_size: 6, action_before_hero: [], effective_stack_bb: 100,
    })!
    expect(state.potBb).toBeCloseTo(1.5)
    expect(state.seats.find((s) => s.position === 'SB')?.committedBb).toBe(0.5)
    expect(state.seats.find((s) => s.position === 'BB')?.committedBb).toBe(1)
    expect(state.heroIsFirstToAct).toBe(true)
  })
})

describe('Scenario B — BTN open (the exact shape of the reported bug)', () => {
  it('BTN raises to 2.3, SB 0.5, BB 1 → BTN chip = 2.3, pot = 3.8', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN raises to 2.3bb', 'SB folds'],
    })!
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(2.3)
    expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 2.3 })
    expect(state.potBb).toBeCloseTo(3.8)
    expect(state.seats.find((s) => s.isHero)?.position).toBe('BB')
    expect(state.heroIsFirstToAct).toBe(false)
  })
})

describe('Scenario C — open + fold: a folded seat keeps its earlier commitment', () => {
  it('CO raises 2.3, BTN folds, SB folds, Hero BB acts — SB\'s blind stays in the pot', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN folds', 'SB folds'],
    })!
    const co = state.seats.find((s) => s.position === 'CO')!
    expect(co.action?.kind).toBe('raise')
    expect(co.committedBb).toBe(2.3)
    const sb = state.seats.find((s) => s.position === 'SB')!
    expect(sb.action?.kind).toBe('fold')
    expect(sb.committedBb).toBe(0.5) // the folded blind is NOT lost
    expect(state.seats.find((s) => s.isHero)?.committedBb).toBe(BB_BB)
    expect(state.potBb).toBeCloseTo(2.3 + 0.5 + 1)
  })
})

describe('Scenario D — open + call', () => {
  it('CO 2.3, BTN calls 2.3, SB folds, Hero BB acts → pot = 6.1', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN calls', 'SB folds'],
    })!
    expect(state.seats.find((s) => s.position === 'CO')?.committedBb).toBe(2.3)
    expect(state.seats.find((s) => s.position === 'BTN')?.committedBb).toBe(2.3)
    expect(state.potBb).toBeCloseTo(2.3 + 2.3 + 0.5 + 1)
    expect(state.potBb).toBeCloseTo(6.1)
  })
})

describe('Scenario E — open + 3-bet: commitments and pot exactly match the raise sequence', () => {
  it('CO 2.3, BTN 3-bets to 7.5, SB folds, BB folds, CO to act', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'CO', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN raises to 7.5bb', 'SB folds', 'BB folds'],
    })!
    const hero = state.seats.find((s) => s.isHero)!
    expect(hero.position).toBe('CO')
    expect(hero.committedBb).toBe(2.3) // Hero's own prior open, not overwritten
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(7.5)
    expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 7.5 })
    expect(state.potBb).toBeCloseTo(2.3 + 7.5 + 0.5 + 1)
  })
})

describe('Scenario F — open + 3-bet + 4-bet: commitments are REPLACED, never summed', () => {
  it('CO 2.3 → later 20 means CO total committed = 20, NOT 22.3', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN raises to 7.5bb', 'CO raises to 20bb', 'SB folds'],
    })!
    const co = state.seats.find((s) => s.position === 'CO')!
    expect(co.committedBb).toBe(20)
    expect(co.committedBb).not.toBe(22.3)
    const btn = state.seats.find((s) => s.position === 'BTN')!
    expect(btn.committedBb).toBe(7.5)
    expect(state.potBb).toBeCloseTo(20 + 7.5 + 0.5 + 1)
  })
})

describe('Scenario G — ante game: antes + blinds + raises = correct pot', () => {
  it('6-max, 0.125bb ante, CO raises to 2.3bb', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100, ante_bb: 0.125,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO raises to 2.3bb', 'BTN folds', 'SB folds'],
    })!
    const anteContribution = 0.125 * 6
    expect(state.potBb).toBeCloseTo(2.3 + 0.5 + 1 + anteContribution)
  })
})

describe('Scenario H — folded blind: forced-blind commitment survives the fold', () => {
  it('SB posts 0.5 and folds — dimmed/folded, but the 0.5 chip stays in the pot', () => {
    const state = buildPreflopTableRenderState({
      hero_position: 'BB', table_size: 6, effective_stack_bb: 100,
      action_before_hero: ['UTG folds', 'HJ folds', 'CO folds', 'BTN folds', 'SB folds'],
    })!
    const sb = state.seats.find((s) => s.position === 'SB')!
    expect(sb.action?.kind).toBe('fold')
    expect(sb.committedBb).toBe(0.5)
    expect(state.potBb).toBeCloseTo(0.5 + 1)
  })
})

describe('"Realizing Equity" regression (re-s8a-d) — the exact reported bug', () => {
  const lesson = LESSONS.find((l) => l.id === 'realizing-equity')
  if (!lesson) throw new Error('Fixture lesson "realizing-equity" not found — did curriculum content change?')

  for (const id of ['re-s8a', 're-s8b', 're-s8c', 're-s8d']) {
    it(`${id}: BTN's 2.3bb open is present in structured data, BB (Hero) is to act, pot is 3.8`, () => {
      const step = lesson.steps.find((s) => s.id === id)
      if (!step) throw new Error(`missing step ${id}`)

      expect(step.hero_position).toBe('BB')
      expect(step.villain_position).toBe('BTN')
      expect(step.effective_stack_bb).toBe(100)
      expect(step.action_before_hero).toBeDefined()

      const state = buildPreflopTableRenderState({
        hero_position: step.hero_position,
        table_size: step.table_size,
        action_before_hero: step.action_before_hero,
        effective_stack_bb: step.effective_stack_bb,
        ante_bb: step.ante_bb,
      })!

      const btn = state.seats.find((s) => s.position === 'BTN')!
      expect(btn.action).toEqual({ position: 'BTN', kind: 'raise', betBb: 2.3 })
      expect(btn.committedBb).toBe(2.3)
      expect(state.seats.find((s) => s.position === 'SB')?.committedBb).toBe(0.5)
      expect(state.seats.find((s) => s.isHero)?.committedBb).toBe(1)
      expect(state.potBb).toBeCloseTo(3.8)
      expect(state.heroIsFirstToAct).toBe(false)
    })
  }

  it('re-s8a actually renders "2.3" on the table via the real PreflopTable component', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { PreflopTable } = await import('@/components/learn/visuals/PreflopTable')
    const step = lesson.steps.find((s) => s.id === 're-s8a')!
    const html = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only JSX from a .ts file
      (await import('react')).createElement(PreflopTable as any, {
        tableSize: step.table_size,
        heroPosition: step.hero_position,
        heroHand: step.hero_hand,
        effectiveStackBb: step.effective_stack_bb,
        anteBb: step.ante_bb,
        actionBeforeHero: step.action_before_hero,
      }),
    )
    expect(html).toContain('>2.3<')
    expect(html).toContain('3.8 BB') // the pot, derived — never a separately hardcoded value
    expect(html).toContain('aria-label="BTN, RAISE"')
  })
})

describe('Repo-wide sweep — structural invariants that must hold for every authored step', () => {
  for (const { lessonId, step } of tableSteps) {
    if (!step.action_before_hero) continue

    describe(`${lessonId} / ${step.id}`, () => {
      it('action_before_hero parses without an unparseable entry (no silent syntax typo)', () => {
        const parsed = parseActionBeforeHero(step.action_before_hero, step.hero_position!, step.table_size ?? 9)
        expect(parsed, `action_before_hero has an entry the parser can't read: ${JSON.stringify(step.action_before_hero)}`).toBeDefined()
      })

      it('raise/all-in amounts strictly increase (a "raise" can never be <= the existing bet — catches sizing typos)', () => {
        const parsed = parseActionBeforeHero(step.action_before_hero, step.hero_position!, step.table_size ?? 9)
        if (!parsed) return // already covered by the parse test above
        let currentBet = BB_BB
        for (const entry of parsed) {
          if (entry.kind === 'raise' || entry.kind === 'allin') {
            expect(
              entry.betBb!,
              `${entry.position} "raises" to ${entry.betBb}bb, which does not exceed the existing bet of ${currentBet}bb`,
            ).toBeGreaterThan(currentBet)
            currentBet = entry.betBb!
          }
        }
      })

      it('Hero is never shown as already folded in their own action_before_hero (the decision being asked can\'t already be resolved)', () => {
        const parsed = parseActionBeforeHero(step.action_before_hero, step.hero_position!, step.table_size ?? 9)
        if (!parsed) return
        const heroPos = normalizePosition(step.hero_position!)
        const heroFolded = parsed.some((e) => e.position === heroPos && e.kind === 'fold')
        expect(heroFolded, `Hero (${heroPos}) appears as a completed FOLD in their own action_before_hero`).toBe(false)
      })

      it('pot equals the sum of every seat\'s commitment plus antes — never a separately hardcoded figure', () => {
        const state = buildPreflopTableRenderState({
          hero_position: step.hero_position,
          table_size: step.table_size,
          action_before_hero: step.action_before_hero,
          effective_stack_bb: step.effective_stack_bb,
          ante_bb: step.ante_bb,
        })!
        const anteContribution = step.ante_bb ? step.ante_bb * (step.table_size ?? 9) : 0
        const expectedPot = anteContribution + state.seats.reduce((sum, s) => sum + s.committedBb, 0)
        expect(state.potBb).toBeCloseTo(expectedPot)
      })
    })
  }
})

// ── The permanent guard for the "Realizing Equity" bug CLASS ────────────────
// Narrative is for the learner, never a runtime data source (see the module
// docstring) — but a narrative that UNAMBIGUOUSLY names an opener's raise
// size ("BTN opens to 2.3bb", "CO raises to 2.3bb") is a strong signal the
// step's structured action_before_hero must contain that exact raise. This
// lint only ever demands a curriculum-data fix — it is never used to drive
// rendering.
const NARRATIVE_RAISE_RE = /\b(UTG\+2|UTG\+1|UTG|LJ|HJ|CO|BTN|SB|BB)\s+(?:opens?|raises?)\s+to\s+([\d.]+)\s*bb/gi

describe('Repo-wide sweep — narrative-described opens/raises must exist in the structured action data', () => {
  for (const { lessonId, step } of tableSteps) {
    const narrative = step.narrative
    if (!narrative) continue
    const matches = [...narrative.matchAll(NARRATIVE_RAISE_RE)]
    if (matches.length === 0) continue

    for (const [, rawPos, rawAmt] of matches) {
      const pos = normalizePosition(rawPos)
      const amt = parseFloat(rawAmt)

      it(`${lessonId} / ${step.id}: narrative says "${rawPos} ... to ${rawAmt}bb" — action_before_hero must contain that raise`, () => {
        expect(
          step.action_before_hero,
          `narrative describes "${pos} raises to ${amt}bb" but action_before_hero is entirely absent`,
        ).toBeDefined()

        const parsed = parseActionBeforeHero(step.action_before_hero, step.hero_position!, step.table_size ?? 9)
        expect(parsed, 'action_before_hero exists but failed to parse').toBeDefined()

        const found = parsed!.some(
          (e) => e.position === pos && (e.kind === 'raise' || e.kind === 'allin') && Math.abs((e.betBb ?? -1) - amt) < 0.01,
        )
        expect(
          found,
          `no matching raise entry for ${pos} at ${amt}bb in action_before_hero: ${JSON.stringify(step.action_before_hero)}`,
        ).toBe(true)
      })
    }
  }
})
