/**
 * Coaching system types — mirrors backend coaching/models.py.
 *
 * These types power the coaching dashboard, drill trainer, skill heatmap,
 * and hand review overlays. Keep in sync with backend Pydantic models.
 */

// ── Mistake Detection ────────────────────────────────────────────────────

export type MistakeSeverity =
  | "none"
  | "trivial"
  | "minor"
  | "moderate"
  | "major"
  | "critical";

export type ActionQuality =
  | "optimal"
  | "good"
  | "acceptable"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MistakeReport {
  street: string;
  action_taken: string;
  action_type: string;
  severity: MistakeSeverity;
  quality: ActionQuality;
  ev_loss_pct: number;
  ev_loss_bb: number;
  solver_frequency: number;
  solver_preferred_action: string;
  solver_preferred_freq: number;
  solver_confidence: number;
  action_distribution: Record<string, number>;
  explanation: string;
  concept_tags: string[];
  difficulty: number;
}

// ── Coaching Advice ──────────────────────────────────────────────────────

export interface CoachingAdvice {
  headline: string;
  verdict: string;
  score: number;
  spot_description: string;
  what_happened: string;
  why_its_right: string;
  why_its_wrong: string;
  what_to_do_instead: string;
  transferable_concept: string;
  simplified_strategy: string;
  strategy_reasoning: string;
  key_factors: string[];
  confidence: number;
  source: "solver" | "heuristic" | "hybrid";
}

// ── Action & Hand Scoring ────────────────────────────────────────────────

export interface ActionScore {
  action_index: number;
  street: string;
  action: string;
  is_hero: boolean;
  score: number;
  quality: ActionQuality;
  difficulty: number;
  mistake: MistakeReport | null;
  advice: CoachingAdvice | null;
}

export interface HandScore {
  overall_score: number;
  actions: ActionScore[];
  mistakes_count: number;
  worst_mistake: MistakeReport | null;
  total_ev_loss_bb: number;
  grade: string;
  grade_label: string;
}

// ── Drill System ─────────────────────────────────────────────────────────

export type DrillType =
  | "cbet_or_check"
  | "defend_or_fold"
  | "bet_size_select"
  | "bluff_or_give_up"
  | "value_bet_thin"
  | "range_construction";

export type DrillDifficulty = "beginner" | "intermediate" | "advanced";

export interface DrillOption {
  action: string;
  label: string;
  is_correct: boolean;
  is_acceptable: boolean;
  solver_frequency: number;
  feedback: string;
}

export interface DrillSpec {
  drill_id: string;
  drill_type: DrillType;
  difficulty: DrillDifficulty;
  board: string[];
  spot_type: string;
  positions: string;
  stack_depth: number;
  street: string;
  hero_is_ip: boolean;
  prompt: string;
  options: DrillOption[];
  correct_action: string;
  explanation: string;
  solver_distribution: Record<string, number>;
  concept_tags: string[];
  board_class: string;
  cluster_id: string;
}

export interface DrillResult {
  drill_id: string;
  drill_type: DrillType;
  action_chosen: string;
  is_correct: boolean;
  is_acceptable: boolean;
  score: number;
  time_ms: number;
  concept_tags: string[];
}

// ── Skill Model ──────────────────────────────────────────────────────────

export type SkillDimension =
  | "cbet_accuracy"
  | "defense_accuracy"
  | "bet_sizing"
  | "bluff_selection"
  | "value_betting"
  | "range_awareness"
  | "position_awareness"
  | "board_reading"
  | "pot_control"
  | "spr_awareness";

export const SKILL_LABELS: Record<SkillDimension, string> = {
  cbet_accuracy: "C-Bet Accuracy",
  defense_accuracy: "Defense",
  bet_sizing: "Bet Sizing",
  bluff_selection: "Bluff Selection",
  value_betting: "Value Betting",
  range_awareness: "Range Awareness",
  position_awareness: "Position Play",
  board_reading: "Board Reading",
  pot_control: "Pot Control",
  spr_awareness: "SPR Awareness",
};

export const SKILL_ICONS: Record<SkillDimension, string> = {
  cbet_accuracy: "Swords",
  defense_accuracy: "Shield",
  bet_sizing: "Ruler",
  bluff_selection: "Ghost",
  value_betting: "TrendingUp",
  range_awareness: "Grid3X3",
  position_awareness: "Navigation",
  board_reading: "Eye",
  pot_control: "Scale",
  spr_awareness: "Layers",
};

export interface SkillSnapshot {
  user_id: string;
  timestamp: string;
  dimensions: Record<string, number>;
  overall_rating: number;
  level: number;
  total_xp: number;
  hands_analyzed: number;
  drills_completed: number;
  weakest_dimensions: string[];
  strongest_dimensions: string[];
  rating_trend: "improving" | "stable" | "declining";
  recent_accuracy_pct: number;
}

export interface LeakProfile {
  concept_id: string;
  dimension: SkillDimension;
  severity: "mild" | "moderate" | "severe";
  frequency: number;
  evidence_count: number;
  avg_ev_loss_bb: number;
  description: string;
  recommended_drill_type: DrillType | null;
  last_seen: string | null;
}

export interface TrainingPlanItem {
  dimension: string;
  rating: number;
  priority_score: number;
  recommended_drill: string | null;
}

// ── UI Helpers ───────────────────────────────────────────────────────────

export function qualityColor(quality: ActionQuality): string {
  switch (quality) {
    case "optimal":
      return "text-emerald-400";
    case "good":
      return "text-green-400";
    case "acceptable":
      return "text-blue-400";
    case "inaccuracy":
      return "text-yellow-400";
    case "mistake":
      return "text-orange-400";
    case "blunder":
      return "text-red-400";
  }
}

export function qualityBg(quality: ActionQuality): string {
  switch (quality) {
    case "optimal":
      return "bg-emerald-500/15 border-emerald-500/30";
    case "good":
      return "bg-green-500/15 border-green-500/30";
    case "acceptable":
      return "bg-blue-500/15 border-blue-500/30";
    case "inaccuracy":
      return "bg-yellow-500/15 border-yellow-500/30";
    case "mistake":
      return "bg-orange-500/15 border-orange-500/30";
    case "blunder":
      return "bg-red-500/15 border-red-500/30";
  }
}

export function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade.startsWith("B")) return "text-blue-400";
  if (grade.startsWith("C")) return "text-yellow-400";
  if (grade.startsWith("D")) return "text-orange-400";
  return "text-red-400";
}

export function severityGlow(severity: MistakeSeverity): string {
  switch (severity) {
    case "none":
    case "trivial":
      return "";
    case "minor":
      return "shadow-yellow-500/20 shadow-lg";
    case "moderate":
      return "shadow-orange-500/25 shadow-lg";
    case "major":
      return "shadow-red-500/30 shadow-xl";
    case "critical":
      return "shadow-red-500/40 shadow-2xl animate-pulse";
  }
}

export function dimensionRatingColor(rating: number): string {
  if (rating >= 75) return "text-emerald-400";
  if (rating >= 55) return "text-blue-400";
  if (rating >= 40) return "text-yellow-400";
  if (rating >= 25) return "text-orange-400";
  return "text-red-400";
}

export function dimensionRatingBg(rating: number): string {
  if (rating >= 75) return "bg-emerald-500";
  if (rating >= 55) return "bg-blue-500";
  if (rating >= 40) return "bg-yellow-500";
  if (rating >= 25) return "bg-orange-500";
  return "bg-red-500";
}
