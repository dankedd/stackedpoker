import { describe, it, expect } from 'vitest'
import { LEARNING_MODULES } from '@/lib/learn/curriculum'
import { JOURNEY_STAGES } from '@/lib/learn/curriculumRoadmap'
import { getJourneyOverview } from '@/lib/learn/journey'
import { FEATURED_MODULE_IDS } from '../LearningPath'

/**
 * Guards against the homepage's "Learning Path" section drifting away from
 * the real curriculum single source of truth (lib/learn/curriculum.ts) —
 * every featured module id and every displayed count must resolve to real,
 * currently-complete data, never a hardcoded number that silently goes stale.
 */
describe('LearningPath — featured modules resolve to real curriculum data', () => {
  const modulesById = new Map(LEARNING_MODULES.map((m) => [m.id, m]))

  it('every featured module id exists and is content-complete', () => {
    for (const id of FEATURED_MODULE_IDS) {
      const module = modulesById.get(id)
      expect(module, `module "${id}" should exist in LEARNING_MODULES`).toBeDefined()
      expect(module?.contentStatus, `module "${id}" should be complete`).toBe('complete')
      expect(module?.slug, `module "${id}" should have a real slug`).toBeTruthy()
      expect(typeof module?.estimatedLessons, `module "${id}" should have a lesson count`).toBe('number')
    }
  })

  it('the "available modules" count matches getJourneyOverview(), never a hardcoded number', () => {
    const overview = getJourneyOverview({})
    const recomputed = LEARNING_MODULES.filter((m) => !m.contentStatus || m.contentStatus === 'complete').length
    expect(overview.availableModules).toBe(recomputed)
    expect(overview.totalRoadmapModules).toBe(LEARNING_MODULES.length)
  })

  it('every JOURNEY_STAGES moduleId referenced by the homepage timeline exists in LEARNING_MODULES', () => {
    const shown = JOURNEY_STAGES.slice(0, 6)
    for (const stage of shown) {
      for (const id of stage.moduleIds) {
        expect(modulesById.get(id), `stage "${stage.id}" references unknown module "${id}"`).toBeDefined()
      }
    }
  })
})
