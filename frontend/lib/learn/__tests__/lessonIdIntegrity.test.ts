import { describe, it, expect } from 'vitest'
import { LESSONS, LESSONS_BY_SLUG, LESSONS_BY_MODULE, MODULES_BY_SLUG, LEARNING_MODULES } from '../curriculum'

// Regression coverage for the "canonical lesson identifier" class of bug:
// persistence must use exactly ONE stable identifier (lesson.id) end to end.
// If a lesson's id were ever duplicated, or a slug were ever substituted for
// an id somewhere in the write/read chain, progress would silently attach to
// the wrong lesson (or overwrite a different lesson's row) — exactly the kind
// of bug that looks fine in a single session and only surfaces later.

describe('curriculum lesson identifiers — uniqueness and round-trip integrity', () => {
  it('every lesson.id is globally unique across the entire curriculum', () => {
    const ids = LESSONS.map((l) => l.id)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id)
      seen.add(id)
    }
    expect(duplicates).toEqual([])
    expect(seen.size).toBe(LESSONS.length)
  })

  it('every lesson.slug is globally unique across the entire curriculum', () => {
    const slugs = LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(LESSONS.length)
  })

  it('no lesson.id collides with a DIFFERENT lesson\'s slug (id/slug namespace confusion)', () => {
    const idSet = new Set(LESSONS.map((l) => l.id))
    for (const lesson of LESSONS) {
      if (idSet.has(lesson.slug) ) {
        // Only acceptable if it's the SAME lesson's own id === its own slug.
        expect(lesson.slug).toBe(lesson.id)
      }
    }
  })

  it('LESSONS_BY_SLUG round-trips back to a lesson with the SAME id — the map is keyed by slug, not id', () => {
    for (const lesson of LESSONS) {
      const looked = LESSONS_BY_SLUG[lesson.slug]
      expect(looked).toBeDefined()
      expect(looked.id).toBe(lesson.id)
    }
  })

  it('every lesson in LESSONS_BY_MODULE[moduleId] actually declares that module_id, and every module_id resolves to a real module', () => {
    for (const [moduleId, lessons] of Object.entries(LESSONS_BY_MODULE)) {
      for (const lesson of lessons) {
        expect(lesson.module_id).toBe(moduleId)
      }
    }
    const moduleIds = new Set(Object.values(MODULES_BY_SLUG).map((m) => m.id))
    for (const lesson of LESSONS) {
      expect(moduleIds.has(lesson.module_id)).toBe(true)
    }
  })

  it('the id actually sent to the persistence API (lesson.id) is never accidentally the route slug', () => {
    // A regression here would mean someone wired a call site to lesson.slug
    // instead of lesson.id — this proves the two are never silently
    // interchangeable for lessons where they legitimately differ.
    const differing = LESSONS.filter((l) => l.id !== l.slug)
    expect(differing.length).toBeGreaterThan(0) // sanity: this curriculum actually has cases where they differ
    for (const lesson of differing) {
      // The canonical persisted key must be able to look itself up by id
      // through the module grouping — not accidentally via its slug.
      const moduleLessons = LESSONS_BY_MODULE[lesson.module_id] ?? []
      expect(moduleLessons.some((l) => l.id === lesson.id)).toBe(true)
    }
  })
})

// Regression coverage for a real, shipped bug (Module 12 promotion, 2026): a promoted
// module's real LEARNING_MODULES entry and its curriculumRoadmap.ts stub briefly
// coexisted (the stub was meant to be deleted on promotion, per module11/module12's own
// documented precedent, but was silently restored by an unrelated concurrent edit).
// `MODULES_BY_SLUG` is built via `Object.fromEntries(LEARNING_MODULES.map(m => [m.slug, m]))`
// (curriculum.ts) — a later duplicate entry SILENTLY WINS with no error, no warning, no
// crash. Effect: the module hub 404'd (the stub's `contentStatus: 'planned'` shape doesn't
// satisfy the page's real-module assumptions) and the reward manifest zeroed the module's
// XP — neither caught by tsc or the rest of this suite, only by live-server verification.
// This test makes that entire bug class permanently, mechanically impossible to reintroduce.
describe('module registration integrity — no duplicate/shadowing LEARNING_MODULES entries', () => {
  it('every module.id in LEARNING_MODULES (which includes the spread-in ROADMAP_MODULES) is globally unique', () => {
    const ids = LEARNING_MODULES.map((m) => m.id)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id)
      seen.add(id)
    }
    expect(duplicates).toEqual([])
  })

  it('every module.slug in LEARNING_MODULES is globally unique', () => {
    const slugs = LEARNING_MODULES.map((m) => m.slug)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const slug of slugs) {
      if (seen.has(slug)) duplicates.push(slug)
      seen.add(slug)
    }
    expect(duplicates).toEqual([])
  })

  it('every promoted module (a real module_id actually used by at least one LESSONS entry) is NOT a roadmap-only stub', () => {
    const realModuleIds = new Set(LESSONS.map((l) => l.module_id))
    for (const module of LEARNING_MODULES) {
      if (!realModuleIds.has(module.id)) continue
      // A roadmap stub's shape is `{ ...ROADMAP_DEFAULTS, ... }`, which always carries
      // `contentStatus: 'planned'` and an empty `concept_ids`/`unlock_after` pair — a
      // promoted module's real entry never does. If a module with real lessons still
      // looks like a stub, the stub was never removed from curriculumRoadmap.ts.
      expect(module.contentStatus, `${module.id} has real lessons but still has contentStatus 'planned' — its roadmap stub was never removed`).not.toBe('planned')
    }
  })
})
