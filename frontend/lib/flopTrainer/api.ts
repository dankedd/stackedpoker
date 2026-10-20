import { ApiError, type TrainerUsage } from "@/lib/ranges/api";
import type { CategoryStats, NutSide, Verdict } from "./logic";
import type { Band, CbetAdvice, Size } from "./phase3";

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
  versus_streak?: number;
  versus_best?: number;
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
  cbet?: { band_ok: boolean; size_ok: boolean; points: number; advice: CbetAdvice } | null;
  usage?: TrainerUsage | null;
}

export interface AnswerBody {
  spot_id: string;
  flop: string;
  guess_equity: number;
  nut_guess: NutSide;
  session_id: string;
  cbet_band?: Band;
  cbet_size?: Size;
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

export interface VersusResult {
  correct: boolean;
  equity_a: number;
  equity_b: number;
  xp_awarded: number;
  daily_xp: number;
  daily_cap: number;
  too_fast: boolean;
  total_xp: number;
  level: number;
  leveled_up: boolean;
  streak: number;
  best_streak: number;
  usage?: TrainerUsage | null;
}

export function submitVersus(
  token: string,
  body: { spot_id: string; flop_a: string; flop_b: string; pick: "a" | "b" },
): Promise<VersusResult> {
  return call<VersusResult>("/api/flop-trainer/versus", token, { method: "POST", body: JSON.stringify(body) });
}

/** {ip|oop: {hand: [frequency, equity %]}} — Pro only (403 PRO_REQUIRED otherwise). */
export type ExplorerHands = Record<"ip" | "oop", Record<string, [number, number]>>;

export function fetchExplorerHands(token: string, spotId: string, flop: string): Promise<ExplorerHands> {
  return call<ExplorerHands>(
    `/api/flop-trainer/explorer/hands?spot_id=${encodeURIComponent(spotId)}&flop=${encodeURIComponent(flop)}`,
    token,
  );
}
