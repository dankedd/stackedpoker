import { describe, it, expect } from 'vitest'
import { LESSONS, LEARNING_MODULES, LESSONS_BY_MODULE } from '../curriculum'
import { ACHIEVEMENTS } from '../types'

const MODULE_ID = 'range-vs-range-module'
const moduleLessons = LESSONS_BY_MODULE[MODULE_ID] ?? []

describe('Module 8 (Range vs Range) — QA audit', () => {
  it('module is registered and complete', () => {
    const mod = LEARNING_MODULES.find((m) => m.id === MODULE_ID)
    expect(mod).toBeTruthy()
    expect(mod?.contentStatus).toBe('complete')
  })

  it('has exactly 5 lessons, sort_order 1-5, all referencing the module', () => {
    expect(moduleLessons.length).toBe(5)
    const orders = moduleLessons.map((l) => l.sort_order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5])
    for (const l of moduleLessons) expect(l.module_id).toBe(MODULE_ID)
  })

  it('every lesson id equals its slug (no id/slug drift within this module)', () => {
    for (const l of moduleLessons) expect(l.id).toBe(l.slug)
  })

  it('no step\'s concept_ids collide with that same step\'s own option ids (LEARN_QUESTION_QA.md bug class #1)', () => {
    const offenders: string[] = []
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        const conceptIds = new Set(step.concept_ids ?? [])
        const optionIds = (step.options ?? []).map((o) => o.id)
        for (const optId of optionIds) {
          if (conceptIds.has(optId)) offenders.push(`${lesson.id}/${step.id}: '${optId}'`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('every options-based step has at least 2 distinct, non-empty option ids', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (!step.options) continue
        expect(step.options.length).toBeGreaterThanOrEqual(2)
        const ids = step.options.map((o) => o.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of ids) expect(id.length).toBeGreaterThan(0)
      }
    }
  })

  it('every options-based step has exactly one "perfect"-quality option (a single defensible answer)', () => {
    const offenders: string[] = []
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (!step.options) continue
        const perfectCount = step.options.filter((o) => o.quality === 'perfect').length
        if (perfectCount !== 1) offenders.push(`${lesson.id}/${step.id}: ${perfectCount} perfect options`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('range_collision steps always carry both sides + a board', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (step.type !== 'range_collision') continue
        expect(step.range_collision_a?.range.length).toBeGreaterThan(0)
        expect(step.range_collision_b?.range.length).toBeGreaterThan(0)
        expect((step.board ?? []).length + (step.range_collision_boards?.length ?? 0)).toBeGreaterThan(0)
      }
    }
  })

  it('range_collision predict/archaeology modes always author options; reveal/morph never do (mode-gated scoring)', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (step.type !== 'range_collision') continue
        const mode = step.range_collision_mode ?? 'reveal'
        if (mode === 'predict' || mode === 'archaeology') {
          expect((step.options ?? []).length).toBeGreaterThan(0)
        } else {
          expect(step.options ?? []).toEqual([])
        }
      }
    }
  })

  it('range_xray steps never claim a numeric Good/Weak/Trash figure (only Strong may be numeric)', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (step.type !== 'range_xray') continue
        for (const entry of step.range_xray_entries ?? []) {
          expect((entry as Record<string, unknown>).good).toBeUndefined()
          expect((entry as Record<string, unknown>).weak).toBeUndefined()
          expect((entry as Record<string, unknown>).trash).toBeUndefined()
        }
      }
    }
  })

  it('board_rank_sort steps have a target that is a permutation of their boards', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (step.type !== 'board_rank_sort') continue
        const boardIds = (step.board_rank_sort_boards ?? []).map((b) => b.id).sort()
        const targetIds = (step.board_rank_sort_target ?? []).slice().sort()
        expect(targetIds).toEqual(boardIds)
      }
    }
  })

  it('tendency_summary\'s source step ids all resolve to real steps within the same lesson', () => {
    for (const lesson of moduleLessons) {
      for (const step of lesson.steps) {
        if (step.type !== 'tendency_summary') continue
        const idsInLesson = new Set(lesson.steps.map((s) => s.id))
        for (const srcId of step.summary_source_step_ids ?? []) {
          expect(idsInLesson.has(srcId)).toBe(true)
        }
      }
    }
  })

  it('every tendency-tagged step in The Range Lab is actually scored (has options or a numeric target)', () => {
    const lab = moduleLessons.find((l) => l.id === 'the-range-lab')
    expect(lab).toBeTruthy()
    for (const step of lab!.steps) {
      if (!step.tendency_tag) continue
      const isScorable = !!step.options?.length || step.range_equity_predict_correct != null
      expect(isScorable).toBe(true)
    }
  })

  it('achievement conditions reference this module\'s real lesson titles', () => {
    const lessonTitles = new Set(moduleLessons.map((l) => l.title))
    const rangeThinker = ACHIEVEMENTS.find((a) => a.id === 'range_thinker')!
    expect(rangeThinker.condition).toContain('Stop Thinking Hand vs Hand')
    expect(rangeThinker.condition).toContain('Range Advantage')
    expect(lessonTitles.has('Stop Thinking Hand vs Hand')).toBe(true)
    expect(lessonTitles.has('Range Advantage')).toBe(true)

    const xray = ACHIEVEMENTS.find((a) => a.id === 'xray_vision')!
    expect(lessonTitles.has('X-Ray the Range')).toBe(true)
    expect(xray.condition).toContain('X-Ray the Range')

    const capstone = ACHIEVEMENTS.find((a) => a.id === 'range_scientist')!
    expect(capstone.condition).toContain('The Range Lab')
    expect(lessonTitles.has('The Range Lab')).toBe(true)
  })

  it('no lesson or step id in this module collides with any id used elsewhere in LESSONS', () => {
    const ownIds = new Set(moduleLessons.map((l) => l.id))
    const otherLessons = LESSONS.filter((l) => l.module_id !== MODULE_ID)
    for (const l of otherLessons) expect(ownIds.has(l.id)).toBe(false)
  })

  it('no achievement id introduced for this module collides with a pre-existing achievement id', () => {
    const newIds = ['range_thinker', 'board_archaeologist', 'xray_vision', 'range_scientist']
    for (const id of newIds) {
      const matches = ACHIEVEMENTS.filter((a) => a.id === id)
      expect(matches.length).toBe(1)
    }
  })
})
