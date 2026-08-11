import { canAccessModule } from '@/lib/entitlements'
import type { Tier } from '@/lib/entitlements'
import { LEARNING_MODULES } from '@/lib/learn/curriculumPublic.generated'

// ── Simplified onboarding self-assessment ───────────────────────────────────
// Replaces the old adaptive quiz (assessmentEngine.ts/assessmentQuestions.ts,
// removed) with a single self-reported level. No scoring, no correctness —
// just a direct mapping from level to a recommended starting point.

export type ExperienceLevel = 'beginner' | 'recreational' | 'intermediate' | 'advanced'

export interface ExperienceLevelOption {
  id: ExperienceLevel
  title: string
  bullets: [string, string]
}

export const EXPERIENCE_LEVEL_OPTIONS: ExperienceLevelOption[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    bullets: ['I know the rules but struggle with strategy.', 'I want to build a solid foundation.'],
  },
  {
    id: 'recreational',
    title: 'Recreational',
    bullets: ['I play regularly.', 'I know the basics but make inconsistent decisions.'],
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    bullets: ['I understand ranges and position.', 'I want to improve my win rate.'],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    bullets: ['I actively study poker.', "I'm looking to refine my strategy and fix leaks."],
  },
]

// Display metadata — used by the onboarding cards, the dashboard widget, and
// the Settings level-picker. Its own color scale, distinct from PlanBadge's
// Free/Plus/Elite styling — poker experience and subscription plan are
// unrelated axes.
export const EXPERIENCE_LEVEL_META: Record<ExperienceLevel, { label: string; classes: string }> = {
  beginner: { label: 'Beginner', classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  recreational: { label: 'Recreational', classes: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  intermediate: { label: 'Intermediate', classes: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  advanced: { label: 'Advanced', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
}

export type RecommendedTool = 'AI Coach' | 'Session Tracker' | 'Hand Reviews' | 'Leak Analysis'

interface LevelPlan {
  /** Module `order` (global 1-28 Poker Journey position — see entitlements.ts's
   *  own note on why `order`, not `sort_order`, is the cross-module ranking key). */
  startOrder: number
  tools: RecommendedTool[]
  studyHours: string
}

// The order-5 pick for 'intermediate' isn't arbitrary — it's this feature's
// own spec example ("Module 5 -> 6 -> 7 -> 8, ~6-8 hours"), which happens to
// land exactly on defending-the-open-module (order 5) in the real curriculum.
const LEVEL_PLAN: Record<ExperienceLevel, LevelPlan> = {
  beginner: { startOrder: 1, tools: ['AI Coach'], studyHours: '10-12 hours' },
  recreational: { startOrder: 3, tools: ['AI Coach', 'Session Tracker'], studyHours: '8-10 hours' },
  intermediate: { startOrder: 5, tools: ['AI Coach', 'Session Tracker', 'Hand Reviews'], studyHours: '6-8 hours' },
  advanced: { startOrder: 9, tools: ['AI Coach', 'Session Tracker', 'Leak Analysis'], studyHours: '4-6 hours' },
}

// Free tier gets the first 2 modules (by `order`) in full — see
// entitlements.ts's FREE_FULL_MODULE_COUNT. Kept as a local constant rather
// than imported since entitlements.ts doesn't export it; if that ever
// changes, canAccessModule below is still the actual source of truth this
// falls back to probing against.
const modulesSortedByOrder = [...LEARNING_MODULES].sort(
  (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
)

export interface Recommendation {
  level: ExperienceLevel
  /** The module the level maps to, regardless of whether the viewer can access it. */
  idealModuleId: string
  idealModuleTitle: string
  /** What's actually recommended to start with — same as ideal when accessible,
   *  otherwise the closest module the viewer's tier can actually open. */
  startModuleId: string
  startModuleTitle: string
  /** Set only when startModuleId differs from idealModuleId — the explanation
   *  shown to a Free-tier learner instead of silently downgrading the pick. */
  downgradeReason: string | null
  progression: { id: string; title: string }[] // up to 3 modules after the start module
  tools: RecommendedTool[]
  studyHours: string
}

export function computeRecommendation(level: ExperienceLevel, tier: Tier | string | null | undefined): Recommendation {
  const plan = LEVEL_PLAN[level]
  const idealModule = modulesSortedByOrder.find((m) => m.order === plan.startOrder) ?? modulesSortedByOrder[0]

  const canAccessIdeal = canAccessModule(tier, idealModule, modulesSortedByOrder)
  let startModule = idealModule
  let downgradeReason: string | null = null

  if (!canAccessIdeal) {
    // Walk backwards from the ideal pick to the nearest module this tier can
    // actually open in full — never recommend a locked module without
    // saying so, per the "never recommend inaccessible content without
    // context" requirement.
    const accessibleModules = modulesSortedByOrder.filter((m) => canAccessModule(tier, m, modulesSortedByOrder))
    startModule = accessibleModules[accessibleModules.length - 1] ?? modulesSortedByOrder[0]
    downgradeReason = `${idealModule.title} requires a Plus or Elite plan. Starting you at ${startModule.title} instead — the closest module available on your current plan.`
  }

  const startIdx = modulesSortedByOrder.findIndex((m) => m.id === startModule.id)
  const progression = modulesSortedByOrder.slice(startIdx + 1, startIdx + 4).map((m) => ({ id: m.id, title: m.title }))

  return {
    level,
    idealModuleId: idealModule.id,
    idealModuleTitle: idealModule.title,
    startModuleId: startModule.id,
    startModuleTitle: startModule.title,
    downgradeReason,
    progression,
    tools: plan.tools,
    studyHours: plan.studyHours,
  }
}
