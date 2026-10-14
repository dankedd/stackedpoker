-- ============================================================
-- Onboarding: the Preflop Trainer / Hand Review choice and product tours
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- One row per user, created when the user first makes a choice on
-- /onboarding (or answers the trainer's "want a tour?" nudge). No row and
-- no trainer-prompt signup = middleware.ts sends the user to /onboarding.
--
-- Tour progress is not security-sensitive, so users read and write their
-- own row directly (RLS). Nothing here grants access to anything.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id                    uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What the user picked on the choice screen.
  onboarding_choice          text         CHECK (onboarding_choice IN ('preflop', 'hands', 'skip')),
  onboarding_choice_seen_at  timestamptz,
  tour_preflop_completed_at  timestamptz,
  tour_hands_completed_at    timestamptz,
  tour_skipped_at            timestamptz,
  -- The dashboard tip "Take the … tour" was dismissed.
  tour_tip_dismissed_at      timestamptz,
  -- The one-time "How would you describe your level?" at the first AI Coach question.
  level_prompt_seen_at       timestamptz,
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_onboarding_select_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_select_own" ON public.user_onboarding
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_onboarding_insert_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_insert_own" ON public.user_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_onboarding_update_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_update_own" ON public.user_onboarding
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
