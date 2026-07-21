/**
 * puzzleIntegrity.test.ts
 *
 * Tests for puzzle integrity validation: hand strength, draws,
 * action ordering, sizing order, and coaching coherence.
 */

import { describe, it, expect } from 'vitest'
import {
  validatePuzzleIntegrity,
  validateAllPuzzleIntegrity,
  sortOptionsPassiveToAggressive,
} from '../puzzleIntegrity'
import type { Puzzle, PuzzleStep, ActionOption } from '../../puzzle-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePuzzle(overrides: Partial<Puzzle> & { steps: PuzzleStep[] }): Puzzle {
  return {
    id: 'test-puzzle',
    title: 'Test',
    description: '',
    difficulty: 'intermediate',
    category: 'test',
    gameType: 'cash',
    format: '6-max',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroCards: ['Ah', 'Kd'],
    effectiveStack: 100,
    stakes: '$1/$2',
    summary: '',
    tags: [],
    ...overrides,
  }
}

function makeStep(overrides: Partial<PuzzleStep>): PuzzleStep {
  return {
    street: 'flop',
    board: ['Qc', 'Js', '2h'],
    context: '',
    prompt: '',
    options: [],
    ...overrides,
  }
}

function makeOption(overrides: Partial<ActionOption>): ActionOption {
  return {
    id: 'opt',
    label: 'Check',
    quality: 'good',
    evLoss: 0,
    coaching: '',
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Board validation', () => {
  it('passes with correct flop card count', () => {
    const p = makePuzzle({
      steps: [makeStep({ board: ['Qc', 'Js', '2h'] })],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.issues.filter(i => i.check === 'board' && i.severity === 'error')).toHaveLength(0)
  })

  it('fails with wrong flop card count', () => {
    const p = makePuzzle({
      steps: [makeStep({ board: ['Qc', 'Js'] })],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.check === 'board' && /expects 3/.test(i.message))).toBe(true)
  })

  it('fails with duplicate cards (hero + board)', () => {
    const p = makePuzzle({
      heroCards: ['Ah', 'Kd'],
      steps: [makeStep({ board: ['Ah', 'Js', '2h'] })],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => /Duplicate/i.test(i.message))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HAND STRENGTH COHERENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hand strength coherence', () => {
  it('fails when coaching claims flush but hero has only 4 suited', () => {
    const p = makePuzzle({
      heroCards: ['Ah', 'Kh'],
      steps: [
        makeStep({
          board: ['Qh', 'Jh', '2c'],
          options: [
            makeOption({ coaching: 'You have the flush, bet for value' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.valid).toBe(false)
    expect(r.issues.some(i => i.check === 'hand_strength' && /flush/i.test(i.message))).toBe(true)
  })

  it('passes when coaching claims flush and hero has 5 suited', () => {
    const p = makePuzzle({
      heroCards: ['Ah', 'Kh'],
      steps: [
        makeStep({
          board: ['Qh', 'Jh', '2h'],
          options: [
            makeOption({ coaching: 'You have the flush' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const flushErrors = r.issues.filter(
      i => i.check === 'hand_strength' && /flush/i.test(i.message) && i.severity === 'error'
    )
    expect(flushErrors).toHaveLength(0)
  })

  it('fails when coaching claims straight but none exists', () => {
    const p = makePuzzle({
      heroCards: ['Ah', 'Kd'],
      steps: [
        makeStep({
          board: ['Qc', '7s', '2h'],
          options: [
            makeOption({ coaching: 'You have the straight' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.issues.some(i => i.check === 'hand_strength' && /straight/i.test(i.message))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DRAW CLAIMS COHERENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Draw claims coherence', () => {
  it('fails when coaching claims OESD but none exists', () => {
    // 9h8h on Ah7d2s: only 7-8-9 = 3 consecutive, NOT OESD
    const p = makePuzzle({
      heroCards: ['9h', '8h'],
      steps: [
        makeStep({
          board: ['Ah', '7d', '2s'],
          options: [
            makeOption({ coaching: 'With your OESD, semi-bluff here' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    expect(r.issues.some(i => i.check === 'draw' && /OESD/i.test(i.message))).toBe(true)
  })

  it('passes when OESD actually exists', () => {
    // 8h9d on 6c7s2h: 6-7-8-9 = OESD
    const p = makePuzzle({
      heroCards: ['8h', '9d'],
      steps: [
        makeStep({
          board: ['6c', '7s', '2h'],
          prompt: 'You have an OESD',
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const oesdErrors = r.issues.filter(i => i.check === 'draw' && /OESD/i.test(i.message))
    expect(oesdErrors).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION ORDERING: passive → aggressive
// ═══════════════════════════════════════════════════════════════════════════════

describe('Action ordering', () => {
  it('passes: Fold | Call | Raise', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 'fold', label: 'Fold' }),
            makeOption({ id: 'call', label: 'Call' }),
            makeOption({ id: 'raise', label: 'Raise' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const orderErrors = r.issues.filter(i => i.check === 'action_ordering')
    expect(orderErrors).toHaveLength(0)
  })

  it('passes: Check | Bet 4bb | Bet 12bb', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 'check', label: 'Check' }),
            makeOption({ id: 'small', label: 'Bet 4bb' }),
            makeOption({ id: 'big', label: 'Bet 12bb' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const orderErrors = r.issues.filter(i => i.check === 'action_ordering')
    expect(orderErrors).toHaveLength(0)
  })

  it('fails: Raise before Fold', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 'raise', label: 'Raise' }),
            makeOption({ id: 'fold', label: 'Fold' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const orderErrors = r.issues.filter(i => i.check === 'action_ordering')
    expect(orderErrors.length).toBeGreaterThan(0)
  })

  it('fails: Jam before Check', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 'jam', label: 'Jam all-in' }),
            makeOption({ id: 'check', label: 'Check' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const orderErrors = r.issues.filter(i => i.check === 'action_ordering')
    expect(orderErrors.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SIZING ORDER: ascending
// ═══════════════════════════════════════════════════════════════════════════════

describe('Sizing order', () => {
  it('passes: Bet 4bb | Bet 8bb | Bet 20bb', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 's', label: 'Bet 4bb' }),
            makeOption({ id: 'm', label: 'Bet 8bb' }),
            makeOption({ id: 'l', label: 'Bet 20bb' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const sizeErrors = r.issues.filter(i => i.check === 'sizing_order')
    expect(sizeErrors).toHaveLength(0)
  })

  it('fails: Bet 20bb before Bet 8bb', () => {
    const p = makePuzzle({
      steps: [
        makeStep({
          options: [
            makeOption({ id: 'l', label: 'Bet 20bb' }),
            makeOption({ id: 's', label: 'Bet 8bb' }),
          ],
        }),
      ],
    })
    const r = validatePuzzleIntegrity(p)
    const sizeErrors = r.issues.filter(i => i.check === 'sizing_order')
    expect(sizeErrors.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// sortOptionsPassiveToAggressive
// ═══════════════════════════════════════════════════════════════════════════════

describe('sortOptionsPassiveToAggressive', () => {
  it('sorts Fold < Call < Raise', () => {
    const opts = [
      makeOption({ id: 'raise', label: 'Raise' }),
      makeOption({ id: 'fold', label: 'Fold' }),
      makeOption({ id: 'call', label: 'Call' }),
    ]
    const sorted = sortOptionsPassiveToAggressive(opts)
    expect(sorted.map(o => o.id)).toEqual(['fold', 'call', 'raise'])
  })

  it('sorts Check < Bet 4bb < Bet 12bb', () => {
    const opts = [
      makeOption({ id: 'big', label: 'Bet 12bb' }),
      makeOption({ id: 'check', label: 'Check' }),
      makeOption({ id: 'small', label: 'Bet 4bb' }),
    ]
    const sorted = sortOptionsPassiveToAggressive(opts)
    expect(sorted.map(o => o.id)).toEqual(['check', 'small', 'big'])
  })

  it('sorts Fold < Jam', () => {
    const opts = [
      makeOption({ id: 'jam', label: 'Jam all-in' }),
      makeOption({ id: 'fold', label: 'Fold' }),
    ]
    const sorted = sortOptionsPassiveToAggressive(opts)
    expect(sorted.map(o => o.id)).toEqual(['fold', 'jam'])
  })

  it('does not reorder already-correct options', () => {
    const opts = [
      makeOption({ id: 'check', label: 'Check' }),
      makeOption({ id: 'bet', label: 'Bet 5bb' }),
      makeOption({ id: 'raise', label: 'Raise to 15bb' }),
    ]
    const sorted = sortOptionsPassiveToAggressive(opts)
    expect(sorted.map(o => o.id)).toEqual(['check', 'bet', 'raise'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH VALIDATION (smoke test all real puzzles)
// ═══════════════════════════════════════════════════════════════════════════════

describe('All puzzle integrity (smoke test)', () => {
  it('validates all real puzzles without crashing', async () => {
    const { PUZZLES } = await import('../../puzzle-data/index')
    const results = validateAllPuzzleIntegrity(PUZZLES)
    // Should not throw and should have results for all puzzles
    expect(results.length).toBe(PUZZLES.length)
    // Log any failures for debugging
    const failed = results.filter(r => !r.valid)
    if (failed.length > 0) {
      for (const r of failed) {
        for (const issue of r.issues.filter(i => i.severity === 'error')) {
          console.warn(`[${r.puzzleId}] step ${issue.stepIdx}: ${issue.message}`)
        }
      }
    }
  })
})
