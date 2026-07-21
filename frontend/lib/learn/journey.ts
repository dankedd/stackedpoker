/**
 * Poker Journey — pure helpers over the curriculum + a user's lesson progress.
 *
 * No React here — these are plain functions the hub, the /learn/journey
 * overview, and the module page all share so status logic lives in one place.
 */

import type { LearningModule, Lesson, JourneyStage } from './types'
import type { LessonProgressEntry } from './api'
import { LEARNING_MODULES, LESSONS, LESSONS_BY_MODULE } from './curriculum'
import { JOURNEY_STAGES } from './curriculumRoadmap'

export type ModuleDisplayStatus = 'complete' | 'available' | 'locked' | 'coming_soon'
export type StageDisplayStatus = 'complete' | 'current' | 'upcoming'

const MODULES_BY_ID: Record<string, LearningModule> = Object.fromEntries(
  LEARNING_MODULES.map((m) => [m.id, m]),
)

const ROADMAP_ORDERED = [...LEARNING_MODULES].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

// ── Module completion / lock status ──────────────────────────────────────────

/** A module is "complete" once it has playable lessons and every one is completed by this user. */
export function getCompletedModuleIds(lessons: Record<string, LessonProgressEntry>): Set<string> {
  const set = new Set<string>()
  for (const mod of LEARNING_MODULES) {
    const modLessons = LESSONS_BY_MODULE[mod.id] ?? []
    if (modLessons.length > 0 && modLessons.every((l) => lessons[l.id]?.status === 'completed')) {
      set.add(mod.id)
    }
  }
  return set
}

export function isModuleUnlocked(module: LearningModule, completedModuleIds: Set<string>): boolean {
  if (module.prerequisiteModuleId) return completedModuleIds.has(module.prerequisiteModuleId)
  if (module.unlock_after.length > 0) return module.unlock_after.every((id) => completedModuleIds.has(id))
  return true
}

export function getModuleDisplayStatus(
  module: LearningModule,
  completedModuleIds: Set<string>,
): ModuleDisplayStatus {
  if (module.contentStatus && module.contentStatus !== 'complete') return 'coming_soon'
  if (completedModuleIds.has(module.id)) return 'complete'
  return isModuleUnlocked(module, completedModuleIds) ? 'available' : 'locked'
}

// ── Stage status ──────────────────────────────────────────────────────────────

export function getStageForModule(moduleId: string): JourneyStage | undefined {
  return JOURNEY_STAGES.find((s) => s.moduleIds.includes(moduleId))
}

export function getStageStatus(stage: JourneyStage, completedModuleIds: Set<string>): StageDisplayStatus {
  const modules = stage.moduleIds.map((id) => MODULES_BY_ID[id]).filter((m): m is LearningModule => !!m)
  if (modules.length > 0 && modules.every((m) => completedModuleIds.has(m.id))) return 'complete'
  const hasActivity = modules.some(
    (m) => getModuleDisplayStatus(m, completedModuleIds) === 'available' || completedModuleIds.has(m.id),
  )
  return hasActivity ? 'current' : 'upcoming'
}

// ── Continue Learning ─────────────────────────────────────────────────────────

/** First not-yet-completed lesson among modules that are actually playable today, in Journey order. */
export function getNextLessonTarget(
  lessons: Record<string, LessonProgressEntry>,
): { lesson: Lesson; module: LearningModule } | null {
  for (const mod of ROADMAP_ORDERED) {
    if (mod.contentStatus && mod.contentStatus !== 'complete') continue
    const modLessons = (LESSONS_BY_MODULE[mod.id] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const next = modLessons.find((l) => lessons[l.id]?.status !== 'completed')
    if (next) return { lesson: next, module: mod }
  }
  return null
}

/** When every playable lesson is done, tease the next roadmap module that's unlocked but not yet built. */
export function getNextPlannedModule(completedModuleIds: Set<string>): LearningModule | null {
  for (const mod of ROADMAP_ORDERED) {
    if (!mod.contentStatus || mod.contentStatus === 'complete') continue
    if (isModuleUnlocked(mod, completedModuleIds)) return mod
  }
  return null
}

// ── Overview stats ───────────────────────────────────────────────────────────

export function getJourneyOverview(lessons: Record<string, LessonProgressEntry>) {
  const completedModuleIds = getCompletedModuleIds(lessons)
  const availableModules = LEARNING_MODULES.filter((m) => !m.contentStatus || m.contentStatus === 'complete')
  const availableCompleted = availableModules.filter((m) => completedModuleIds.has(m.id)).length
  return {
    availableModules: availableModules.length,
    availableCompleted,
    totalRoadmapModules: LEARNING_MODULES.length,
    totalLessonsAvailable: LESSONS.length,
  }
}

export { JOURNEY_STAGES }
