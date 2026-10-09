import type { Deal } from "./logic";
import type { RangeActionKey } from "./types";

/**
 * Preflop Trainer XP API (backend/app/api/routes/preflop_trainer.py).
 *
 * The client only says WHICH hand it played and WHAT it chose; the server
 * re-grades it against its own copy of the charts, applies the streak and
 * daily cap, and awards XP. Every number shown after a hand comes from the
 * response — the browser never computes XP.
 */

export interface TrainerXpState {
  streak: number;
  best_streak: number;
  daily_xp: number;
  daily_cap: number;
  /** XP the next correct hand earns at the current streak. */
  xp_per_correct: number;
  /** Streak at which the next bonus tier starts; null at the top tier. */
  next_tier_at: number | null;
}

export interface HandXpResult extends TrainerXpState {
  verdict: "correct" | "mixed" | "wrong";
  xp_awarded: number;
  too_fast: boolean;
  total_xp: number;
  level: number;
  leveled_up: boolean;
}

export interface HandRef {
  kind: "open" | "pushfold" | "defense";
  chart_id: number;
  stack: number | null;
}

/** How the server identifies the chart a dealt hand was graded against. */
export function handRefFor(deal: Deal): HandRef {
  if (deal.type === "def") return { kind: "defense", chart_id: deal.chart.n, stack: null };
  if (deal.kind === "pf") return { kind: "pushfold", chart_id: deal.chart.page, stack: deal.stack };
  return { kind: "open", chart_id: deal.chart.page, stack: null };
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function submitTrainerHand(token: string, deal: Deal, action: RangeActionKey): Promise<HandXpResult> {
  return call<HandXpResult>("/api/preflop-trainer/hands", token, {
    method: "POST",
    body: JSON.stringify({ ...handRefFor(deal), hand: deal.hand, action }),
  });
}

export function fetchTrainerState(token: string): Promise<TrainerXpState> {
  return call<TrainerXpState>("/api/preflop-trainer/state", token);
}
