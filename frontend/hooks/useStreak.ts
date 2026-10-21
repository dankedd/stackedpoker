"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

/**
 * The signed-in user's day streak (my_streak() in supabase_retention.sql),
 * shared by the trainer header, the daily-limit screen and the dashboard.
 * Days are counted in the user's own time zone (profiles.timezone, kept up
 * to date by RetentionTracker).
 */

export interface Streak {
  streak: number;
  activeToday: boolean;
}

interface State {
  userId: string | null;
  data: Streak | null;
}

let state: State = { userId: null, data: null };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: State = { userId: null, data: null };

export function parseStreak(raw: unknown): Streak | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return typeof r.streak === "number" ? { streak: r.streak, activeToday: r.active_today === true } : null;
}

export function refreshStreak(): Promise<void> {
  if (!state.userId) return Promise.resolve();
  if (inflight) return inflight;
  const userId = state.userId;
  inflight = Promise.resolve(createClient().rpc("my_streak"))
    .then(({ data, error }) => {
      // Before the migration the function is missing: no streak, no error UI.
      if (!error && state.userId === userId) set({ data: parseStreak(data) });
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Call after something that counts as activity (a trainer hand): the first one of the day moves the streak. */
export function noteActivity() {
  if (state.data && !state.data.activeToday) void refreshStreak();
}

export function useStreak(): Streak | null {
  const { user, loading } = useAuth();
  const snap = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (state.userId !== userId) {
      set({ userId, data: null });
      if (userId) void refreshStreak();
    }
  }, [userId, loading]);
  return snap.userId === userId ? snap.data : null;
}
