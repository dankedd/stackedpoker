/**
 * Coaching API client — connects frontend to Phase 4 backend.
 *
 * All endpoints are fire-and-forget safe (errors are caught and returned,
 * never thrown to the caller). The UI can always render something.
 */

import type {
  CoachingAdvice,
  DrillDifficulty,
  DrillResult,
  DrillSpec,
  DrillType,
  HandScore,
  LeakProfile,
  MistakeReport,
  SkillSnapshot,
  TrainingPlanItem,
} from "./types";

const API_BASE = "";

async function coachFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Action Analysis ──────────────────────────────────────────────────────

export interface AnalyzeActionParams {
  action_taken: string;
  street: string;
  board: string[];
  spot_type?: string;
  positions?: string;
  stack_depth?: number;
  pot_bb?: number;
  is_ip?: boolean;
  is_pfr?: boolean;
}

export interface AnalyzeActionResponse {
  mistake: MistakeReport;
  advice: CoachingAdvice;
}

export async function analyzeAction(
  params: AnalyzeActionParams,
): Promise<AnalyzeActionResponse> {
  return coachFetch<AnalyzeActionResponse>("/api/coaching/analyze-action", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Drill Generation ─────────────────────────────────────────────────────

export interface GenerateDrillsParams {
  drill_type: DrillType;
  count?: number;
  difficulty?: DrillDifficulty;
  user_id?: string;
}

export async function generateDrills(
  params: GenerateDrillsParams,
): Promise<DrillSpec[]> {
  return coachFetch<DrillSpec[]>("/api/coaching/drills/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface SubmitDrillParams {
  user_id: string;
  drill_id: string;
  drill_type: DrillType;
  action_chosen: string;
  time_ms?: number;
  concept_tags?: string[];
}

export async function submitDrill(
  params: SubmitDrillParams,
): Promise<{ drill_id: string; result: DrillResult; skill_snapshot: SkillSnapshot }> {
  return coachFetch("/api/coaching/drills/submit", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Skill Profile ────────────────────────────────────────────────────────

export async function getSkillProfile(userId: string): Promise<SkillSnapshot> {
  return coachFetch<SkillSnapshot>(`/api/coaching/skill/${userId}`);
}

export async function getLeaks(userId: string): Promise<LeakProfile[]> {
  return coachFetch<LeakProfile[]>(`/api/coaching/leaks/${userId}`);
}

export async function getTrainingPlan(
  userId: string,
): Promise<TrainingPlanItem[]> {
  return coachFetch<TrainingPlanItem[]>(
    `/api/coaching/training-plan/${userId}`,
  );
}
