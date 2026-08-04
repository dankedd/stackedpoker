import { describe, it, expect } from 'vitest'
import { expandHandClass, expandGenericUnpaired, removeBlocked, getBlockedCombos, flushTiers } from '../combos'
import { LESSONS_BY_ID } from '../curriculum'

// Locks the exact combo-removal numbers Lesson 9.2 ("Block the Value", which
// merges the former "Block the Value" + "Leave the Bluffs Alive") states in
// its copy — board Ah 9d 4c 2s 7h, Hero holding Ac (+ Td or 7c). If curriculum
// content ever edits these cards without updating this test, the mismatch is
// the signal something drifted.
describe('Module 9 content — combo math the lessons state must stay true', () => {
  const board = ['Ah']

  it('AA: board Ah + hero Ac leaves exactly 1 of 6 combos (5 removed)', () => {
    const aa = expandHandClass('AA')
    const remaining = removeBlocked(aa, [...board, 'Ac'])
    expect(aa.length).toBe(6)
    expect(remaining.length).toBe(1)
  })

  it('94s: unaffected by Ah/Ac — all 4 combos remain', () => {
    const hand = expandHandClass('94s')
    expect(removeBlocked(hand, [...board, 'Ac']).length).toBe(4)
  })

  it('Hand A (Ac, Td): removes only the AA combos — 76s and 65s stay full', () => {
    const known = [...board, 'Ac', 'Td']
    expect(getBlockedCombos(expandHandClass('AA'), known).length).toBe(5)
    expect(getBlockedCombos(expandHandClass('76s'), known).length).toBe(0)
    expect(getBlockedCombos(expandHandClass('65s'), known).length).toBe(0)
    expect(removeBlocked(expandHandClass('76s'), known).length).toBe(4)
  })

  it("Hand A′ (Ac, 7c): removes the same 5 AA combos PLUS exactly 1 of 4 76s combos (7c6c)", () => {
    const known = [...board, 'Ac', '7c']
    expect(getBlockedCombos(expandHandClass('AA'), known).length).toBe(5)
    expect(getBlockedCombos(expandHandClass('76s'), known).length).toBe(1)
    expect(getBlockedCombos(expandHandClass('65s'), known).length).toBe(0)
    expect(removeBlocked(expandHandClass('76s'), known).length).toBe(3)
  })

  it('Hand A removes 5 total combos across the value+bluff pool; Hand A′ removes 6 — matches ltba-s4\'s narrative', () => {
    const pool = ['AA', '76s', '65s']
    const totalFor = (known: string[]) =>
      pool.reduce((sum, h) => sum + getBlockedCombos(expandHandClass(h), known).length, 0)
    expect(totalFor([...board, 'Ac', 'Td'])).toBe(5)
    expect(totalFor([...board, 'Ac', '7c'])).toBe(6)
  })

  it('generic AK invariants still hold at the range level used by Lesson 9.1/9.2', () => {
    expect(expandGenericUnpaired('A', 'K').length).toBe(16)
  })

  // ── Lesson 9.3 (Same Strength, Different Cards): AA/76s/65s removal for
  // the three ranked candidates — locks board_rank_sort_target's ordering.
  it('ssdc candidates: identical value removal (5 AA), strictly increasing bluff removal (0, 1, 2)', () => {
    const board = ['Ah']
    const value = (known: string[]) => getBlockedCombos(expandHandClass('AA'), known).length
    const bluffs = (known: string[]) =>
      getBlockedCombos(expandHandClass('76s'), known).length + getBlockedCombos(expandHandClass('65s'), known).length

    const actTd = [...board, 'Ac', 'Td']
    const ac7c = [...board, 'Ac', '7c']
    const ac6c = [...board, 'Ac', '6c']

    expect(value(actTd)).toBe(5)
    expect(value(ac7c)).toBe(5)
    expect(value(ac6c)).toBe(5)
    expect(bluffs(actTd)).toBe(0)
    expect(bluffs(ac7c)).toBe(1)
    expect(bluffs(ac6c)).toBe(2)
  })

  // ── Lesson 9.4/9.5 (Nut Blocker / Not Always Good). The ace is the top
  // rank, so it ONLY ever appears in its own (nut) tier — holding it empties
  // that tier completely (9/9). Every other rank also appears as the "low"
  // partner in every tier ABOVE it (tiers are defined by high card), so Kh
  // additionally touches 1 of the nut tier's 9 combos (the specific AhKh) on
  // top of fully emptying its own K-tier (8/8) — these are NOT disjoint, and
  // Lesson 9.7's copy was corrected to state this precisely rather than
  // claim the nut tier is "completely untouched."
  it('nut blocker (Ah) empties only its own tier; lower blocker (Kh) empties its own tier AND touches 1 nut-tier combo', () => {
    const tiers = flushTiers('h', ['8', '3', '2'])
    const blockedCountByTier = (known: string[]) =>
      new Map(tiers.map((t) => [t.tierLabel, getBlockedCombos(t.combos, known).length]))

    const ahBlocked = blockedCountByTier(['Ah'])
    expect(ahBlocked.get('nut')).toBe(9)
    for (const t of tiers) if (t.tierLabel !== 'nut') expect(ahBlocked.get(t.tierLabel)).toBe(0)

    const khBlocked = blockedCountByTier(['Kh'])
    expect(khBlocked.get('K')).toBe(8) // entire K-tier
    expect(khBlocked.get('nut')).toBe(1) // just A-K
    for (const t of tiers) if (t.tierLabel !== 'K' && t.tierLabel !== 'nut') expect(khBlocked.get(t.tierLabel)).toBe(0)
  })

  // ── Lesson 9.7 (Read the Removal): each scenario gives Hero exactly ONE
  // card of the value pair's rank (no board overlap) — removes 3 of 6 combos,
  // leaving 3, same mechanic as Lesson 9.1's original AA/A♠ exercise.
  it('rtr scenarios (AA/Ac, JJ/Jc, QQ/Qc) each remove exactly 3 of 6 combos with no board interference', () => {
    for (const [hand, card] of [['AA', 'Ac'], ['JJ', 'Jc'], ['QQ', 'Qc']] as const) {
      const combos = expandHandClass(hand)
      expect(combos.length).toBe(6)
      expect(getBlockedCombos(combos, [card]).length).toBe(3)
    }
  })

  // ── Lesson 9.8 (Blocker Lab) reuses bl-s2 (KK/Kd) and bl-s5 (flush pyramid,
  // Ah) — both already covered above by the K-blocked-classes and nut-blocker
  // checks; this just confirms the capstone's own step data matches.
  it("blocker-lab's steps carry the exact same known cards as the lessons they recap", () => {
    const lab = LESSONS_BY_ID['blocker-lab']
    const s2 = lab.steps.find((s) => s.id === 'bl-s2')!
    const s5 = lab.steps.find((s) => s.id === 'bl-s5')!
    expect(s2.combo_removal_subject).toBe('KK')
    expect(s2.combo_removal_hero_cards).toEqual(['Kd'])
    expect(s5.flush_pyramid_known_cards).toEqual(['Ah'])
    expect(s5.flush_pyramid_dead_ranks).toEqual(['8', '3', '2'])
  })

  it('tendency_summary in blocker-lab only references step ids that actually exist in the same lesson', () => {
    const lab = LESSONS_BY_ID['blocker-lab']
    const report = lab.steps.find((s) => s.type === 'tendency_summary')!
    const ids = new Set(lab.steps.map((s) => s.id))
    for (const ref of report.summary_source_step_ids ?? []) {
      expect(ids.has(ref), `bl-report references missing step id ${ref}`).toBe(true)
    }
  })

  const MODULE_9_LESSON_IDS = [
    'from-hands-to-combos', 'block-the-value',
    'same-strength-different-cards', 'the-nut-blocker', 'a-blocker-is-not-always-good',
    'blockers-when-calling', 'read-the-removal', 'blocker-lab',
  ]

  // ── Lesson 9.1 (From Hands to Combos, merged): the book's real HJ-open/BB-call
  // hand on flop Ac Jh 9h — Hero holds Ad 3d. AA is blocked from BOTH sides
  // (board's Ac AND Hero's Ad); JJ/99 only from the board; 33 only from Hero.
  it('real-hand flop (Ac Jh 9h, Hero Ad3d): AA->1, JJ->3 (board only), 33->3 (hero only)', () => {
    const known = { aa: ['Ac', 'Ad'], jj: ['Jh'], nine: ['9h'], three: ['3d'] }
    expect(removeBlocked(expandHandClass('AA'), known.aa).length).toBe(1)
    expect(removeBlocked(expandHandClass('JJ'), known.jj).length).toBe(3)
    expect(removeBlocked(expandHandClass('99'), known.nine).length).toBe(3)
    expect(removeBlocked(expandHandClass('33'), known.three).length).toBe(3)
  })

  // ── Lesson 9.1 (From Hands to Combos, merged): the K♦2♠ 3-bet-bluff
  // profitability threshold is a number the book states directly (page 213),
  // not something this codebase derives — the formula behind it isn't
  // reproduced here to avoid asserting an unverified re-derivation. This only
  // locks the comparison the lesson's copy relies on: 350 (pre-blocker) sits
  // above the book's stated threshold, 324 (post-blocker) sits below it.
  it('K♦2♠ 3-bet bluff: 350 combos is above the book-stated 334.62 threshold, 324 is below it', () => {
    const bookStatedThreshold = 334.62
    expect(350).toBeGreaterThan(bookStatedThreshold)
    expect(324).toBeLessThan(bookStatedThreshold)
  })

  it('every Module 9 lesson currently registered has unique, non-empty step ids', () => {
    const moduleLessons = MODULE_9_LESSON_IDS
    for (const lessonId of moduleLessons) {
      const lesson = LESSONS_BY_ID[lessonId]
      expect(lesson, `lesson ${lessonId} should be registered`).toBeTruthy()
      const ids = lesson.steps.map((s) => s.id)
      expect(ids.length).toBe(new Set(ids).size)
      expect(ids.every((id) => !!id)).toBe(true)
    }
  })

  it('combo_removal steps never declare a subject/range that fails to expand', () => {
    const moduleLessons = MODULE_9_LESSON_IDS
    for (const lessonId of moduleLessons) {
      const lesson = LESSONS_BY_ID[lessonId]
      for (const step of lesson.steps) {
        if (step.type !== 'combo_removal') continue
        if (step.combo_removal_range) {
          for (const hand of step.combo_removal_range) {
            expect(expandHandClass(hand).length, `${lessonId}/${step.id}: ${hand}`).toBeGreaterThan(0)
          }
        } else if (step.combo_removal_subject) {
          const s = step.combo_removal_subject
          const isPair = s.length === 2 && s[0] === s[1]
          const isClassed = s.length === 3 && (s[2] === 's' || s[2] === 'o')
          const combos = isPair || isClassed ? expandHandClass(s) : expandGenericUnpaired(s[0], s[1])
          expect(combos.length, `${lessonId}/${step.id}: ${s}`).toBeGreaterThan(0)
        } else {
          throw new Error(`${lessonId}/${step.id}: combo_removal step has neither subject nor range`)
        }
      }
    }
  })
})
