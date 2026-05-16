import type {
  AnalysisResponse,
  ConfirmedPokerState,
  ExtractionResult,
  VisionAnalysisResponse,
  SessionAnalysisResponse,
  TournamentAnalysisResponse,
  PlayerProfile,
} from "./types";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";

// Empty base = Next.js rewrites (/api/* → FastAPI). No CORS needed.
const API_BASE = "";

async function apiFetch<T>(path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    // Structured error detail (e.g. limit_reached) or plain string
    const detail = body.detail ?? `HTTP ${res.status}`;
    const err = new Error(typeof detail === "string" ? detail : detail.message ?? JSON.stringify(detail));
    (err as Error & { detail?: unknown }).detail = detail;
    throw err;
  }
  return res.json() as Promise<T>;
}

async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  // No Content-Type header — browser sets multipart/form-data boundary automatically
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Text hand analysis (existing) ─────────────────────────────────────────

export async function analyzeHand(
  handText: string,
  token: string,
  setup?: AnalysisSetupValue,
): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>("/api/analyze", token, {
    method: "POST",
    body: JSON.stringify({
      hand_text: handText,
      game_type: setup?.gameType,
      player_count: setup?.playerCount,
    }),
  });
}

export async function analyzeSession(
  sessionText: string,
  token: string,
  setup?: { gameType?: string; playerCount?: number },
): Promise<SessionAnalysisResponse> {
  return apiFetch<SessionAnalysisResponse>("/api/analyze-session", token, {
    method: "POST",
    body: JSON.stringify({
      session_text: sessionText,
      game_type: setup?.gameType,
      player_count: setup?.playerCount,
    }),
  });
}

export async function analyzeTournament(
  tournamentText: string,
  token: string,
  setup?: { tournamentType?: string; fieldSize?: string; buyIn?: string },
): Promise<TournamentAnalysisResponse> {
  return apiFetch<TournamentAnalysisResponse>("/api/analyze-tournament", token, {
    method: "POST",
    body: JSON.stringify({
      tournament_text: tournamentText,
      tournament_type: setup?.tournamentType ?? "MTT",
      field_size: setup?.fieldSize ?? "",
      buy_in: setup?.buyIn ?? "",
    }),
  });
}

export async function analyzeTournamentFile(
  file: File,
  token: string,
  setup?: { tournamentType?: string; buyIn?: string },
): Promise<TournamentAnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (setup?.tournamentType) formData.append("tournament_type", setup.tournamentType);
  if (setup?.buyIn) formData.append("buy_in", setup.buyIn);

  const res = await fetch("/api/analyze-tournament-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    const detail = body.detail ?? `HTTP ${res.status}`;
    const err = new Error(typeof detail === "string" ? detail : detail.message ?? JSON.stringify(detail));
    (err as Error & { detail?: unknown }).detail = detail;
    throw err;
  }
  return res.json() as Promise<TournamentAnalysisResponse>;
}

export async function parseHand(handText: string): Promise<{ parsed_hand: AnalysisResponse["parsed_hand"] }> {
  return apiFetch("/api/parse", null, {
    method: "POST",
    body: JSON.stringify({ hand_text: handText }),
  });
}

// ── Single-shot image analysis (legacy) ───────────────────────────────────

export async function analyzeHandImage(file: File): Promise<VisionAnalysisResponse> {
  return apiUpload<VisionAnalysisResponse>("/api/analyze-image", file);
}

// ── Two-step extraction + confirmation ────────────────────────────────────

/** Step 1: Extract raw state from screenshot (no coaching yet). */
export async function extractHand(file: File): Promise<ExtractionResult> {
  return apiUpload<ExtractionResult>("/api/extract-hand", file);
}

/** Step 2: Run coaching on user-confirmed state, get full replay. */
export async function confirmHand(
  state: ConfirmedPokerState,
  token?: string | null,
): Promise<VisionAnalysisResponse> {
  return apiFetch<VisionAnalysisResponse>("/api/confirm-hand", token ?? null, {
    method: "POST",
    body: JSON.stringify(state),
  });
}

// ── Player Profile ─────────────────────────────────────────────────────────

export async function fetchPlayerProfile(token: string): Promise<PlayerProfile> {
  return apiFetch<PlayerProfile>("/api/player-profile", token, { method: "GET" });
}

export async function recordPuzzleCompletion(
  token: string,
  data: {
    puzzle_id: string;
    difficulty: string;
    category: string;
    score: number;
    ev_loss_bb: number;
    tags: string[];
  },
): Promise<{ saved: boolean }> {
  return apiFetch<{ saved: boolean }>("/api/player-profile/puzzle-complete", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Stripe Billing ─────────────────────────────────────────────────────────

/** Create a Stripe Checkout Session and return the redirect URL. */
export async function createCheckoutSession(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/api/stripe/create-checkout", token, {
    method: "POST",
    body: JSON.stringify({ origin: window.location.origin }),
  });
}

/** Create a Stripe Billing Portal session and return the redirect URL. */
export async function createPortalSession(token: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/api/stripe/customer-portal", token, {
    method: "POST",
    body: JSON.stringify({ origin: window.location.origin }),
  });
}
