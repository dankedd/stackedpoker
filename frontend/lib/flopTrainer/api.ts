import { ApiError, type TrainerUsage } from "@/lib/ranges/api";
import type { CategoryStats, NutSide, Verdict } from "./logic";

/**
 * Flop Equity Trainer API (backend/app/api/routes/flop_trainer.py).
 *
 * The client says which flop it saw and what it guessed; the server looks up
 * the exact answer, grades it, applies the daily limit (shared with the
 * Preflop Trainer) and the XP. Every XP number shown comes from the response.
 */

export interface FlopTrainerState {
  daily_xp: number;
  daily_cap: number;
  best_session_points: number;
  hands_played: number;
  categories: CategoryStats;
}

export interface AnswerResult {
  verdict: Verdict;
  error: number;
  exact_equity: number;
  nut_actual: NutSide;
  nut_correct: boolean;
  points: number;
  xp_awarded: number;
  daily_xp: number;
  daily_cap: number;
  too_fast: boolean;
  total_xp: number;
  level: number;
  leveled_up: boolean;
  session_answers: number;
  session_points: number;
  session_complete: boolean;
  best_session_points: number;
  new_record: boolean;
  usage?: TrainerUsage | null;
}

export interface AnswerBody {
  spot_id: string;
  flop: string;
  guess_equity: number;
  nut_guess: NutSide;
  session_id: string;
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail);
  }
  return (await res.json()) as T;
}

export function submitAnswer(token: string, body: AnswerBody): Promise<AnswerResult> {
  return call<AnswerResult>("/api/flop-trainer/answers", token, { method: "POST", body: JSON.stringify(body) });
}

export function fetchFlopTrainerState(token: string): Promise<FlopTrainerState> {
  return call<FlopTrainerState>("/api/flop-trainer/state", token);
}
