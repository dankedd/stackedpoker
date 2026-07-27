import { describe, it, expect } from 'vitest'
import { classifyHandVsBoard, classifyRangeVsBoard, STRONG_MADE_CATEGORIES } from '../handBoardInteraction'

// Module 8's central book scenario board: 8h 7s 5s (two-tone, unpaired, rank-only logic
// ignores suit — see file header). Straight windows: 9-8-7-6-5 (needs 96) and
// 8-7-6-5-4 (needs 64), matching Modern Poker Theory's own description of this texture.
const BOARD_875 = ['8h', '7s', '5s']

describe('classifyHandVsBoard — 875ss (book scenario board)', () => {
  it('pocket pairs matching a board rank are sets', () => {
    expect(classifyHandVsBoard('88', BOARD_875)).toBe('set')
    expect(classifyHandVsBoard('77', BOARD_875)).toBe('set')
    expect(classifyHandVsBoard('55', BOARD_875)).toBe('set')
  })

  it('pocket pairs above/below every board rank are overpair/underpair', () => {
    expect(classifyHandVsBoard('AA', BOARD_875)).toBe('overpair')
    expect(classifyHandVsBoard('22', BOARD_875)).toBe('underpair')
  })

  it('two board-rank matches make two pair', () => {
    expect(classifyHandVsBoard('87', BOARD_875)).toBe('two_pair')
    expect(classifyHandVsBoard('85', BOARD_875)).toBe('two_pair')
    expect(classifyHandVsBoard('75', BOARD_875)).toBe('two_pair')
  })

  it('a single match on the top board rank is top pair; a single match elsewhere is weak pair', () => {
    expect(classifyHandVsBoard('A8', BOARD_875)).toBe('top_pair')
    expect(classifyHandVsBoard('K8', BOARD_875)).toBe('top_pair')
    expect(classifyHandVsBoard('K7', BOARD_875)).toBe('weak_pair')
  })

  it('96 and 64 complete the board\'s two possible straights', () => {
    expect(classifyHandVsBoard('96', BOARD_875)).toBe('straight')
    expect(classifyHandVsBoard('64', BOARD_875)).toBe('straight')
  })

  it('T9 has a genuine straight draw (needs a 6)', () => {
    expect(classifyHandVsBoard('T9', BOARD_875)).toBe('straight_draw')
  })

  it('AK has no pair/draw relevance and both cards beat the board — overcards', () => {
    expect(classifyHandVsBoard('AK', BOARD_875)).toBe('overcards')
  })

  it('a fully disconnected low hand is "none", not overcards', () => {
    expect(classifyHandVsBoard('32', BOARD_875)).toBe('none')
  })
})

describe('classifyHandVsBoard — A76r (book comparison board)', () => {
  const BOARD_A76 = ['Ad', '7h', '6c']

  it('pairs matching a board rank are sets', () => {
    expect(classifyHandVsBoard('AA', BOARD_A76)).toBe('set')
    expect(classifyHandVsBoard('77', BOARD_A76)).toBe('set')
    expect(classifyHandVsBoard('66', BOARD_A76)).toBe('set')
  })

  it('A7/A6/76 all make two pair', () => {
    expect(classifyHandVsBoard('A7', BOARD_A76)).toBe('two_pair')
    expect(classifyHandVsBoard('A6', BOARD_A76)).toBe('two_pair')
    expect(classifyHandVsBoard('76', BOARD_A76)).toBe('two_pair')
  })

  it('AK pairs the top (ace) rank — top pair', () => {
    expect(classifyHandVsBoard('AK', BOARD_A76)).toBe('top_pair')
  })

  it('an ace-high board makes true "overcards" impossible for a non-ace hand', () => {
    expect(classifyHandVsBoard('KQ', BOARD_A76)).toBe('none')
  })

  it('the ace isolates the board from any straight — no straight or draw exists here', () => {
    expect(classifyHandVsBoard('98', BOARD_A76)).toBe('none')
  })
})

describe('classifyHandVsBoard — 654r (book comparison board)', () => {
  const BOARD_654 = ['6h', '5d', '4c']

  it('pairs matching a board rank are sets', () => {
    expect(classifyHandVsBoard('66', BOARD_654)).toBe('set')
    expect(classifyHandVsBoard('55', BOARD_654)).toBe('set')
    expect(classifyHandVsBoard('44', BOARD_654)).toBe('set')
  })

  it('65/54/64 all make two pair', () => {
    expect(classifyHandVsBoard('65', BOARD_654)).toBe('two_pair')
    expect(classifyHandVsBoard('54', BOARD_654)).toBe('two_pair')
    expect(classifyHandVsBoard('64', BOARD_654)).toBe('two_pair')
  })

  it('73 completes the board\'s straight (7-6-5-4-3)', () => {
    expect(classifyHandVsBoard('73', BOARD_654)).toBe('straight')
  })

  it('97 has a genuine straight draw', () => {
    expect(classifyHandVsBoard('97', BOARD_654)).toBe('straight_draw')
  })

  it('this low, connected board has NO overpair-eligible high cards labeled overcards without a real gap', () => {
    // AK on 654r: both cards rank above the board, no pair/draw relevance.
    expect(classifyHandVsBoard('AK', BOARD_654)).toBe('overcards')
  })
})

describe('classifyRangeVsBoard', () => {
  it('classifies every hand in a small range, keyed by notation', () => {
    const result = classifyRangeVsBoard(['88', '96', 'AK', '32'], BOARD_875_LOCAL())
    expect(result).toEqual({ '88': 'set', '96': 'straight', AK: 'overcards', '32': 'none' })
  })
})

function BOARD_875_LOCAL(): string[] {
  return ['8h', '7s', '5s']
}

describe('STRONG_MADE_CATEGORIES', () => {
  it('is a fixed, non-empty illustrative set covering the book\'s named strong-hand types', () => {
    expect(STRONG_MADE_CATEGORIES).toEqual(expect.arrayContaining(['set', 'straight', 'two_pair', 'overpair']))
    expect(STRONG_MADE_CATEGORIES.length).toBeGreaterThan(0)
  })
})
