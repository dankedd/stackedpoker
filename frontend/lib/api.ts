import type {
  AnalysisResponse,
  ConfirmedPokerState,
  ExtractionResult,
  VisionAnalysisResponse,
} from "./types";
import type { AnalysisSetupValue } from "@/components/poker/AnalysisSetup";

// Empty base = Next.js rewrites (/api/* → FastAPI). No CORS needed.
const API_BASE = "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export async function analyzeHand(handText: string, setup?: AnalysisSetupValue): Promise<AnalysisResponse> {
  return apiFetch<AnalysisResponse>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({
      hand_text: handText,
      game_type: setup?.gameType,
      player_count: setup?.playerCount,
    }),
  });
}

export async function parseHand(handText: string): Promise<{ parsed_hand: AnalysisResponse["parsed_hand"] }> {
  return apiFetch("/api/parse", {
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
export async function confirmHand(state: ConfirmedPokerState): Promise<VisionAnalysisResponse> {
  return apiFetch<VisionAnalysisResponse>("/api/confirm-hand", {
    method: "POST",
    body: JSON.stringify(state),
  });
}
