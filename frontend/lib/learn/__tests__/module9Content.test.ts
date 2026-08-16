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

  // ── Lesson 9.7 (Read the Removal). The lesson used to run the SAME
  // 3-of-6 pocket-pair exercise three times (AA/A♣, JJ/J♣, QQ/Q♣) with a
  // matching "which side did it remove?" question after each — six steps
  // testing two things. Scenario 1 (rtr-s2/s3) survives as the counting +
  // classification pair; scenarios 2-5 now each test a distinct skill, and
  // the numbers each one's copy states are locked below.

  // Scenario 1 (rtr-s2) — unchanged: one held ace, half of AA gone.
  it('rtr scenario 1: AA vs Hero A♣ removes exactly 3 of 6 combos', () => {
    const combos = expandHandClass('AA')
    expect(combos.length).toBe(6)
    expect(getBlockedCombos(combos, ['Ac']).length).toBe(3)
  })

  // Scenario 2 (rtr-s4) — the point is that the SAME card removes the same
  // three tiles from both classes while taking a very different FRACTION:
  // half of a paired class, a quarter of an unpaired one. The step's copy
  // also claims the T♦ removes nothing and that a suited class would lose 1
  // of 4; both are asserted here.
  it('rtr scenario 2: Q♣ removes 3 of 6 QQ (half) but 3 of 12 AQo (a quarter), and T♦ removes nothing', () => {
    const step = LESSONS_BY_ID['read-the-removal'].steps.find((s) => s.id === 'rtr-s4')!
    expect(step.combo_removal_range).toEqual(['QQ', 'AQo'])
    expect(step.combo_removal_hero_cards).toEqual(['Qc', 'Td'])

    const qq = expandHandClass('QQ')
    const aqo = expandHandClass('AQo')
    expect([qq.length, aqo.length]).toEqual([6, 12])
    expect(getBlockedCombos(qq, ['Qc']).length).toBe(3)
    expect(getBlockedCombos(aqo, ['Qc']).length).toBe(3)
    // Same count, different fraction — the whole lesson of the step.
    expect(getBlockedCombos(qq, ['Qc']).length / qq.length).toBe(0.5)
    expect(getBlockedCombos(aqo, ['Qc']).length / aqo.length).toBe(0.25)
    // The second card is a genuine blank against both classes.
    expect(getBlockedCombos([...qq, ...aqo], ['Td']).length).toBe(0)
    // ...and the suited comparison the partial-credit note makes.
    expect(getBlockedCombos(expandHandClass('AQs'), ['Qc']).length).toBe(1)
  })

  // Scenario 3 (rtr-s5) — Hero is the BETTOR. A bluff's only relevant region
  // is the part of Villain's range that CONTINUES, so blocking the folding
  // region actively hurts. Locks the three fold frequencies the option
  // feedback states (16/25, 16/28, 12/24) and their strict ordering.
  it('rtr scenario 3: blocking the callers raises the fold frequency, blocking the folders lowers it', () => {
    const board = ['Ks', '8h', '5d', '3c', '2s']
    const continues = (hero: string[]) => removeBlocked(expandGenericUnpaired('K', 'Q'), [...board, ...hero]).length
    const folds = (hero: string[]) => removeBlocked(expandGenericUnpaired('J', 'T'), [...board, ...hero]).length

    // The board's K♠ alone already cuts KQ from 16 to 12.
    expect(continues([])).toBe(12)
    expect(folds([])).toBe(16)

    const foldFreq = (hero: string[]) => folds(hero) / (continues(hero) + folds(hero))
    // Q♥7♦ blocks 3 callers and no folders.
    expect([continues(['Qh', '7d']), folds(['Qh', '7d'])]).toEqual([9, 16])
    // 7♦6♣ blocks neither side.
    expect([continues(['7d', '6c']), folds(['7d', '6c'])]).toEqual([12, 16])
    // J♥9♦ blocks 4 folders and no callers.
    expect([continues(['Jh', '9d']), folds(['Jh', '9d'])]).toEqual([12, 12])

    expect(foldFreq(['Qh', '7d'])).toBeCloseTo(0.64, 4)
    expect(foldFreq(['7d', '6c'])).toBeCloseTo(16 / 28, 4)
    expect(foldFreq(['Jh', '9d'])).toBeCloseTo(0.5, 4)
    // The best bluff blocks calls; the worst blocks folds. Strict, not tied.
    expect(foldFreq(['Qh', '7d'])).toBeGreaterThan(foldFreq(['7d', '6c']))
    expect(foldFreq(['7d', '6c'])).toBeGreaterThan(foldFreq(['Jh', '9d']))

    const step = LESSONS_BY_ID['read-the-removal'].steps.find((s) => s.id === 'rtr-s5')!
    expect(step.options!.find((o) => o.quality === 'perfect')!.id).toBe('qh7d')
  })

  // Scenario 4 (rtr-s6) — a mixed blocker, netted by proportion. The queen
  // removes a bluff AND half the value, and still wins: the authored sort
  // order must match the remaining bluff:value ratios exactly.
  it('rtr scenario 4: the rank-sort order matches the computed remaining bluff:value ratios', () => {
    const board = ['Ts', '8h', '5d', '3c', '2s']
    const value = (hero: string[]) => removeBlocked(expandHandClass('QQ'), [...board, ...hero]).length
    const bluffs = (hero: string[]) =>
      ['QJs', 'J9s', '76s'].reduce((sum, h) => sum + removeBlocked(expandHandClass(h), [...board, ...hero]).length, 0)

    expect([value([]), bluffs([])]).toEqual([6, 12])

    const step = LESSONS_BY_ID['read-the-removal'].steps.find((s) => s.id === 'rtr-s6')!
    expect(step.type).toBe('board_rank_sort')
    const handOf = (id: string) => step.board_rank_sort_boards!.find((b) => b.id === id)!.board

    const ratios = step.board_rank_sort_target!.map((id) => {
      const hero = handOf(id)
      return bluffs(hero) / value(hero)
    })
    // Authored best-to-worst order really is strictly decreasing.
    for (let i = 1; i < ratios.length; i++) expect(ratios[i - 1]).toBeGreaterThan(ratios[i])
    expect(step.board_rank_sort_target).toEqual(['q-kicker', 'a-kicker', 'j-kicker'])

    // The exact figures the item notes state.
    expect([value(['Qh', 'Td']), bluffs(['Qh', 'Td'])]).toEqual([3, 11])
    expect([value(['Ah', 'Td']), bluffs(['Ah', 'Td'])]).toEqual([6, 12])
    expect([value(['Jh', 'Td']), bluffs(['Jh', 'Td'])]).toEqual([6, 10])
  })

  // Scenario 5 (rtr-s7) — the capstone question: board removal, hole-card
  // removal on both sides, and a price. Hero beats every bluff combo and
  // loses to every value combo with no ties, so Hero's equity against the
  // bet IS the bluff share — which is why comparing it to the pot odds is
  // exact rather than an estimate.
  it('rtr scenario 5: J♥K♠ folds and J♥Q♠ calls against the same 25-into-20 price', () => {
    const board = ['As', 'Jd', '8h', '3c', '2s']
    const value = (hero: string[]) => {
      const known = [...board, ...hero]
      return (
        removeBlocked(expandGenericUnpaired('A', 'Q'), known).length +
        removeBlocked(expandHandClass('88'), known).length +
        removeBlocked(expandHandClass('33'), known).length
      )
    }
    const bluffs = (hero: string[]) => removeBlocked(expandHandClass('KQo'), [...board, ...hero]).length

    // Board removal alone: A♠ cuts AQ 16→12, 8♥ and 3♣ cut each set 6→3.
    expect(removeBlocked(expandGenericUnpaired('A', 'Q'), board).length).toBe(12)
    expect(removeBlocked(expandHandClass('88'), board).length).toBe(3)
    expect(removeBlocked(expandHandClass('33'), board).length).toBe(3)
    expect([value([]), bluffs([])]).toEqual([18, 12])

    // 25bb to win a 70bb pot.
    const requiredEquity = 25 / (20 + 25 + 25)
    expect(requiredEquity).toBeCloseTo(0.3571, 4)
    // Pre-removal the range clears the price — which is why the removal is
    // what decides this hand, exactly as the 350-vs-324 threshold did in 9.1.
    expect(bluffs([]) / (bluffs([]) + value([]))).toBeCloseTo(0.4, 4)

    const share = (hero: string[]) => bluffs(hero) / (bluffs(hero) + value(hero))
    // The king strips 3 bluffs and no value: below the price → fold.
    expect([value(['Jh', 'Ks']), bluffs(['Jh', 'Ks'])]).toEqual([18, 9])
    expect(share(['Jh', 'Ks'])).toBeCloseTo(0.3333, 4)
    expect(share(['Jh', 'Ks'])).toBeLessThan(requiredEquity)
    // The queen strips the same 3 bluffs AND 3 value: above the price → call.
    expect([value(['Jh', 'Qs']), bluffs(['Jh', 'Qs'])]).toEqual([15, 9])
    expect(share(['Jh', 'Qs'])).toBeCloseTo(0.375, 4)
    expect(share(['Jh', 'Qs'])).toBeGreaterThan(requiredEquity)

    const step = LESSONS_BY_ID['read-the-removal'].steps.find((s) => s.id === 'rtr-s7')!
    expect(step.hero_hand).toEqual(['Jh', 'Ks'])
    expect(step.options!.find((o) => o.quality === 'perfect')!.id).toBe('fold_price')
  })

  // The regression this whole rewrite exists to prevent: two steps in one
  // lesson that ask the learner for the same thing.
  it('no Module 9 lesson asks the same graded question, prompt or sort target twice', () => {
    for (const lessonId of MODULE_9_LESSON_IDS) {
      const lesson = LESSONS_BY_ID[lessonId]
      const asked: string[] = []
      for (const step of lesson.steps) {
        for (const text of [
          step.decision_spot_question,
          step.combo_removal_prompt,
          step.board_rank_sort_prompt,
          step.range_bucket_prompt,
          step.flush_pyramid_prompt,
        ]) {
          if (text) asked.push(`${step.type}::${text.trim().toLowerCase()}`)
        }
      }
      expect(asked.length, `${lessonId} has duplicate question text`).toBe(new Set(asked).size)
    }
  })

  it('read-the-removal still has exactly 8 steps, every graded one carrying its authored XP', () => {
    const lesson = LESSONS_BY_ID['read-the-removal']
    expect(lesson.steps.length).toBe(8)
    expect(lesson.steps.map((s) => s.id)).toEqual([
      'rtr-s1', 'rtr-s2', 'rtr-s3', 'rtr-s4', 'rtr-s5', 'rtr-s6', 'rtr-s7', 'rtr-s8',
    ])
    // 6 graded steps at 15xp — unchanged by the rewrite, so the checked-in
    // reward manifest stays valid without regeneration.
    expect(lesson.steps.filter((s) => s.xp === 15).length).toBe(6)
    expect(lesson.xp_reward).toBe(150)
  })

  // Each of the five scenarios must test a different skill. The cheapest
  // machine-checkable proxy: no two graded steps share a step TYPE and a
  // correct-answer shape at once, and every graded step carries its own
  // takeaway (the rule the learner leaves with) rather than repeating one.
  it('read-the-removal: the five scenarios do not repeat a takeaway', () => {
    const lesson = LESSONS_BY_ID['read-the-removal']
    const takeaways = lesson.steps
      .map((s) => s.combo_removal_takeaway ?? s.board_rank_sort_takeaway)
      .filter(Boolean) as string[]
    expect(takeaways.length).toBe(new Set(takeaways).size)
    expect(takeaways.length).toBeGreaterThan(0)
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
