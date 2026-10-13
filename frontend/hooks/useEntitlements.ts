"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { fetchEntitlements, type Entitlements } from "@/lib/billing/entitlements";

/**
 * The signed-in user's entitlements, shared by every component on the page
 * (usage meters, limit modals, trial banners) so they agree and the database
 * is asked once. Refreshed on sign-in, when the tab regains focus (back from
 * Stripe Checkout) and whenever a caller reports new usage.
 */

interface State {
  userId: string | null;
  data: Entitlements | null;
  loading: boolean;
}

let state: State = { userId: null, data: null, loading: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let lastFetch = 0;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const SERVER_STATE: State = { userId: null, data: null, loading: false };
const getServerSnapshot = () => SERVER_STATE;

/** Fetches again now. Safe to call from anywhere; concurrent calls share one request. */
export function refreshEntitlements(): Promise<void> {
  if (!state.userId) return Promise.resolve();
  if (inflight) return inflight;
  const userId = state.userId;
  set({ loading: true });
  inflight = fetchEntitlements(createClient())
    .then((data) => {
      if (state.userId === userId) set({ data });
    })
    .catch(() => {
      // Unknown, not "Free": meters stay hidden; the server still enforces every limit.
    })
    .finally(() => {
      inflight = null;
      lastFetch = Date.now();
      set({ loading: false });
    });
  return inflight;
}

/** Applies a server response locally (e.g. the trainer's usage after a hand) without a refetch. */
export function patchEntitlements(fn: (e: Entitlements) => Entitlements) {
  if (state.data) set({ data: fn(state.data) });
}

export function useEntitlements() {
  const { user, loading: authLoading } = useAuth();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) return;
    if (state.userId !== userId) {
      set({ userId, data: null });
      if (userId) void refreshEntitlements();
    }
  }, [userId, authLoading]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetch > 15_000) void refreshEntitlements();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const refresh = useCallback(() => refreshEntitlements(), []);
  const mine = snap.userId === userId;
  return {
    entitlements: mine ? snap.data : null,
    loading: authLoading || (mine && snap.loading && !snap.data),
    signedIn: Boolean(userId),
    refresh,
  };
}
