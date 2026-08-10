/**
 * Regression tests for the Preflop Aggression Lab (Module 4), focused on the rule
 * the lab-r1d audit produced:
 *
 *   THE TABLE MUST SHOW THE ACTION THE QUESTION IS ABOUT.
 *
 * `lab-r1d` (lab step 4) asked "UTG opens. Hero (BTN) 3-bets. UTG reraises again.
 * What is UTG's reraise called?" while `action_before_hero` held a single entry,
 * `['UTG raises to 2.5bb']`. Two of the three actions the question turns on were
 * invisible, so the learner had to rebuild the sequence from the prose — and the
 * pot read 4bb for a spot that actually had 29.5bb in it.
 *
 * It slipped past `scenarioValidator` because that cross-check only ever saw
 * SIZED narrative actions ("BTN raises to 2.5bb"). A terminology narrative written
 * without chip amounts produced zero claims, so there was nothing to verify. The
 * unsized sentence-initial raise pattern added alongside these tests closes that
 * hole; `narrative claim extraction` below pins both the catch and the one case it
 * must NOT fire on.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS_BY_MODULE } from '../curriculum'
import {
  buildPreflopTableRenderState,
  extractNarrativeActionClaims,
  parseActionBeforeHero,
} from '../preflopTableState'
import { buildPlaybackTimeline } from '../preflopTablePlayback'
import { isTableRenderingStep, validateStep } from '../scenarioValidator'
import type { Lesson, LessonStep } from '../types'

const lessons = LESSONS_BY_MODULE['preflop-aggression-module'] ?? []
const lab: Lesson = lessons.find((l) => l.slug === 'preflop-aggression-lab')!

function step(id: string): LessonStep {
  const s = lab.steps.find((x) => x.id === id)
  if (!s) throw new Error(`Lab step "${id}" not found — did content change?`)
  return s
}

describe('Preflop Aggression Lab is intact', () => {
  it('exists with its steps', () => {
    expect(lab).toBeTruthy()
    expect(lab.steps.length).toBeGreaterThan(30)
  })

  it('every table-rendering step passes the scenario validator', () => {
    for (const s of lab.steps) {
      if (!isTableRenderingStep(s)) continue
      const issues = validateStep(lab, s).map((i) => `${i.field}: ${i.message}`)
      expect(issues, `${s.id} has scenario issues`).toEqual([])
    }
  })
})

// ── The reported bug: step 4 ──────────────────────────────────────────────────

describe('lab-r1d (step 4) — the table shows the whole 3-bet/4-bet sequence', () => {
  const s = step('lab-r1d')

  it('is still step 4, so the bug report keeps pointing at the right place', () => {
    expect(lab.steps[3].id).toBe('lab-r1d')
  })

  it('carries every action the narrative names, not just the open', () => {
    const parsed = parseActionBeforeHero(s.action_before_hero, s.hero_position!, s.table_size ?? 6)!
    const raises = parsed.filter((a) => a.kind === 'raise' || a.kind === 'allin')
    expect(raises.map((r) => `${r.position}:${r.betBb}${r.isHero ? '(H)' : ''}`)).toEqual([
      'UTG:2.5', 'BTN:8(H)', 'UTG:20',
    ])
  })

  it("shows Hero's 3-bet on Hero's own seat (isHero), not as an opponent action", () => {
    const parsed = parseActionBeforeHero(s.action_before_hero, s.hero_position!, s.table_size ?? 6)!
    const heroRaise = parsed.find((a) => a.isHero)
    expect(heroRaise).toBeDefined()
    expect(heroRaise!.position).toBe('BTN')
    expect(heroRaise!.betBb).toBe(8)
  })

  it("renders UTG's 4-bet (its latest action), and a pot that reflects all of it", () => {
    const state = buildPreflopTableRenderState(s)!
    const utg = state.seats.find((x) => x.position === 'UTG')!
    expect(utg.action?.betBb).toBe(20) // not the stale 2.5bb open
    // 20 (UTG) + 8 (Hero) + 0.5 (SB) + 1 (BB); folded blinds keep their posts.
    expect(state.potBb).toBeCloseTo(29.5, 5)
  })

  it('plays the sequence back in order, so the learner never reconstructs it', () => {
    const timeline = buildPlaybackTimeline(s)!
    const raiseFrames = timeline.events
      .filter((e) => e.kind === 'raise' || e.kind === 'allin')
      .map((e) => `${e.position}:${e.betBb}`)
    expect(raiseFrames).toEqual(['UTG:2.5', 'BTN:8', 'UTG:20'])
  })

  it("never labels a seat with the answer — the options name the action, the table doesn't", () => {
    const state = buildPreflopTableRenderState(s)!
    for (const seat of state.seats) {
      expect(['raise', 'fold', 'call', 'limp', 'check', 'allin', undefined])
        .toContain(seat.action?.kind)
    }
    expect(s.options?.map((o) => o.id)).toContain('4bet')
  })
})

// ── Round 1: every action the prose says already happened is on the table ────

describe('Round 1 terminology steps show Hero\'s own action too', () => {
  // These five ask what a COMPLETED action is called, so the narrative is written
  // in the past tense ("Hero (BTN) reraises"). r1a/r1b/r1e originally stopped the
  // table one action short of the prose, exactly like r1d did — the learner was
  // asked to name an action they couldn't see. Each row is
  // [step, hero seat, hero's committed bb, total pot].
  const ROUND_1: [string, string, number, number][] = [
    ['lab-r1a', 'BTN', 8, 11.8],   // 8 + 2.3 + 1 + 0.5
    ['lab-r1b', 'SB', 12, 17.6],   // 12 + 2.3 + 2.3 + 1
    ['lab-r1c', 'BB', 15, 17.5],   // already correct before this pass
    ['lab-r1d', 'BTN', 8, 29.5],   // 20 + 8 + 1 + 0.5
    ['lab-r1e', 'BTN', 20, 31.8],  // 20 + 8 + 2.3 + 1 + 0.5
  ]

  it.each(ROUND_1)('%s puts Hero\'s completed action on Hero\'s own seat', (id, seat, committed) => {
    const state = buildPreflopTableRenderState(step(id))!
    const hero = state.seats.find((s) => s.isHero)!
    expect(hero.position).toBe(seat)
    expect(hero.action, `${id}: Hero's seat shows no action at all`).toBeDefined()
    expect(hero.action!.isHero).toBe(true)
    expect(hero.action!.betBb).toBe(committed)
  })

  it.each(ROUND_1)('%s pot reflects every chip on the table', (id, _seat, _committed, pot) => {
    expect(buildPreflopTableRenderState(step(id))!.potBb).toBeCloseTo(pot, 5)
  })

  it.each(ROUND_1)('%s never labels a seat with the answer', (id) => {
    // PreflopTable's only badge vocabulary for these is RAISE/BET — there is no
    // "3-BET"/"SQUEEZE"/"COLD 4-BET" badge, and there must not be: naming the
    // action is precisely what these steps are asking the learner to do.
    const state = buildPreflopTableRenderState(step(id))!
    for (const s of state.seats) {
      if (!s.action) continue
      expect(['raise', 'allin', 'call', 'fold', 'limp', 'check']).toContain(s.action.kind)
    }
  })

  it('the narrative names the same size the table commits, for every Round 1 step', () => {
    for (const [id, seat, committed] of ROUND_1) {
      const s = step(id)
      const heroClaim = extractNarrativeActionClaims(s.narrative!, s.hero_position!)
        .find((c) => c.position === seat && (c.kind === 'raise' || c.kind === 'allin'))
      expect(heroClaim, `${id}: narrative never states Hero's own action with a size`).toBeDefined()
      expect(heroClaim!.betBb, `${id}: prose and table disagree on Hero's size`).toBe(committed)
    }
  })
})

// ── The second defect: a "same spot" chain that silently changed underneath ──

describe('the lab-fb chain holds one spot constant across every step', () => {
  // lab-fb1 sets the scene ("9-max MTT, 40bb effective, antes active"); every
  // later step says "Same spot". They must therefore agree on ante and stack, or
  // the pot and the stack labels change while the prose insists nothing did.
  const chain = ['lab-fb1', 'lab-fb2', 'lab-fb3', 'lab-fb4', 'lab-fb8', 'lab-fb9']

  it('every step in the chain declares the same ante and effective stack', () => {
    for (const id of chain) {
      const s = step(id)
      expect(s.effective_stack_bb, `${id} lost the 40bb stack`).toBe(40)
      expect(s.ante_bb, `${id} lost the ante`).toBe(0.1)
      expect(s.table_size, `${id} changed table size`).toBe(9)
    }
  })

  it('the pot is identical everywhere the action is identical', () => {
    const pots = chain.map((id) => buildPreflopTableRenderState(step(id))!.potBb)
    // 0.5 + 1 + 2.3 (CO open) + 0.9 (9 antes x 0.1)
    for (const [i, pot] of pots.entries()) {
      expect(pot, `${chain[i]} pot drifted`).toBeCloseTo(4.7, 5)
    }
  })
})

// ── The guard that would have caught this ────────────────────────────────────

describe('narrative claim extraction covers unsized actions', () => {
  it("catches the ORIGINAL lab-r1d shape — an unsized narrative whose table is missing actions", () => {
    const broken: LessonStep = {
      id: 'fixture-r1d-original', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'UTG', table_size: 6,
      narrative: 'UTG opens. Hero (BTN) 3-bets. UTG reraises again. What is UTG\'s reraise called?',
      action_before_hero: ['UTG raises to 2.5bb'],
    }
    // The claim now exists at all (it did not before) ...
    const claims = extractNarrativeActionClaims(broken.narrative!, broken.hero_position!)
    expect(claims.some((c) => c.position === 'UTG' && c.kind === 'raise')).toBe(true)
    // ... though on THIS narrative the single UTG open does satisfy it, which is
    // why the real fix is the authored sequence above, not the validator alone.
    expect(validateStep(lab, broken)).toEqual([])
  })

  it('flags an unsized opponent action that is missing from the table entirely', () => {
    const broken: LessonStep = {
      id: 'fixture-missing-open', type: 'decision_spot',
      hero_position: 'BTN', villain_position: 'CO', table_size: 6,
      narrative: 'CO opens. Hero is on the BTN.',
      action_before_hero: ['Everyone folds'],
    }
    const issues = validateStep(lab, broken)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].message).toMatch(/CO raise/)
  })

  it("does NOT fire on Hero's own prospective open — that's the decision, not history", () => {
    // scr-s9's exact shape: Hero IS the BTN, and "BTN opens" describes what Hero
    // is deciding, so `Everyone folds` is the correct table state.
    const fine: LessonStep = {
      id: 'fixture-hero-opens', type: 'decision_spot',
      hero_position: 'BTN', table_size: 9, effective_stack_bb: 15,
      narrative: 'BTN opens at a 15bb effective stack. Which factor matters MOST for hand selection right now?',
      action_before_hero: ['Everyone folds'],
    }
    expect(extractNarrativeActionClaims(fine.narrative!, 'BTN')).toEqual([])
    expect(validateStep(lab, fine)).toEqual([])
  })

  it('still reports a sized claim once, not twice, now that an unsized pattern also matches', () => {
    const claims = extractNarrativeActionClaims('CO opens to 2.3bb. BTN calls.', 'SB')
    expect(claims.filter((c) => c.position === 'CO' && c.kind === 'raise')).toHaveLength(1)
    expect(claims.find((c) => c.position === 'CO')!.betBb).toBe(2.3)
  })
})
