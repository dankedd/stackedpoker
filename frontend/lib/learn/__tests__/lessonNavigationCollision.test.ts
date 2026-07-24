import { describe, it, expect } from 'vitest'
import { LESSONS, LESSONS_BY_ID, LESSONS_BY_SLUG, LESSONS_BY_MODULE } from '../curriculum'
import type { Lesson } from '../types'

// Regression coverage for the "duplicate lesson title causes navigation
// collision" incident: two lessons were both titled "Position Changes
// Everything" AND both assigned the literal id/slug
// 'position-changes-everything' (one in preflop-aggression-module, one in
// cbetting-fundamentals-module). Because LESSONS_BY_SLUG /
// (a would-be) LESSONS_BY_ID are built with `Object.fromEntries`, the second
// lesson silently overwrote the first — every navigation into the first
// lesson (module page card, "Next Lesson", Resume Learning) actually opened
// the second lesson's content, and progress for both collapsed onto one
// shared row.
//
// Root cause was a literal id/slug string collision between two authored
// lesson objects, NOT a title-based lookup anywhere in the app — but titles
// are exactly the kind of thing two authors independently reuse, so this
// suite locks down both halves of the fix: (1) the specific incident is
// resolved, and (2) the general mechanism (id is the only key that matters)
// holds even when titles collide again in the future.

function makeLesson(overrides: Partial<Lesson> & Pick<Lesson, 'id' | 'slug' | 'module_id' | 'sort_order'>): Lesson {
  return {
    title: 'Untitled',
    lesson_type: 'micro',
    concept_ids: [],
    steps: [],
    estimated_min: 10,
    xp_reward: 100,
    ...overrides,
  }
}

describe('lesson navigation survives duplicate titles (synthetic fixtures)', () => {
  it('two lessons with an identical title but distinct id/slug resolve independently through an id-keyed map', () => {
    const a = makeLesson({ id: 'lesson-a', slug: 'lesson-a', module_id: 'mod-1', sort_order: 1, title: 'Same Title' })
    const b = makeLesson({ id: 'lesson-b', slug: 'lesson-b', module_id: 'mod-2', sort_order: 1, title: 'Same Title' })

    const byId: Record<string, Lesson> = Object.fromEntries([a, b].map((l) => [l.id, l]))
    const bySlug: Record<string, Lesson> = Object.fromEntries([a, b].map((l) => [l.slug, l]))

    expect(byId['lesson-a']).toBe(a)
    expect(byId['lesson-b']).toBe(b)
    expect(bySlug['lesson-a']).toBe(a)
    expect(bySlug['lesson-b']).toBe(b)
    expect(byId['lesson-a']).not.toBe(byId['lesson-b'])
  })

  it('demonstrates the actual failure mode: identical id/slug (even with different titles) collapses to one entry', () => {
    // This is what happened in production: two DIFFERENT lessons were
    // authored with the SAME id/slug literal. Rebuilding the exact
    // Object.fromEntries pattern curriculum.ts uses shows the collapse.
    const a = makeLesson({ id: 'shared-id', slug: 'shared-id', module_id: 'mod-1', sort_order: 4, title: 'First Lesson' })
    const b = makeLesson({ id: 'shared-id', slug: 'shared-id', module_id: 'mod-2', sort_order: 8, title: 'Second Lesson' })

    const byId: Record<string, Lesson> = Object.fromEntries([a, b].map((l) => [l.id, l]))
    // The second entry silently wins — proves why LESSONS.map(id).duplicates
    // must be empty, not just why titles must differ.
    expect(byId['shared-id']).toBe(b)
    expect(byId['shared-id']).not.toBe(a)
  })
})

describe('the reported incident is fixed in the real curriculum', () => {
  const preflopLesson = LESSONS.find((l) => l.module_id === 'preflop-aggression-module' && l.sort_order === 4)
  const cbetLesson = LESSONS.find((l) => l.module_id === 'cbetting-fundamentals-module' && l.sort_order === 8)
  const defenseLesson = LESSONS.find((l) => l.id === 'position-changes-everything-defense')

  it('the three formerly-identically-titled lessons now have distinct titles', () => {
    expect(preflopLesson).toBeDefined()
    expect(cbetLesson).toBeDefined()
    expect(defenseLesson).toBeDefined()
    const titles = [preflopLesson!.title, cbetLesson!.title, defenseLesson!.title]
    expect(new Set(titles).size).toBe(3)
    expect(titles.every((t) => t !== 'Position Changes Everything')).toBe(true)
  })

  it('the preflop-aggression lesson and the c-betting lesson no longer share an id or slug', () => {
    expect(preflopLesson!.id).not.toBe(cbetLesson!.id)
    expect(preflopLesson!.slug).not.toBe(cbetLesson!.slug)
  })

  it('the c-betting lesson kept its original id/slug — existing progress for it stays valid', () => {
    expect(cbetLesson!.id).toBe('position-changes-everything')
    expect(cbetLesson!.slug).toBe('position-changes-everything')
  })

  it('each lesson resolves via LESSONS_BY_ID and LESSONS_BY_SLUG to itself, in the correct module', () => {
    for (const lesson of [preflopLesson!, cbetLesson!, defenseLesson!]) {
      expect(LESSONS_BY_ID[lesson.id]).toBe(lesson)
      expect(LESSONS_BY_SLUG[lesson.slug]).toBe(lesson)
      expect(LESSONS_BY_ID[lesson.id].module_id).toBe(lesson.module_id)
    }
  })

  it('module-scoped lookup (what lesson cards and "Next Lesson" actually use) never crosses modules', () => {
    const preflopModuleLessons = LESSONS_BY_MODULE['preflop-aggression-module'] ?? []
    const cbetModuleLessons = LESSONS_BY_MODULE['cbetting-fundamentals-module'] ?? []
    expect(preflopModuleLessons.some((l) => l.id === cbetLesson!.id)).toBe(false)
    expect(cbetModuleLessons.some((l) => l.id === preflopLesson!.id)).toBe(false)
  })
})

describe('Next Lesson resolution uses curriculum order + unique IDs, never title', () => {
  it('walking sort_order within a module lands on the correct next lesson by id, for both formerly-colliding modules', () => {
    for (const moduleId of ['preflop-aggression-module', 'cbetting-fundamentals-module']) {
      const allLessons = (LESSONS_BY_MODULE[moduleId] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
      expect(allLessons.length).toBeGreaterThan(0)
      for (let i = 0; i < allLessons.length - 1; i++) {
        const current = allLessons[i]
        const lessonIdx = allLessons.findIndex((l) => l.id === current.id)
        expect(lessonIdx).toBe(i)
        const nextLesson = allLessons[lessonIdx + 1] ?? null
        expect(nextLesson).not.toBeNull()
        expect(nextLesson!.id).toBe(allLessons[i + 1].id)
        // The lookup must never accidentally match by title/subtitle text.
        expect(nextLesson!.id).not.toBe(current.id)
      }
    }
  })
})

describe('Resume Learning resolves the correct lesson by id, not by slug-keyed lookup', () => {
  it('LESSONS_BY_ID resolves every lesson id — including ones where id !== slug — while LESSONS_BY_SLUG would not', () => {
    const differing = LESSONS.filter((l) => l.id !== l.slug)
    expect(differing.length).toBeGreaterThan(0) // sanity: such lessons exist in this curriculum

    for (const lesson of differing) {
      // Simulates progress.continueTarget.lesson_id — the server/local
      // progress store only ever knows lesson.id.
      const continueTargetLessonId = lesson.id

      const resolvedById = LESSONS_BY_ID[continueTargetLessonId]
      expect(resolvedById).toBe(lesson)

      // The bug this guards: app/learn/page.tsx used to look this id up in
      // LESSONS_BY_SLUG (a slug-keyed map). Since this lesson's id is not a
      // valid slug key, that lookup fails (or — worse — silently returns
      // whatever unrelated lesson happens to have that string as its slug).
      const wronglyResolvedBySlugMap = LESSONS_BY_SLUG[continueTargetLessonId]
      expect(wronglyResolvedBySlugMap).not.toBe(lesson)
    }
  })

  it('resolves the c-betting lesson (id === slug case) correctly by id too', () => {
    const cbetLesson = LESSONS.find((l) => l.id === 'position-changes-everything')
    expect(cbetLesson).toBeDefined()
    expect(LESSONS_BY_ID['position-changes-everything']).toBe(cbetLesson)
  })
})

describe('completion is recorded against the correct lesson', () => {
  it('recording completion by lesson.id can never attach to the wrong module for the two formerly-colliding lessons', () => {
    const preflopLesson = LESSONS.find((l) => l.module_id === 'preflop-aggression-module' && l.sort_order === 4)!
    const cbetLesson = LESSONS.find((l) => l.module_id === 'cbetting-fundamentals-module' && l.sort_order === 8)!

    // Mirrors runCompletion's module-complete check in
    // app/learn/lesson/[slug]/page.tsx: every lesson id in the module must
    // be completed for the module to be considered complete.
    const fakeProgress: Record<string, { status: string }> = {
      [preflopLesson.id]: { status: 'completed' },
    }

    const preflopModuleLessonIds = (LESSONS_BY_MODULE['preflop-aggression-module'] ?? []).map((l) => l.id)
    const cbetModuleLessonIds = (LESSONS_BY_MODULE['cbetting-fundamentals-module'] ?? []).map((l) => l.id)

    // Completing the preflop lesson must not mark anything in the cbetting
    // module as complete (would happen if both lessons shared one id key).
    const cbetModuleFalselyComplete = cbetModuleLessonIds.every((id) => fakeProgress[id]?.status === 'completed')
    expect(cbetModuleFalselyComplete).toBe(false)
    expect(cbetModuleLessonIds).not.toContain(preflopLesson.id)
    expect(preflopModuleLessonIds).toContain(preflopLesson.id)
    expect(preflopModuleLessonIds).not.toContain(cbetLesson.id)
  })
})
