-- ============================================================
-- Stacked Poker — Simplify Skill Assessment to a Single Self-Rating
-- Additive/corrective migration: run after supabase_skill_assessment_migration.sql.
--
-- The onboarding assessment was redesigned from an adaptive multi-question
-- quiz down to one self-reported experience level. This migration is safe
-- to run whether or not the original quiz-shaped migration was ever applied:
--   - If user_skill_assessment doesn't exist yet, it's created fresh in the
--     new, simplified shape.
--   - If it already exists (the old quiz shape), every quiz-specific column
--     is dropped and the new experience_level column is added.
-- Either way, the table ends up in the same final shape.
-- ============================================================

-- ── Create fresh in the new shape if the table doesn't exist at all ────────
CREATE TABLE IF NOT EXISTS public.user_skill_assessment (
  user_id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level       text        NOT NULL DEFAULT 'beginner'
                                      CHECK (experience_level IN ('beginner', 'recreational', 'intermediate', 'advanced')),
  recommended_module_id  text,
  completed_at           timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_skill_assessment ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS in Postgres — guard each one so this
-- migration can't fail re-running against a table whose policies already
-- exist (either from the original quiz-shaped migration, or a prior partial
-- run of this file).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_assessment' AND policyname = 'user_skill_assessment_select_own'
  ) THEN
    CREATE POLICY "user_skill_assessment_select_own" ON public.user_skill_assessment
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_assessment' AND policyname = 'user_skill_assessment_insert_own'
  ) THEN
    CREATE POLICY "user_skill_assessment_insert_own" ON public.user_skill_assessment
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_skill_assessment' AND policyname = 'user_skill_assessment_update_own'
  ) THEN
    CREATE POLICY "user_skill_assessment_update_own" ON public.user_skill_assessment
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── Simplify an existing (old quiz-shaped) table down to the new shape ────
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS assessment_version;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS self_experience;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS self_stakes;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS self_confidence;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS questions_answered;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS correct_count;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS assessment_score;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS final_challenge_offered;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS final_challenge_passed;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS answer_trace;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS estimated_league;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS recommended_league;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS chosen_start_league;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS fast_track_taken;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS fast_track_passed;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS strongest_topics;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS weakest_topics;
ALTER TABLE public.user_skill_assessment DROP COLUMN IF EXISTS estimated_study_hours;

ALTER TABLE public.user_skill_assessment
  ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT 'beginner'
    CHECK (experience_level IN ('beginner', 'recreational', 'intermediate', 'advanced'));

-- skill_check_history (deferred-reassessment stub, from the original
-- migration) is untouched — its league_before/league_after text columns are
-- schema-agnostic and now just carry experience_level strings instead.
