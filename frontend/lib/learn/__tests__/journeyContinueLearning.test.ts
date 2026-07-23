import { describe, it, expect } from 'vitest'
import {
  getCompletedModuleIds,
  getModuleDisplayStatus,
  getNextLessonTarget,
} from '../journey'
import { LESSONS_BY_MODULE, LEARNING_MODULES } from '../curriculum'
import type { LessonProgressEntry } from '../api'

// These tests exercise the pure Continue-Learning / module-completion logic
// against the REAL curriculum data (not fixtures), so a drift between this
// logic and the actual authored lesson set would be caught here. They use
// two modules known to have real, implemented content — poker-fundamentals
// and math-foundations — and derive expectations from LESSONS_BY_MODULE at
// test time rather than hardcoding lesson ids/counts, so the tests don't
// need updating as unrelated modules gain content.

const FUND_MODULE_ID = 'poker-fundamentals-module'
const fundLessons = (LESSONS_BY_MODULE[FUND_MODULE_ID] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)

function completedEntry(): LessonProgressEntry {
  return {
    status: 'completed',
    attempts: 1,
    best_score: 100,
    last_score: 100,
    current_step_index: 0,
    current_step_id: null,
    total_steps: null,
    completed_at: new Date().toISOString(),
    module_id: FUND_MODULE_ID,
    path_id: null,
  }
}

describe('journey.ts — Continue Learning / module completion (regression coverage for the persistence bug)', () => {
  it('an empty progress bundle (fresh/never-loaded state) is never mistaken for "everything complete"', () => {
    // This is the exact inverse of the persistence bug: if a default/empty
    // client state were ever treated as authoritative, every module would
    // wrongly appear complete and getNextLessonTarget would return null
    // (nothing left to do) instead of pointing at lesson 1.
    const completedModuleIds = getCompletedModuleIds({})
    expect(completedModuleIds.size).toBe(0)

    const next = getNextLessonTarget({})
    expect(next).not.toBeNull()
    expect(next?.lesson.id).toBe(fundLessons[0].id)
  })

  it('a module is NOT complete until every one of its lessons is individually completed', () => {
    expect(fundLessons.length).toBeGreaterThan(1)
    const lessons: Record<string, LessonProgressEntry> = {}
    // Complete every lesson except the last.
    for (const l of fundLessons.slice(0, -1)) {
      lessons[l.id] = completedEntry()
    }
    const completedModuleIds = getCompletedModuleIds(lessons)
    expect(completedModuleIds.has(FUND_MODULE_ID)).toBe(false)

    const module = LEARNING_MODULES.find((m) => m.id === FUND_MODULE_ID)!
    expect(getModuleDisplayStatus(module, completedModuleIds)).toBe('available')
  })

  it('a module becomes complete only once its actual final lesson is completed too', () => {
    const lessons: Record<string, LessonProgressEntry> = {}
    for (const l of fundLessons) {
      lessons[l.id] = completedEntry()
    }
    const completedModuleIds = getCompletedModuleIds(lessons)
    expect(completedModuleIds.has(FUND_MODULE_ID)).toBe(true)

    const module = LEARNING_MODULES.find((m) => m.id === FUND_MODULE_ID)!
    expect(getModuleDisplayStatus(module, completedModuleIds)).toBe('complete')
  })

  it('Continue Learning never re-suggests a lesson that is already completed', () => {
    const lessons: Record<string, LessonProgressEntry> = {
      [fundLessons[0].id]: completedEntry(),
    }
    const next = getNextLessonTarget(lessons)
    expect(next).not.toBeNull()
    expect(next?.lesson.id).not.toBe(fundLessons[0].id)
    expect(next?.lesson.id).toBe(fundLessons[1].id)
  })

  it('Continue Learning returns null once every implemented module is fully completed', () => {
    const lessons: Record<string, LessonProgressEntry> = {}
    for (const m of LEARNING_MODULES) {
      if (m.contentStatus && m.contentStatus !== 'complete') continue
      for (const l of LESSONS_BY_MODULE[m.id] ?? []) {
        lessons[l.id] = completedEntry()
      }
    }
    expect(getNextLessonTarget(lessons)).toBeNull()
  })

  it('a single missed lesson deep in an otherwise-complete module still blocks module completion (no partial credit)', () => {
    const lessons: Record<string, LessonProgressEntry> = {}
    for (const l of fundLessons) lessons[l.id] = completedEntry()
    // Regress exactly one lesson back to in_progress — simulates the bug
    // where one lesson's completion silently failed to persist.
    const middle = fundLessons[Math.floor(fundLessons.length / 2)]
    lessons[middle.id] = { ...completedEntry(), status: 'in_progress' }

    const completedModuleIds = getCompletedModuleIds(lessons)
    expect(completedModuleIds.has(FUND_MODULE_ID)).toBe(false)

    const next = getNextLessonTarget(lessons)
    expect(next?.lesson.id).toBe(middle.id)
  })
})
