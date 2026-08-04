/**
 * The single, canonical audit of every PreflopTable-rendering Learn step: does the
 * authored scenario data (`hero_position`/`table_size`/`action_before_hero`/
 * `effective_stack_bb`/`stack_overrides_bb`/`ante_bb`/`hero_hand`/`villain_position`)
 * describe the exact same poker situation as (a) the table it renders and (b) the
 * narrative prose a learner reads alongside it?
 *
 * (a) is guaranteed by construction — `PreflopTable` never computes pot/chips/
 * stacks/badges from anything but `buildPreflopTableRenderState`'s output (see
 * preflopTableState.ts), so there is no second table-state system that could drift.
 * This module's actual job is (b) plus the INTERNAL self-consistency of the
 * scenario data itself (a raise that doesn't exceed the previous bet, a Hero who's
 * already folded in their own action log, a Villain who isn't who the data says
 * Hero is actually facing) — every way #1's "narrative says X, action_before_hero
 * says nothing/something else" bug class could still slip back in.
 *
 * Used by both `scripts/validate-scenarios.ts` (a standalone report a contributor
 * or CI can run any time) and `__tests__/scenarioValidation.test.ts` (the same
 * checks wired into the normal test suite, so a new mismatch fails CI instead of
 * reaching a learner). One validator, two callers — never two implementations.
 */
import { normalizePosition } from '@/lib/replay/positions'
import {
  parseActionBeforeHero,
  buildPreflopTableRenderState,
  lastAggressorBeforeHero,
  extractNarrativeActionClaims,
  extractNarrativeStackClaims,
  extractNarrativeAnteClaims,
  type ParsedSeatAction,
  BB_BB,
} from './preflopTableState'
import type { Lesson, LessonStep } from './types'

export interface ScenarioIssue {
  lessonId: string
  lessonTitle: string
  stepId: string
  /** Which of the audited facts this issue is about — matches the validation
   *  system's own checklist (hero_position, stack sizing, action order, ...). */
  field: string
  message: string
}

/** The exact rendering gate `PreflopTable` is reachable through — kept as ONE
 *  predicate so the validator, the script, and the tests can never quietly drift
 *  from what actually renders a table (confirmed by grepping every step
 *  component that imports PreflopTable: DecisionSpot.tsx, TableDecision.tsx,
 *  ConceptReveal.tsx, ScenarioComparison.tsx). A `board` means postflop framing
 *  (a different visualization path), so those steps are out of scope here. */
const TABLE_RENDERING_TYPES = new Set(['decision_spot', 'table_decision'])
export function isTableRenderingStep(step: LessonStep): boolean {
  return (
    !!step.hero_position &&
    !(step.board?.length ?? 0) &&
    (TABLE_RENDERING_TYPES.has(step.type) || (step.type === 'concept_reveal' && step.visual === 'table'))
  )
}

const CARD_PAIR_RE = /([2-9TJQKA])([♠♥♦♣])\s*([2-9TJQKA])([♠♥♦♣])/g
const SUIT_SYMBOL_TO_LETTER: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' }

/** Every concrete 2-card hand the narrative names via suit-symbol notation
 *  ("A♠9♠"), converted to the same `['As','9s']` shape as `hero_hand`. Prose
 *  outside a decision spot's own hand rarely uses this notation for anything
 *  but Hero's actual holding, so a plain textual scan is safe here (unlike the
 *  seat-action claims above, which need sentence-position guards). */
function extractNarrativeCardPairs(narrative: string): string[][] {
  const pairs: string[][] = []
  for (const m of narrative.matchAll(CARD_PAIR_RE)) {
    const [, r1, s1, r2, s2] = m
    pairs.push([`${r1}${SUIT_SYMBOL_TO_LETTER[s1]}`, `${r2}${SUIT_SYMBOL_TO_LETTER[s2]}`])
  }
  return pairs
}

function sameHand(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const norm = (h: string[]) => [...h].map((c) => c.toLowerCase()).sort()
  const na = norm(a)
  const nb = norm(b)
  return na.every((c, i) => c === nb[i])
}

function pushIf(issues: ScenarioIssue[], lesson: Lesson, step: LessonStep, condition: boolean, field: string, message: string) {
  if (condition) issues.push({ lessonId: lesson.id, lessonTitle: lesson.title, stepId: step.id, field, message })
}

/** Validates one step against every audited fact. Returns an empty array for a
 *  step with nothing to say (no narrative, no action data, or genuinely
 *  consistent) — never a "no issues found" placeholder issue. */
export function validateStep(lesson: Lesson, step: LessonStep): ScenarioIssue[] {
  const issues: ScenarioIssue[] = []

  // ── 0. Scenario-comparison mirroring — independent of the table-rendering
  // gate below (a board/step-type check that only governs the single-table
  // path). `lessonCoachContext.ts` (AI Coach) reads a step's TOP-LEVEL
  // hero_position/villain_position/table_size/action_before_hero regardless
  // of step.type, while the visual (ScenarioComparison) only reads
  // scenario_a/scenario_b once both are present — so when a step authors
  // both, its top-level fields are a separate copy that must agree with
  // scenario_a (the question text always frames it as "Scenario 1"), or the
  // AI Coach silently gets fed the wrong half of the comparison.
  if (step.scenario_a && step.scenario_b && step.hero_position) {
    pushIf(
      issues, lesson, step, step.hero_position !== step.scenario_a.hero_position,
      'hero_position',
      `top-level hero_position ("${step.hero_position}") does not match scenario_a.hero_position ("${step.scenario_a.hero_position}") — the AI Coach reads the top-level field, not scenario_a directly`,
    )
    if (!(step.villain_position == null && step.scenario_a.villain_position == null)) {
      pushIf(
        issues, lesson, step, step.villain_position !== step.scenario_a.villain_position,
        'villain_position',
        `top-level villain_position ("${step.villain_position}") does not match scenario_a.villain_position ("${step.scenario_a.villain_position}")`,
      )
    }
    if (!(step.table_size == null && step.scenario_a.table_size == null)) {
      pushIf(
        issues, lesson, step, step.table_size !== step.scenario_a.table_size,
        'table_size',
        `top-level table_size (${step.table_size}) does not match scenario_a.table_size (${step.scenario_a.table_size})`,
      )
    }
    if (!(step.action_before_hero == null && step.scenario_a.action_before_hero == null)) {
      pushIf(
        issues, lesson, step,
        JSON.stringify(step.action_before_hero) !== JSON.stringify(step.scenario_a.action_before_hero),
        'action_order',
        `top-level action_before_hero does not match scenario_a.action_before_hero`,
      )
    }
  }

  if (!isTableRenderingStep(step)) return issues
  const heroPos = normalizePosition(step.hero_position!)
  const tableSize = step.table_size ?? 9

  // ── 1. action_before_hero's own internal consistency ──────────────────────
  const parsed = step.action_before_hero !== undefined
    ? parseActionBeforeHero(step.action_before_hero, step.hero_position!, tableSize)
    : undefined

  pushIf(
    issues, lesson, step,
    step.action_before_hero !== undefined && parsed === undefined,
    'action_order',
    `action_before_hero has an entry the parser can't read: ${JSON.stringify(step.action_before_hero)}`,
  )

  if (parsed) {
    let currentBet = BB_BB
    for (const entry of parsed) {
      if (entry.kind === 'raise' || entry.kind === 'allin') {
        pushIf(
          issues, lesson, step, entry.betBb! <= currentBet,
          'raise_sizing',
          `${entry.position} "raises" to ${entry.betBb}bb, which does not exceed the existing bet of ${currentBet}bb`,
        )
        currentBet = entry.betBb ?? currentBet
      }
    }
    pushIf(
      issues, lesson, step,
      parsed.some((e) => e.position === heroPos && e.kind === 'fold'),
      'current_player_to_act',
      `Hero (${heroPos}) appears as a completed FOLD in their own action_before_hero — the decision being asked can't already be resolved`,
    )
  }

  // Pot is always re-derived from the SAME seat commitments the table renders
  // from — this only ever catches a future refactor accidentally introducing a
  // second, hand-summed pot number that could drift from the seats themselves.
  if (parsed !== undefined || step.action_before_hero === undefined) {
    const state = buildPreflopTableRenderState({
      hero_position: step.hero_position,
      table_size: step.table_size,
      action_before_hero: step.action_before_hero,
      effective_stack_bb: step.effective_stack_bb,
      ante_bb: step.ante_bb,
      stack_overrides_bb: step.stack_overrides_bb,
    })
    if (state) {
      const anteContribution = step.ante_bb ? step.ante_bb * tableSize : 0
      const expectedPot = anteContribution + state.seats.reduce((sum, s) => sum + s.committedBb, 0)
      pushIf(
        issues, lesson, step, Math.abs(state.potBb - expectedPot) > 0.001,
        'pot_size',
        `rendered pot ${state.potBb}bb does not equal the sum of seat commitments + antes (${expectedPot}bb)`,
      )
      // An authored `pot_bb` (fed to other consumers like the AI Coach) must
      // agree with the SAME derived pot the table itself shows — never a
      // separately hand-maintained figure that can quietly drift.
      if (step.pot_bb != null) {
        pushIf(
          issues, lesson, step, Math.abs(state.potBb - step.pot_bb) >= 0.05,
          'pot_size',
          `authored pot_bb=${step.pot_bb} but the pot derived from action_before_hero is ${state.potBb}`,
        )
      }
    }
  }

  // ── 2. villain_position vs. who the action data actually says Hero faces ──
  if (step.villain_position && parsed) {
    const aggressor = lastAggressorBeforeHero(parsed)
    pushIf(
      issues, lesson, step,
      aggressor !== undefined && normalizePosition(step.villain_position) !== aggressor.position,
      'villain_position',
      `villain_position is "${step.villain_position}" but action_before_hero's last raise/all-in is ${aggressor!.position} — Hero isn't actually facing who the step says`,
    )
  }

  // ── 2b. villain_position with NO action_before_hero at all ─────────────────
  // A structural check independent of narrative-text parsing (check #3 below):
  // `villain_position` names who Hero is facing, which is meaningless unless
  // SOME action put them there. Authoring villain_position with
  // action_before_hero entirely absent (rather than even `[]`) means the table
  // renders with no opener label, no raise chip, and a blinds-only pot — a
  // real bug class the narrative-regex check below can miss (e.g. "Same UTG
  // open" back-references an earlier step's action with no restated size, so
  // it never matches a sized-raise pattern and slips through undetected).
  // Found 22 live instances of exactly this across Modules 4-5 in one sweep.
  pushIf(
    issues, lesson, step,
    !!step.villain_position && step.action_before_hero === undefined,
    'action_order',
    `villain_position is "${step.villain_position}" but action_before_hero is entirely unset — the table has no data to show who opened, so it renders as if nobody has acted (blinds-only pot, no opener label)`,
  )

  if (!step.narrative) return issues

  // ── 3. Narrative action claims vs. action_before_hero ──────────────────────
  const claims = extractNarrativeActionClaims(step.narrative, step.hero_position!)
  for (const claim of claims) {
    if (step.action_before_hero === undefined) {
      issues.push({
        lessonId: lesson.id, lessonTitle: lesson.title, stepId: step.id,
        field: actionClaimField(claim.kind),
        message: `narrative describes "${claim.position} ${claim.kind}${claim.betBb != null ? ` to ${claim.betBb}bb` : ''}" but action_before_hero is entirely absent`,
      })
      continue
    }
    if (!parsed) continue // already reported as an action_order parse failure above

    const found = parsed.some((e) => {
      if (e.position !== claim.position) return false
      const kindMatches = claim.kind === 'raise' ? (e.kind === 'raise' || e.kind === 'allin') : e.kind === claim.kind
      if (!kindMatches) return false
      if (claim.betBb == null) return true
      return e.betBb != null && Math.abs(e.betBb - claim.betBb) < 0.01
    })
    pushIf(
      issues, lesson, step, !found,
      actionClaimField(claim.kind),
      `narrative describes "${claim.position} ${claim.kind}${claim.betBb != null ? ` to ${claim.betBb}bb` : ''}" but no matching entry exists in action_before_hero: ${JSON.stringify(step.action_before_hero)}`,
    )
  }

  // ── 4. Hero's hole cards: narrative-named vs. hero_hand ────────────────────
  if (step.hero_hand) {
    for (const namedHand of extractNarrativeCardPairs(step.narrative)) {
      pushIf(
        issues, lesson, step, !sameHand(namedHand, step.hero_hand),
        'hero_hole_cards',
        `narrative names Hero's hand as ${namedHand.join('')} but hero_hand is ${step.hero_hand.join('')}`,
      )
    }
  }

  // ── 5. Effective stack / short-stack claims vs. effective_stack_bb / stack_overrides_bb ──
  const stackClaims = extractNarrativeStackClaims(step.narrative)
  const tableWideClaims = stackClaims.filter((c) => c.position === undefined)
  if (tableWideClaims.length > 0) {
    pushIf(
      issues, lesson, step,
      step.effective_stack_bb == null || !tableWideClaims.some((c) => Math.abs(c.stackBb - step.effective_stack_bb!) < 0.01),
      'effective_stack',
      `narrative states ${tableWideClaims.map((c) => c.stackBb).join('/')}bb effective but step.effective_stack_bb is ${step.effective_stack_bb ?? 'unset'}`,
    )
  }
  for (const claim of stackClaims.filter((c) => c.position !== undefined)) {
    const authored = step.stack_overrides_bb?.[claim.position!] ?? step.effective_stack_bb
    pushIf(
      issues, lesson, step,
      authored == null || Math.abs(authored - claim.stackBb) > 0.01,
      'stack_sizes',
      `narrative states ${claim.position} has ${claim.stackBb}bb but the authored stack for that seat is ${authored ?? 'unset'} — add a stack_overrides_bb entry so the table shows it`,
    )
  }

  // ── 6. Ante claims vs. ante_bb ──────────────────────────────────────────────
  for (const claim of extractNarrativeAnteClaims(step.narrative)) {
    if (!claim.present) {
      pushIf(issues, lesson, step, !!step.ante_bb, 'antes', `narrative says "no ante" but step.ante_bb is ${step.ante_bb}`)
    } else if (claim.anteBb != null) {
      pushIf(
        issues, lesson, step, step.ante_bb == null || Math.abs(step.ante_bb - claim.anteBb) > 0.0001,
        'antes',
        `narrative states a ${claim.anteBb}bb ante but step.ante_bb is ${step.ante_bb ?? 'unset'}`,
      )
    } else {
      pushIf(issues, lesson, step, !step.ante_bb, 'antes', `narrative says an ante is active but step.ante_bb is ${step.ante_bb ?? 'unset'}`)
    }
  }

  return issues
}

function actionClaimField(kind: ParsedSeatAction['kind']): string {
  switch (kind) {
    case 'raise': return 'raise_sizing'
    case 'allin': return 'all_in_amount'
    case 'call': return 'call_amount'
    case 'limp': return 'limp_size'
    case 'check': return 'action_order'
    case 'fold': return 'folded_players'
  }
}

export interface ScenarioValidationReport {
  totalLessons: number
  totalScenariosValidated: number
  issues: ScenarioIssue[]
}

/** The full sweep: every lesson, every PreflopTable-rendering step, PLUS every
 *  scenario_a/scenario_b comparison step (the top-level-mirroring check applies
 *  there independent of the table-rendering gate — see check #0 above). */
export function validateAllLessons(lessons: Lesson[]): ScenarioValidationReport {
  const issues: ScenarioIssue[] = []
  let totalScenariosValidated = 0
  for (const lesson of lessons) {
    for (const step of lesson.steps) {
      const isComparison = !!(step.scenario_a && step.scenario_b && step.hero_position)
      if (!isTableRenderingStep(step) && !isComparison) continue
      if (isTableRenderingStep(step)) totalScenariosValidated++
      issues.push(...validateStep(lesson, step))
    }
  }
  return { totalLessons: lessons.length, totalScenariosValidated, issues }
}
