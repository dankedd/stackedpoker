/**
 * Onboarding: the Preflop Trainer / Hand Review choice and the product tours.
 *
 * State lives in public.user_onboarding (supabase_onboarding.sql), one row
 * per user, so it follows the user across devices. The rules below are pure
 * so middleware.ts, the dashboard tip and the tours all agree.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Tour = "preflop" | "hands";
export type OnboardingChoice = Tour | "skip";

export interface OnboardingRow {
  onboarding_choice: OnboardingChoice | null;
  onboarding_choice_seen_at: string | null;
  tour_preflop_completed_at: string | null;
  tour_hands_completed_at: string | null;
  tour_skipped_at: string | null;
  tour_tip_dismissed_at: string | null;
  level_prompt_seen_at: string | null;
}

export type OnboardingPatch = Partial<OnboardingRow>;

export const TOURS: Tour[] = ["preflop", "hands"];

export const TOUR_META: Record<Tour, { title: string; minutes: number; path: string }> = {
  preflop: { title: "Preflop Trainer", minutes: 1, path: "/preflop-trainer" },
  // Starts on the import page: the PokerCraft export, then the upload area.
  hands: { title: "Hand Review", minutes: 2, path: "/hands/import" },
};

/** Where a tour starts: the real screen, with ?tour= so the coach marks open. */
export function tourHref(tour: Tour): string {
  return `${TOUR_META[tour].path}?tour=${tour}`;
}

/** Signed up through the trainer's save-progress prompt (lib/ranges/guestProgress.ts). */
export function isTrainerPromptSignup(signupSource: unknown): boolean {
  return typeof signupSource === "string" && signupSource.startsWith("trainer_prompt_");
}

/**
 * The choice screen is for users who have not seen it yet. Trainer-prompt
 * signups go straight back to the trainer and only get an optional tour there.
 */
export function needsChoiceScreen(row: Pick<OnboardingRow, "onboarding_choice_seen_at"> | null, signupSource: unknown): boolean {
  return !row?.onboarding_choice_seen_at && !isTrainerPromptSignup(signupSource);
}

export function tourDone(row: OnboardingRow | null, tour: Tour): boolean {
  return Boolean(tour === "preflop" ? row?.tour_preflop_completed_at : row?.tour_hands_completed_at);
}

/** The other tour, if it has not been done yet. */
export function otherTour(row: OnboardingRow | null, finished: Tour): Tour | null {
  const other: Tour = finished === "preflop" ? "hands" : "preflop";
  return tourDone(row, other) ? null : other;
}

/**
 * The dashboard tip ("Take the Hand Review tour, 2 min"): once onboarding
 * has been through (choice made, or a trainer-prompt signup), until both
 * tours are done or the tip is dismissed. Suggests the trainer tour first.
 */
export function dashboardTipTour(row: OnboardingRow | null, signupSource: unknown): Tour | null {
  if (row?.tour_tip_dismissed_at) return null;
  if (!row?.onboarding_choice_seen_at && !isTrainerPromptSignup(signupSource)) return null;
  return TOURS.find((t) => !tourDone(row, t)) ?? null;
}

/** The trainer's "Want a 1-minute tour?" nudge, for trainer-prompt signups only. */
export function showTrainerTourNudge(row: OnboardingRow | null, signupSource: unknown): boolean {
  return isTrainerPromptSignup(signupSource) && !row?.tour_preflop_completed_at && !row?.tour_skipped_at;
}

const COLUMNS =
  "onboarding_choice, onboarding_choice_seen_at, tour_preflop_completed_at, tour_hands_completed_at, tour_skipped_at, tour_tip_dismissed_at, level_prompt_seen_at";

export async function loadOnboarding(supabase: SupabaseClient, userId: string): Promise<OnboardingRow | null> {
  const { data, error } = await supabase.from("user_onboarding").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as OnboardingRow | null) ?? null;
}

/** Creates the row on first write; only the given columns change. */
export async function saveOnboarding(supabase: SupabaseClient, userId: string, patch: OnboardingPatch): Promise<void> {
  const { error } = await supabase
    .from("user_onboarding")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export function emptyRow(): OnboardingRow {
  return {
    onboarding_choice: null,
    onboarding_choice_seen_at: null,
    tour_preflop_completed_at: null,
    tour_hands_completed_at: null,
    tour_skipped_at: null,
    tour_tip_dismissed_at: null,
    level_prompt_seen_at: null,
  };
}
