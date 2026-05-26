/**
 * puzzleIntegrity.ts
 *
 * Comprehensive puzzle integrity validation.
 * Checks hand strength, draw correctness, action ordering,
 * sizing order, coaching text coherence, and board consistency.
 *
 * This is the GATEKEEPER — puzzles that fail MUST NOT render.
 */

import type { Puzzle, PuzzleStep, ActionOption } from '../puzzle-types'

// ── Result types ───────────────────────────────────────────────────────────────

export interface IntegrityIssue {
  puzzleId: string
  stepIdx: number
  check: string
  severity: 'error' | 'warning'
  message: string
}

export interface IntegrityResult {
  puzzleId: string
  valid: boolean
  issues: IntegrityIssue[]
}

// ── Card & rank utilities (minimal, no external deps) ────────────────────────

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
}

const VALID_SUITS = new Set(['c', 'd', 'h', 's'])

function isValidCard(c: string): boolean {
  if (c.length !== 2) return false
  const rank = c[0].toUpperCase()
  const suit = c[1].toLowerCase()
  return rank in RANK_VALUES && VALID_SUITS.has(suit)
}

function cardSuit(c: string): string {
  return c[1].toLowerCase()
}

function cardRank(c: string): number {
  return RANK_VALUES[c[0].toUpperCase()] ?? 0
}

// ── Flush detection (exact combinatorics) ──────────────────────────────────

function countSuits(cards: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of cards) {
    const s = cardSuit(c)
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return counts
}

function hasMadeFlush(heroCards: string[], board: string[]): boolean {
  const all = [...heroCards, ...board]
  const counts = countSuits(all)
  for (const [suit, count] of counts) {
    if (count >= 5) {
      // Hero must contribute at least one card to this suit
      if (heroCards.some(c => cardSuit(c) === suit)) return true
    }
  }
  return false
}

function hasFlushDraw(heroCards: string[], board: string[]): boolean {
  const all = [...heroCards, ...board]
  const counts = countSuits(all)
  for (const [suit, count] of counts) {
    if (count === 4) {
      if (heroCards.some(c => cardSuit(c) === suit)) return true
    }
  }
  return false
}

// ── OESD detection (exact) ──────────────────────────────────────────────────

function hasOesd(heroCards: string[], board: string[]): boolean {
  const all = [...heroCards, ...board]
  const ranks = new Set(all.map(cardRank))
  if (ranks.has(14)) ranks.add(1) // Ace-low
  const heroRanks = new Set(heroCards.map(cardRank))

  for (let low = 1; low <= 10; low++) {
    const window = [low, low + 1, low + 2, low + 3, low + 4]
    const present = window.filter(r => ranks.has(r))
    const missing = window.filter(r => !ranks.has(r))

    if (present.length === 4 && missing.length === 1) {
      // 4 consecutive? Check if hero contributes
      const sorted = present.sort((a, b) => a - b)
      const consecutive = sorted.every((v, i) =>
        i === 0 || v === sorted[i - 1] + 1
      )
      if (consecutive && present.some(r => heroRanks.has(r))) {
        // Check both ends open (two different windows give this 4-card set)
        return true
      }
    }
  }
  return false
}

// ── Made hand check (simplified 5-card eval) ─────────────────────────────

function hasMadeStraight(heroCards: string[], board: string[]): boolean {
  const all = [...heroCards, ...board]
  if (all.length < 5) return false
  const ranks = new Set(all.map(cardRank))
  if (ranks.has(14)) ranks.add(1)

  for (let low = 1; low <= 10; low++) {
    const window = [low, low + 1, low + 2, low + 3, low + 4]
    if (window.every(r => ranks.has(r))) return true
  }
  return false
}

// ── Action ordering ──────────────────────────────────────────────────────────

const ACTION_ORDER: Record<string, number> = {
  fold: 0,
  check: 1,
  call: 2,
  bet: 3,
  raise: 4,
  jam: 5,
}

const ACTION_PATTERNS: [RegExp, string][] = [
  [/\bfold\b/i, 'fold'],
  [/\bcheck\b/i, 'check'],
  [/\bcall\b/i, 'call'],
  [/\bbet\b/i, 'bet'],
  [/\braise\b/i, 'raise'],
  [/\bjam\b/i, 'jam'],
  [/\ball[- ]?in\b/i, 'jam'],
  [/\bshove\b/i, 'jam'],
  [/\b3[- ]?bet\b/i, 'raise'],
  [/\b4[- ]?bet\b/i, 'raise'],
  [/\blimp\b/i, 'call'],
]

function getAggressionScore(label: string): number {
  for (const [re, action] of ACTION_PATTERNS) {
    if (re.test(label)) {
      return ACTION_ORDER[action] ?? 2
    }
  }
  return 2 // default mid-range
}

function extractSizing(label: string): number | null {
  const bbMatch = label.match(/\$?(\d+(?:\.\d+)?)\s*(?:bb|BB)/i)
  if (bbMatch) return parseFloat(bbMatch[1])
  const dollarMatch = label.match(/\$(\d+(?:\.\d+)?)\b/)
  if (dollarMatch) return parseFloat(dollarMatch[1])
  return null
}

// ── Coaching text patterns ───────────────────────────────────────────────────

const CLAIMS_FLUSH = /\b(?:you have (?:the|a) flush|made flush|nut flush(?! draw)|rivered (?:the|a) flush)\b/i
const CLAIMS_STRAIGHT = /\b(?:you have (?:the|a) straight|made (?:the|a)? straight|nut straight|rivered (?:the|a) straight)\b/i
const CLAIMS_STRONG = /\b(?:near top of range|top of (?:your )?range|bet for value|value bet|strong value)\b/i
const CLAIMS_OESD = /\bOESD\b/i
const CLAIMS_COMBO = /\bcombo draw\b/i

// ── Main validation ──────────────────────────────────────────────────────────

export function validatePuzzleIntegrity(puzzle: Puzzle): IntegrityResult {
  const issues: IntegrityIssue[] = []

  // Validate hero cards
  if (puzzle.heroCards.length !== 2) {
    issues.push({
      puzzleId: puzzle.id, stepIdx: -1, check: 'hero_cards',
      severity: 'error', message: `Expected 2 hero cards, got ${puzzle.heroCards.length}`,
    })
  } else {
    for (const c of puzzle.heroCards) {
      if (!isValidCard(c)) {
        issues.push({
          puzzleId: puzzle.id, stepIdx: -1, check: 'hero_cards',
          severity: 'error', message: `Invalid hero card: ${c}`,
        })
      }
    }
  }

  // Per-step validation
  for (let i = 0; i < puzzle.steps.length; i++) {
    const step = puzzle.steps[i]
    validateBoard(puzzle, step, i, issues)
    validateHandStrength(puzzle, step, i, issues)
    validateDrawClaims(puzzle, step, i, issues)
    validateActionOrder(puzzle.id, step, i, issues)
    validateSizingOrder(puzzle.id, step, i, issues)
  }

  return {
    puzzleId: puzzle.id,
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  }
}

// ── Board validation ─────────────────────────────────────────────────────────

function validateBoard(
  puzzle: Puzzle, step: PuzzleStep, stepIdx: number,
  issues: IntegrityIssue[],
) {
  const expected: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }
  const exp = expected[step.street]
  if (exp !== undefined && step.board.length !== exp) {
    issues.push({
      puzzleId: puzzle.id, stepIdx, check: 'board',
      severity: 'error',
      message: `Street '${step.street}' expects ${exp} board cards, got ${step.board.length}`,
    })
  }

  // Duplicate check (hero + board)
  const all = [...puzzle.heroCards, ...step.board].map(c => c.toUpperCase())
  const seen = new Set<string>()
  for (const c of all) {
    if (seen.has(c)) {
      issues.push({
        puzzleId: puzzle.id, stepIdx, check: 'board',
        severity: 'error', message: `Duplicate card: ${c}`,
      })
    }
    seen.add(c)
  }

  for (const c of step.board) {
    if (!isValidCard(c)) {
      issues.push({
        puzzleId: puzzle.id, stepIdx, check: 'board',
        severity: 'error', message: `Invalid board card: ${c}`,
      })
    }
  }
}

// ── Hand strength coherence ──────────────────────────────────────────────────

function validateHandStrength(
  puzzle: Puzzle, step: PuzzleStep, stepIdx: number,
  issues: IntegrityIssue[],
) {
  if (step.street === 'preflop' || step.board.length === 0) return

  const allText = collectStepText(step)

  // Claims flush but hero doesn't have one
  if (CLAIMS_FLUSH.test(allText) && !hasMadeFlush(puzzle.heroCards, step.board)) {
    issues.push({
      puzzleId: puzzle.id, stepIdx, check: 'hand_strength',
      severity: 'error',
      message: 'Text claims hero has a flush, but no flush is possible with these cards',
    })
  }

  // Claims straight but hero doesn't have one
  if (CLAIMS_STRAIGHT.test(allText) && !hasMadeStraight(puzzle.heroCards, step.board)) {
    issues.push({
      puzzleId: puzzle.id, stepIdx, check: 'hand_strength',
      severity: 'error',
      message: 'Text claims hero has a straight, but no straight is possible with these cards',
    })
  }
}

// ── Draw claims coherence ────────────────────────────────────────────────────

function validateDrawClaims(
  puzzle: Puzzle, step: PuzzleStep, stepIdx: number,
  issues: IntegrityIssue[],
) {
  if (step.street === 'preflop' || step.board.length === 0) return

  const allText = collectStepText(step)

  // Claims OESD — verify it exists
  if (CLAIMS_OESD.test(allText) && step.board.length >= 3) {
    if (!hasOesd(puzzle.heroCards, step.board)) {
      issues.push({
        puzzleId: puzzle.id, stepIdx, check: 'draw',
        severity: 'error',
        message: 'Text claims OESD, but no open-ended straight draw exists with these cards',
      })
    }
  }

  // Claims combo draw — needs flush draw + straight draw
  if (CLAIMS_COMBO.test(allText) && step.board.length >= 3) {
    const hasFd = hasFlushDraw(puzzle.heroCards, step.board)
    const hasSd = hasOesd(puzzle.heroCards, step.board)
    if (!hasFd || !hasSd) {
      issues.push({
        puzzleId: puzzle.id, stepIdx, check: 'draw',
        severity: 'warning',
        message: `Text claims combo draw but ${!hasFd ? 'no flush draw' : 'no straight draw'} found`,
      })
    }
  }

  // Flush draw claim on river
  if (step.street === 'river' && /\bflush draw\b/i.test(allText)) {
    if (!/\b(?:missed|busted|bricked)\b/i.test(allText)) {
      issues.push({
        puzzleId: puzzle.id, stepIdx, check: 'draw',
        severity: 'warning',
        message: 'Text references active flush draw on the river — no draws exist on river',
      })
    }
  }
}

// ── Action ordering: passive → aggressive ────────────────────────────────────

function validateActionOrder(
  puzzleId: string, step: PuzzleStep, stepIdx: number,
  issues: IntegrityIssue[],
) {
  if (step.options.length <= 1) return

  const scores = step.options.map(o => getAggressionScore(o.label))
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] < scores[i - 1]) {
      issues.push({
        puzzleId, stepIdx, check: 'action_ordering',
        severity: 'error',
        message: `Actions not passive→aggressive: '${step.options[i - 1].label}' before '${step.options[i].label}'`,
      })
      break
    }
  }
}

// ── Sizing order: ascending ──────────────────────────────────────────────────

function validateSizingOrder(
  puzzleId: string, step: PuzzleStep, stepIdx: number,
  issues: IntegrityIssue[],
) {
  const sized: { label: string; value: number }[] = []
  for (const opt of step.options) {
    const v = extractSizing(opt.label)
    if (v !== null) sized.push({ label: opt.label, value: v })
  }
  if (sized.length < 2) return

  for (let i = 1; i < sized.length; i++) {
    if (sized[i].value < sized[i - 1].value) {
      issues.push({
        puzzleId, stepIdx, check: 'sizing_order',
        severity: 'error',
        message: `Bet sizes not ascending: '${sized[i - 1].label}' (${sized[i - 1].value}) before '${sized[i].label}' (${sized[i].value})`,
      })
      break
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectStepText(step: PuzzleStep): string {
  const parts = [step.context, step.prompt]
  for (const opt of step.options) {
    parts.push(opt.coaching)
  }
  return parts.join(' ')
}

// ── Batch validation ─────────────────────────────────────────────────────────

export function validateAllPuzzleIntegrity(puzzles: Puzzle[]): IntegrityResult[] {
  return puzzles.map(validatePuzzleIntegrity)
}

/**
 * Sort options in-place: passive → aggressive, then by sizing ascending.
 * Returns the (mutated) options array.
 */
export function sortOptionsPassiveToAggressive(options: ActionOption[]): ActionOption[] {
  return options.sort((a, b) => {
    const scoreA = getAggressionScore(a.label)
    const scoreB = getAggressionScore(b.label)
    if (scoreA !== scoreB) return scoreA - scoreB
    // Same action type — sort by sizing ascending
    const sizeA = extractSizing(a.label) ?? 0
    const sizeB = extractSizing(b.label) ?? 0
    return sizeA - sizeB
  })
}
