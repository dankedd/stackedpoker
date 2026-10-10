/**
 * Client for "Ask the coach" in the hand replayer (backend
 * app/api/routes/hand_coach.py). Only the hand id, the replayer step and the
 * question are sent: the server builds the hand context from the user's own
 * stored hand.
 *
 * Errors carry `status` and `detail` exactly like lib/learn/api.ts, so
 * CoachChat's existing handling (daily limit, 401/403/429/5xx) applies as is.
 */

import type { CoachUsage } from "@/lib/learn/api";
import type { CoachMessage } from "@/lib/learn/types";

interface UsageWire {
  limit: number;
  used: number;
  remaining: number;
  reset_at: string;
  unlimited: boolean;
}

interface WireMessage {
  role: "user" | "coach";
  content: string;
  ts: string | null;
}

async function call<T>(path: string, token: string, init?: RequestInit, timeoutMs = 45_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch (e) {
    const err = new Error(e instanceof DOMException && e.name === "AbortError" ? "Request timed out." : "Network error.");
    (err as Error & { status?: number }).status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    const detail = body.detail ?? `HTTP ${res.status}`;
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    Object.assign(err, { detail, status: res.status });
    throw err;
  }
  return res.json() as Promise<T>;
}

const toMessage = (m: WireMessage): CoachMessage => ({ role: m.role, content: m.content, timestamp: m.ts ?? new Date().toISOString() });

/** The open conversation about this hand (empty when there is none). */
export async function loadHandConversation(handId: string, token: string): Promise<{ sessionId: string | null; messages: CoachMessage[] }> {
  const r = await call<{ session_id: string | null; messages: WireMessage[] }>(`/api/hand-coach/${encodeURIComponent(handId)}`, token, undefined, 20_000);
  return { sessionId: r.session_id, messages: r.messages.map(toMessage) };
}

/** Closes the conversation; the next question starts a new one. */
export async function newHandConversation(handId: string, token: string): Promise<void> {
  await call(`/api/hand-coach/${encodeURIComponent(handId)}/new`, token, { method: "POST" }, 20_000);
}

export async function askHandCoach(
  handId: string,
  message: string,
  stepIndex: number | null,
  token: string,
): Promise<{ session_id: string; reply: CoachMessage; usage: CoachUsage }> {
  const r = await call<{ session_id: string; reply: string; usage: UsageWire }>("/api/hand-coach/message", token, {
    method: "POST",
    body: JSON.stringify({ hand_id: handId, message, step_index: stepIndex }),
  });
  return {
    session_id: r.session_id,
    reply: { role: "coach", content: r.reply, timestamp: new Date().toISOString() },
    usage: { limit: r.usage.limit, used: r.usage.used, remaining: r.usage.remaining, resetAt: r.usage.reset_at, unlimited: r.usage.unlimited },
  };
}
