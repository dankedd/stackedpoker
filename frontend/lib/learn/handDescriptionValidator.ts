/**
 * Checks a lesson step's own prose (narrative, concept text, equity-bucket
 * scenario explanations) against what `handDrawAnalysis.ts` actually computes
 * from that step's `hero_hand`/`board` — the same "narrative claims vs.
 * derived truth" pattern `scenarioValidator.ts` already uses for action/stack/
 * ante claims, applied to draw/overcard/pair-status claims instead. Catches
 * the class of bug where a fixed hand's card-facts ("two overcards", "a
 * backdoor flush draw") get hand-written once and drift from the actual cards
 * (e.g. K♦J♦ on Q73 described as "two overcards" when only the King clears
 * the board's Queen) — never generates or rewrites prose itself, only flags
 * a mismatch for a human to fix, same division of labor scenarioValidator.ts
 * already has between itself and the content it checks.
 *
 * Deliberately conservative: only checks HIGH-CONFIDENCE, unambiguous phrases
 * (see `CLAIM_PATTERNS`) against a concrete 2-card `hero_hand` + 3-card flop
 * `board` — never flags a step for OMITTING a true fact (narrative prose is
 * selective by design; that's not an error), only for stating a fact that
 * contradicts the cards.
 */
import { analyzeHandVsFlop, type HandDrawFacts } from './handDrawAnalysis'
import type { ComparisonScenario, Lesson, LessonStep } from './types'

export interface HandDescriptionIssue {
  lessonId: string
  lessonTitle: string
  stepId: string
  /** Which scenario this claim came from, for scenario_a/scenario_b comparison steps. */
  scenarioLabel?: string
  field: string
  message: string
}

type ClaimKind =
  | 'overcard_count' | 'flush_draw' | 'backdoor_flush_draw' | 'straight_draw_oesd'
  | 'gutshot' | 'backdoor_straight_draw' | 'combo_draw'
  | 'top_pair' | 'overpair' | 'underpair' | 'two_pair' | 'set' | 'no_pair'

interface Claim {
  kind: ClaimKind
  /** Only set for 'overcard_count'. */
  count?: number
  matchedText: string
}

const OVERCARD_WORD_TO_COUNT: Record<string, number> = { zero: 0, no: 0, one: 1, two: 2 }

/** Words/prefixes that mean a nearby draw/pair phrase is NOT a direct claim
 *  about hero's own current hand — negation ("isn't a flush draw", "doesn't
 *  have a gutshot"), a "non-X" compound (regex `\b` matches inside "non-
 *  overpair" too), or a comparison/reference anchor ("beats every underpair
 *  QQ-55", "below top pair", "running two pair" as a FUTURE/villain-range
 *  reference rather than hero's present category). Checked in the ~35
 *  characters immediately before a match; if found, the match is skipped
 *  entirely rather than asserted in either direction — this validator only
 *  flags unambiguous, directly-asserted claims about hero's own hand, never
 *  guesses at a hedge/negation's intended polarity. */
const HEDGE_OR_NEGATION_RE = /\b(?:isn'?t|is\s+not|doesn'?t|does\s+not|don'?t|not\s+a|without|lacks?|below|beats?|every|any|against|running|villain|opponent|than|instead\s+of)\b/i

function isHedgedOrNegated(precedingText: string): boolean {
  // Only look at a short trailing window — a negation/comparison word from three
  // sentences earlier shouldn't suppress an unrelated later claim. Anywhere in
  // the window counts (not just immediately adjacent to the match) — real
  // prose puts several words between "isn't" and "close to a ... flush draw".
  const window = precedingText.slice(-45)
  if (/non-\s*$/i.test(window)) return true // "non-overpair" etc. — a hyphenated compound, no trailing word boundary to anchor on
  return HEDGE_OR_NEGATION_RE.test(window)
}

/** Extracts every high-confidence draw/pair claim from a block of prose.
 *  Order matters: backdoor variants are matched (and their span removed)
 *  before the generic "flush draw"/"straight" patterns so a real backdoor
 *  mention never also double-counts as a claimed live draw. */
function extractClaims(text: string): Claim[] {
  const claims: Claim[] = []
  let remaining = text

  function pushAll(re: RegExp, kind: ClaimKind, matchedTextOverride?: string) {
    for (const m of remaining.matchAll(re)) {
      if (m.index != null && isHedgedOrNegated(remaining.slice(0, m.index))) continue
      claims.push({ kind, matchedText: matchedTextOverride ?? m[0] })
    }
  }

  const backdoorFlush = /\bbackdoor\s+flush\s+draw\b|\bbackdoor\s+flush\b/gi
  pushAll(backdoorFlush, 'backdoor_flush_draw')
  remaining = remaining.replace(backdoorFlush, '')

  const backdoorStraight = /\bbackdoor\s+straight\s+draw\b|\bbackdoor\s+straight\s+potential\b|\bbackdoor\s+straight\b/gi
  pushAll(backdoorStraight, 'backdoor_straight_draw')
  remaining = remaining.replace(backdoorStraight, '')

  pushAll(/\bcombo\s+draw\b/gi, 'combo_draw')
  pushAll(/\bflush\s+draw\b/gi, 'flush_draw')
  pushAll(/\bopen[- ]ended\b|\bOESD\b/g, 'straight_draw_oesd')
  pushAll(/\bgutshot\b/gi, 'gutshot')

  const overcardRe = /\b(zero|no|one|two|\d)\s+overcards?\b/gi
  for (const m of remaining.matchAll(overcardRe)) {
    if (m.index != null && isHedgedOrNegated(remaining.slice(0, m.index))) continue
    const word = m[1].toLowerCase()
    const count = word in OVERCARD_WORD_TO_COUNT ? OVERCARD_WORD_TO_COUNT[word] : parseInt(word, 10)
    claims.push({ kind: 'overcard_count', count, matchedText: m[0] })
  }

  pushAll(/\bno pair\b/gi, 'no_pair')
  pushAll(/\btop pair\b/gi, 'top_pair')
  pushAll(/\boverpair\b/gi, 'overpair')
  pushAll(/\bunderpair\b/gi, 'underpair')
  pushAll(/\btwo pair\b/gi, 'two_pair')
  pushAll(/\bflops?\s+a\s+set\b|\bhas\s+a\s+set\b/gi, 'set', 'a set')

  return claims
}

const PAIR_CLAIM_CATEGORY: Partial<Record<ClaimKind, string>> = {
  top_pair: 'top_pair', overpair: 'overpair', underpair: 'underpair', two_pair: 'two_pair', set: 'set',
}

function checkClaim(claim: Claim, facts: HandDrawFacts): string | undefined {
  switch (claim.kind) {
    case 'overcard_count':
      if (claim.count !== facts.overcardCount) {
        return `text says "${claim.matchedText}" but the actual hand has ${facts.overcardCount} overcard(s) to this board`
      }
      return undefined
    case 'flush_draw':
      if (!facts.hasFlushDraw) {
        return `text says "${claim.matchedText}" but the hand does not have a real (non-backdoor) flush draw here${facts.hasBackdoorFlushDraw ? ' — it has a BACKDOOR flush draw' : ''}`
      }
      return undefined
    case 'backdoor_flush_draw':
      if (!facts.hasBackdoorFlushDraw) {
        return `text says "${claim.matchedText}" but the hand does not have a backdoor flush draw here${facts.hasFlushDraw ? ' — it has a real, live flush draw instead' : ''}`
      }
      return undefined
    case 'straight_draw_oesd':
      if (facts.straightDrawType !== 'oesd') {
        return `text says "${claim.matchedText}" (open-ended) but the actual straight-draw type here is "${facts.straightDrawType}"`
      }
      return undefined
    case 'gutshot':
      if (facts.straightDrawType !== 'gutshot') {
        return `text says "gutshot" but the actual straight-draw type here is "${facts.straightDrawType}"`
      }
      return undefined
    case 'backdoor_straight_draw':
      if (!facts.hasBackdoorStraightDraw) {
        return `text says "${claim.matchedText}" but the hand does not have backdoor straight potential here`
      }
      return undefined
    case 'combo_draw':
      if (!facts.isComboDraw) {
        return `text says "combo draw" but the hand doesn't have BOTH a real flush draw and a real straight draw here`
      }
      return undefined
    case 'no_pair':
      if (['set', 'two_pair', 'overpair', 'top_pair', 'weak_pair', 'underpair', 'straight'].includes(facts.category)) {
        return `text says "no pair" but the hand's actual category here is "${facts.category}"`
      }
      return undefined
    case 'top_pair':
    case 'overpair':
    case 'underpair':
    case 'two_pair':
    case 'set': {
      const expected = PAIR_CLAIM_CATEGORY[claim.kind]
      if (facts.category !== expected) {
        return `text says "${claim.matchedText}" but the hand's actual category here is "${facts.category}"`
      }
      return undefined
    }
  }
}

/** One (hero_hand, board, text-to-check) unit — a step's own top-level fields,
 *  or one side of a scenario_a/scenario_b comparison. */
function checkHandAgainstText(
  heroHand: string[] | undefined,
  board: string[] | undefined,
  textFields: { field: string; text: string | undefined }[],
): { field: string; message: string }[] {
  if (!heroHand || heroHand.length !== 2 || !board || board.length !== 3) return []
  const facts = analyzeHandVsFlop(heroHand, board)
  if (!facts) return []

  const issues: { field: string; message: string }[] = []
  for (const { field, text } of textFields) {
    if (!text) continue
    for (const claim of extractClaims(text)) {
      const message = checkClaim(claim, facts)
      if (message) issues.push({ field, message })
    }
  }
  return issues
}

export function validateStep(lesson: Lesson, step: LessonStep): HandDescriptionIssue[] {
  const issues: HandDescriptionIssue[] = []

  const stepTextFields = [
    { field: 'narrative', text: step.narrative },
    { field: 'concept_content', text: step.concept_content },
    { field: 'equity_bucket_scenario_explanation', text: step.equity_bucket_scenario_explanation },
    { field: 'decision_spot_question', text: step.decision_spot_question },
  ]

  const heroHand = step.hero_hand ?? step.equity_bucket_scenario_hero_hand
  for (const { field, message } of checkHandAgainstText(heroHand, step.board, stepTextFields)) {
    issues.push({ lessonId: lesson.id, lessonTitle: lesson.title, stepId: step.id, field, message })
  }

  const scenarios: [string, ComparisonScenario | undefined][] = [['scenario_a', step.scenario_a], ['scenario_b', step.scenario_b]]
  for (const [label, scenario] of scenarios) {
    if (!scenario) continue
    // A scenario's own narrative lives at the step level (shared across both sides) —
    // only hero_hand/board are per-scenario, so check them against the SAME step-level
    // text fields (a comparison step's prose almost always describes whichever scenario
    // is currently relevant using the step's own narrative/question, not a separate
    // per-scenario text field — there isn't one in the LessonStep/ComparisonScenario shape).
    for (const { field, message } of checkHandAgainstText(scenario.hero_hand, scenario.board, stepTextFields)) {
      issues.push({ lessonId: lesson.id, lessonTitle: lesson.title, stepId: step.id, scenarioLabel: label, field, message })
    }
  }

  return issues
}

export interface HandDescriptionReport {
  totalLessons: number
  totalStepsChecked: number
  issues: HandDescriptionIssue[]
}

export function validateAllLessons(lessons: Lesson[]): HandDescriptionReport {
  const issues: HandDescriptionIssue[] = []
  let totalStepsChecked = 0
  for (const lesson of lessons) {
    for (const step of lesson.steps) {
      const hasCheckableHand =
        (!!step.hero_hand && step.hero_hand.length === 2 && !!step.board && step.board.length === 3) ||
        (!!step.equity_bucket_scenario_hero_hand && step.equity_bucket_scenario_hero_hand.length === 2 && !!step.board && step.board.length === 3) ||
        (!!step.scenario_a?.hero_hand && !!step.scenario_a?.board) ||
        (!!step.scenario_b?.hero_hand && !!step.scenario_b?.board)
      if (hasCheckableHand) totalStepsChecked++
      issues.push(...validateStep(lesson, step))
    }
  }
  return { totalLessons: lessons.length, totalStepsChecked, issues }
}
