// ── Step types ────────────────────────────────────────────────────────────────

export type StepType =
  | 'concept_reveal'
  | 'decision_spot'
  | 'range_build'
  | 'range_identify'
  | 'equity_predict'
  | 'bet_size_choose'
  | 'blocker_id'
  | 'board_classify'
  | 'nut_advantage'
  | 'bluff_pick'
  | 'reflection_prompt'

export type ActionQuality = 'perfect' | 'good' | 'acceptable' | 'mistake' | 'punt'
export type LessonType = 'micro' | 'range_trainer' | 'puzzle_drill' | 'concept_reveal' | 'simulation'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5

// ── Step option (for decision_spot, bet_size_choose, bluff_pick) ──────────────

export interface StepOption {
  id: string
  label: string
  quality: ActionQuality
  ev_loss_bb?: number
  feedback: string
  concept_triggered?: string
}

// ── A single interactive step within a lesson ─────────────────────────────────

export interface LessonStep {
  id: string
  type: StepType
  concept_ids?: string[]
  // Poker context
  board?: string[]
  hero_position?: string
  villain_position?: string
  hero_hand?: string[]
  pot_bb?: number
  effective_stack_bb?: number
  street?: 'preflop' | 'flop' | 'turn' | 'river'
  // Content
  narrative?: string
  options?: StepOption[]
  correct_answer?: string
  correct_feedback?: string
  wrong_feedback?: string
  // Range builder
  range_target?: string
  range_combos?: string[]
  range_tolerance?: number
  range_hint?: string
  // Equity predict
  equity_actual?: number
  equity_tolerance?: number
  // Concept reveal content
  concept_content?: string
  concept_title?: string
  // Visual
  visual?: 'table' | 'range_grid' | 'equity_bar' | 'heatmap' | 'pressure_chart'
  // XP
  xp?: number
}

// ── A complete lesson ─────────────────────────────────────────────────────────

export interface Lesson {
  id: string
  module_id: string
  slug: string
  title: string
  lesson_type: LessonType
  concept_ids: string[]
  steps: LessonStep[]
  estimated_min: number
  xp_reward: number
  sort_order: number
}

// ── A learning module (group of lessons) ─────────────────────────────────────

export interface LearningModule {
  id: string
  path_id: string
  slug: string
  title: string
  description: string
  concept_ids: string[]
  unlock_after: string[]
  sort_order: number
  xp_reward: number
  lessons?: Lesson[]
}

// ── A learning path (Beginner / Intermediate / Advanced) ─────────────────────

export interface LearningPath {
  id: string
  title: string
  description: string
  tier_required: 'free' | 'pro' | 'premium'
  sort_order: number
  modules?: LearningModule[]
}

// ── User progress on a lesson ─────────────────────────────────────────────────

export interface UserLessonProgress {
  user_id: string
  lesson_id: string
  status: 'locked' | 'available' | 'started' | 'complete'
  attempts: number
  best_score: number
  last_score: number
  completed_at?: string
  time_spent_sec: number
}

// ── Per-concept mastery ───────────────────────────────────────────────────────

export interface UserConceptMastery {
  user_id: string
  concept_id: string
  mastery_level: MasteryLevel
  exposures: number
  correct_streak: number
  last_tested?: string
  ease_factor: number
  interval_days: number
  next_review?: string
}

// ── Overall user skill progress ───────────────────────────────────────────────

export interface UserSkillProgress {
  user_id: string
  total_xp: number
  level: number
  streak_days: number
  last_active?: string
  unlocked_paths: string[]
  achievements: string[]
}

// ── A detected leak ───────────────────────────────────────────────────────────

export interface UserLeak {
  id: string
  user_id: string
  concept_id: string
  node_type: string
  leak_type: string
  severity: 'mild' | 'moderate' | 'severe'
  evidence_count: number
  last_seen: string
  resolved: boolean
}

// ── Step evaluation result from API ──────────────────────────────────────────

export interface StepResult {
  score: number
  quality: ActionQuality
  ev_loss_bb: number
  feedback: string
  concept_triggered?: string
  xp_earned: number
  level_before: number
  level_after: number
  leveled_up: boolean
  concept_explanation?: string
}

// ── Personalized dashboard ────────────────────────────────────────────────────

export interface PersonalizedDashboard {
  skill_progress: UserSkillProgress
  recommended_lesson?: {
    slug: string
    title: string
    reason: string
    concept_id?: string
  }
  review_concepts: UserConceptMastery[]
  active_leaks: UserLeak[]
  insight?: string
  coach_prompt?: string
  streak_status: {
    days: number
    bonus_xp: number
  }
}

// ── Concept node ──────────────────────────────────────────────────────────────

export interface ConceptNode {
  id: string
  title: string
  domain: string
  difficulty: Difficulty
  summary: string
  full_content?: {
    beginner: string
    intermediate: string
    advanced: string
  }
  formula?: string
  visual_type?: string
  tags: string[]
}

// ── AI coach ──────────────────────────────────────────────────────────────────

export interface CoachMessage {
  role: 'user' | 'coach'
  content: string
  timestamp: string
  concept_ids?: string[]
}

// ── Training session ──────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string
  user_id: string
  session_type: string
  context: Record<string, unknown>
  messages: CoachMessage[]
  started_at: string
  updated_at: string
}

// ── XP / level utilities ──────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000,
  5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000, 26000,
]

export function levelForXP(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

export function xpToNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const level = levelForXP(xp)
  const currentFloor = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextCeil = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 10000
  const current = xp - currentFloor
  const needed = nextCeil - currentFloor
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) }
}

// ── Display constants ─────────────────────────────────────────────────────────

export const QUALITY_COLORS: Record<ActionQuality, string> = {
  perfect:    'text-emerald-400',
  good:       'text-blue-400',
  acceptable: 'text-amber-400',
  mistake:    'text-orange-400',
  punt:       'text-red-400',
}

export const QUALITY_LABELS: Record<ActionQuality, string> = {
  perfect:    'Perfect Play',
  good:       'Good Play',
  acceptable: 'Acceptable',
  mistake:    'Mistake',
  punt:       'Major Leak',
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  0: 'Unseen',
  1: 'Exposed',
  2: 'Learning',
  3: 'Familiar',
  4: 'Proficient',
  5: 'Mastered',
}
