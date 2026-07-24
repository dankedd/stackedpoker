/**
 * Regression + audit tests for the "Count Your Ways to Win" (Module 2) clean
 * vs. dirty outs exercises.
 *
 * Bug this locks in: cyw-f1 originally used Hero 9d8d on board Td7d2d with
 * 6d/Jd marked "dirty" because they put a 4th diamond on the board. But Hero
 * himself holds diamonds — 6d and Jd complete a STRAIGHT FLUSH for Hero, not
 * merely a flush for Villain, so they can never be "dirty" under the
 * "board pairs to a 4-flush" reasoning. A dirty out only exists when the
 * board reaches a 4-flush WITHOUT Hero contributing to that suit himself.
 */
import { describe, it, expect } from 'vitest'
import { LESSONS_BY_MODULE } from '../curriculum'
import type { LessonStep } from '../types'

const MODULE_ID = 'math-foundations-module'
const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
const allSteps: LessonStep[] = lessons.flatMap((l) => l.steps)
const cleanDirtySteps = allSteps.filter((s) => s.outs_deck_mode === 'clean_dirty')

// ── Minimal 5/6/7-card hand evaluator — only what's needed to tell whether a
// candidate out card completes a flush (and therefore, since only 3-4 of a
// suit can come from hero+board pre-turn, whether HERO himself holds that suit). ──

const RANK_ORDER = '23456789TJQKA'
const rankVal = (card: string) => RANK_ORDER.indexOf(card[0].toUpperCase()) + 2
const suitOf = (card: string) => card[1].toLowerCase()

function hasFlush(cards: string[]): boolean {
  const counts: Record<string, number> = {}
  for (const c of cards) counts[suitOf(c)] = (counts[suitOf(c)] ?? 0) + 1
  return Object.values(counts).some((n) => n >= 5)
}

function hasStraightAmongRanks(ranks: number[]): boolean {
  const set = new Set(ranks)
  if (set.has(14)) set.add(1) // wheel (A-2-3-4-5)
  const sorted = [...set].sort((a, b) => a - b)
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++
      if (run >= 5) return true
    } else if (sorted[i] !== sorted[i - 1]) {
      run = 1
    }
  }
  return false
}

function hasStraightFlush(cards: string[]): boolean {
  const bySuit: Record<string, number[]> = {}
  for (const c of cards) (bySuit[suitOf(c)] ??= []).push(rankVal(c))
  return Object.values(bySuit).some((ranks) => ranks.length >= 5 && hasStraightAmongRanks(ranks))
}

function suitCount(cards: string[], suit: string): number {
  return cards.filter((c) => suitOf(c) === suit).length
}

describe('Module 2 "Count Your Ways to Win" — clean/dirty outs sanity', () => {
  it('has the two clean_dirty exercises this audit expects (sanity check)', () => {
    expect(cleanDirtySteps.length).toBe(2)
  })

  for (const step of cleanDirtySteps) {
    const heroHand = step.hero_hand ?? []
    const board = step.board ?? []
    const known = [...heroHand, ...board]
    const nominal = step.outs_deck_out_cards ?? []
    const dead = new Set(step.outs_deck_dead_out_cards ?? [])
    const clean = nominal.filter((c) => !dead.has(c))

    describe(`${step.id}: ${heroHand.join('')} on ${board.join(' ')}`, () => {
      it('declared correct count equals nominal minus dead', () => {
        expect(step.outs_deck_correct).toBe(clean.length)
      })

      it('every card marked "dirty" gives Hero a hand that is NOT his own flush/straight-flush', () => {
        // The whole point of a dirty out is: Hero completes his hand, but the
        // resulting board texture also lets VILLAIN make a bigger hand (a
        // flush). If Hero's own hole cards share that suit, the out instead
        // completes a flush/straight-flush FOR HERO — it can never be dirty.
        for (const card of dead) {
          const madeFlush = hasFlush([...known, card])
          expect(
            madeFlush,
            `${step.id}: ${card} is marked dirty, but Hero+board+${card} already forms a flush — ` +
              `Hero must hold a card of that suit himself, which means this out can't be "dirty".`,
          ).toBe(false)
          expect(
            hasStraightFlush([...known, card]),
            `${step.id}: ${card} is marked dirty but completes a straight flush for Hero.`,
          ).toBe(false)
        }
      })

      it('every dirty out actually pairs the board to a 4-flush (the real reason it\'s dirty)', () => {
        for (const card of dead) {
          const boardSuit = suitOf(card)
          expect(
            suitCount([...board, card], boardSuit),
            `${step.id}: ${card} was marked dirty but doesn't even make a 4-flush on the board.`,
          ).toBeGreaterThanOrEqual(4)
        }
      })

      it('no card marked "clean" secretly pairs the board to a 4-flush', () => {
        for (const card of clean) {
          const s = suitOf(card)
          expect(
            suitCount([...board, card], s),
            `${step.id}: ${card} is marked clean but puts a 4th ${s} on the board — should be dirty.`,
          ).toBeLessThan(4)
        }
      })

      it('Hero does not hold a hole card in the board\'s 3-flush suit (the root cause of the original bug)', () => {
        const boardSuitCounts: Record<string, number> = {}
        for (const c of board) boardSuitCounts[suitOf(c)] = (boardSuitCounts[suitOf(c)] ?? 0) + 1
        const boardFlushSuits = Object.entries(boardSuitCounts)
          .filter(([, n]) => n >= 3)
          .map(([s]) => s)
        for (const suit of boardFlushSuits) {
          expect(
            heroHand.some((c) => suitOf(c) === suit),
            `${step.id}: Hero holds a ${suit} while the board already shows 3 ${suit}s — any completing ` +
              `out of that suit would give HERO a straight flush, not just a flush for Villain.`,
          ).toBe(false)
        }
      })
    })
  }
})

describe('Regression: original reported bug (Hero 9d8d on Td7d2d)', () => {
  // This exact combination shipped in cyw-f1 before the fix, with 6d/Jd
  // marked "dirty" for putting a 4th diamond on the board. Both cards
  // actually complete a straight flush FOR HERO, so that reasoning was wrong.
  // This test is intentionally independent of current curriculum content —
  // it proves the underlying card math, not just today's data.
  const hero = ['9d', '8d']
  const board = ['Td', '7d', '2d']

  it('Jd completes a straight flush for Hero (7d 8d 9d Td Jd)', () => {
    expect(hasStraightFlush([...hero, ...board, 'Jd'])).toBe(true)
  })

  it('6d completes a straight flush for Hero (6d 7d 8d 9d Td)', () => {
    expect(hasStraightFlush([...hero, ...board, '6d'])).toBe(true)
  })

  it('neither Jd nor 6d can be classified as a dirty out under "adds a 4th board flush suit card"', () => {
    for (const card of ['Jd', '6d']) {
      // The would-be justification for calling this dirty is that Hero+board+card
      // forms a flush at all — but that flush is Hero's OWN hand, not a bare
      // board texture Villain alone benefits from.
      const heroMakesTheFlushHimself = hasFlush([...hero, ...board, card])
      expect(heroMakesTheFlushHimself).toBe(true) // it's a flush — but it's Hero's
      expect(hasStraightFlush([...hero, ...board, card])).toBe(true) // specifically Hero's straight flush
    }
  })

  it('the corrected curriculum no longer uses a hero hand suited with the board', () => {
    const lessons = LESSONS_BY_MODULE[MODULE_ID] ?? []
    const f1 = lessons.flatMap((l) => l.steps).find((s) => s.id === 'cyw-f1')!
    const heroSuits = new Set((f1.hero_hand ?? []).map(suitOf))
    const boardSuits = (f1.board ?? []).map(suitOf)
    const boardFlushSuit = boardSuits.find((s) => boardSuits.filter((x) => x === s).length >= 3)
    expect(boardFlushSuit).toBeDefined()
    expect(heroSuits.has(boardFlushSuit as string)).toBe(false)
  })
})
