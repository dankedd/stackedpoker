"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { trackCustom } from "@/lib/metaPixel";
import {
  emptyRow,
  loadOnboarding,
  saveOnboarding,
  type OnboardingChoice,
  type OnboardingPatch,
  type OnboardingRow,
  type Tour,
} from "@/lib/onboarding/state";

/**
 * The signed-in user's onboarding row, shared by the choice screen, the
 * tours, the dashboard tip and the AI Coach level question. Writes update
 * the local copy at once and go to Supabase in the background.
 */

interface State {
  userId: string | null;
  row: OnboardingRow | null;
  loaded: boolean;
}

let state: State = { userId: null, row: null, loaded: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const SERVER: State = { userId: null, row: null, loaded: false };

async function load(userId: string) {
  try {
    const row = await loadOnboarding(createClient(), userId);
    if (state.userId === userId) set({ row, loaded: true });
  } catch {
    // Unknown is not "new user": nothing is shown that depends on it.
    if (state.userId === userId) set({ loaded: false });
  }
}

const now = () => new Date().toISOString();

export function useOnboarding() {
  const { user, loading } = useAuth();
  const snap = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    if (state.userId !== userId) {
      set({ userId, row: null, loaded: false });
      if (userId) void load(userId);
    }
  }, [userId, loading]);

  const update = useCallback(async (patch: OnboardingPatch) => {
    const id = state.userId;
    if (!id) return;
    set({ row: { ...(state.row ?? emptyRow()), ...patch } });
    try {
      await saveOnboarding(createClient(), id, patch);
    } catch {
      // Best effort: the tours still work this session; the row is retried on the next write.
    }
  }, []);

  const choose = useCallback(
    (choice: OnboardingChoice) => {
      trackCustom("OnboardingChoice", { choice });
      return update({
        onboarding_choice: choice,
        onboarding_choice_seen_at: state.row?.onboarding_choice_seen_at ?? now(),
        ...(choice === "skip" ? { tour_skipped_at: now() } : {}),
      });
    },
    [update],
  );

  const completeTour = useCallback(
    (tour: Tour) => {
      trackCustom("TourCompleted", { tour });
      return update(tour === "preflop" ? { tour_preflop_completed_at: now() } : { tour_hands_completed_at: now() });
    },
    [update],
  );

  const skipTour = useCallback(() => update({ tour_skipped_at: now() }), [update]);
  const dismissTip = useCallback(() => update({ tour_tip_dismissed_at: now() }), [update]);
  const markLevelPromptSeen = useCallback(() => update({ level_prompt_seen_at: now() }), [update]);

  const mine = snap.userId === userId;
  return {
    row: mine ? snap.row : null,
    loaded: mine && snap.loaded,
    signupSource: (user?.user_metadata as Record<string, unknown> | undefined)?.signup_source,
    choose,
    completeTour,
    skipTour,
    dismissTip,
    markLevelPromptSeen,
  };
}
