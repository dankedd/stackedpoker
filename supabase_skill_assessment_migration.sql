-- ============================================================
-- Stacked Poker — New-User Skill Assessment Schema
-- Additive migration: run after supabase_learning_schema.sql.
-- All new tables use CREATE TABLE IF NOT EXISTS.
-- Existing tables are extended with ADD COLUMN IF NOT EXISTS.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- EXTEND EXISTING TABLES
-- ──────────────────────────────────────────────────────────

-- profiles: cheap gate flag middleware can read in the same query it
-- already runs for subscription_tier on every /learn-prefixed request.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assessment_completed boolean NOT NULL DEFAULT false;


-- ──────────────────────────────────────────────────────────
-- 1. USER SKILL ASSESSMENT
--    One row per user — most recent onboarding assessment result.
--    Aggregate, not history (same relationship user_skill_progress has
--    to a hypothetical per-session XP log) — skill_check_history below
--    is the future landing spot for keeping every attempt.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_skill_assessment (
  user_id                 uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_version      integer     NOT NULL DEFAULT 1,

  -- Self-rating step (3 questions)
  self_experience         text        CHECK (self_experience IN (
                                        'never_played', 'friends_only', 'recreational_online',
                                        'regular_cash', 'studies_poker', 'advanced', 'professional'
                                      )),
  self_stakes             text        CHECK (self_stakes IN (
                                        'never_played', 'play_money', 'nl2', 'nl5', 'nl10',
                                        'nl25', 'nl50', 'nl100_plus', 'live_only'
                                      )),
  self_confidence         integer     CHECK (self_confidence BETWEEN 1 AND 10),

  -- Adaptive quiz outcome
  questions_answered      integer     NOT NULL DEFAULT 0,
  correct_count           integer     NOT NULL DEFAULT 0,
  assessment_score        integer     NOT NULL DEFAULT 0,   -- 0-100 accuracy readout
  final_challenge_offered boolean     NOT NULL DEFAULT false,
  final_challenge_passed  boolean,
  answer_trace            jsonb       NOT NULL DEFAULT '[]', -- [{question_id, difficulty, topic, correct}]

  -- Results
  estimated_league        text        NOT NULL DEFAULT 'foundation'
                                       CHECK (estimated_league IN ('foundation', 'intermediate', 'advanced', 'expert', 'master')),
  recommended_league      text        NOT NULL DEFAULT 'foundation'
                                       CHECK (recommended_league IN ('foundation', 'intermediate', 'advanced', 'expert', 'master')),
  chosen_start_league     text        NOT NULL DEFAULT 'foundation'
                                       CHECK (chosen_start_league IN ('foundation', 'intermediate', 'advanced', 'expert', 'master')),
  fast_track_taken        boolean     NOT NULL DEFAULT false,
  fast_track_passed       boolean,
  recommended_module_id   text,        -- matches a curriculum.ts module id; not FK'd (static TS data, not a DB table)
  strongest_topics        text[]      NOT NULL DEFAULT '{}',
  weakest_topics          text[]      NOT NULL DEFAULT '{}',
  estimated_study_hours   numeric(5,1),

  completed_at            timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_skill_assessment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skill_assessment_select_own" ON public.user_skill_assessment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_skill_assessment_insert_own" ON public.user_skill_assessment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_skill_assessment_update_own" ON public.user_skill_assessment
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 2. SKILL CHECK HISTORY — STUB, deferred reassessment phase
--    Not read or written anywhere except one row on initial-assessment
--    completion (check_type='initial_onboarding'), so the later "reassess
--    every ~40 lessons" feature has a real starting data point without a
--    future migration renaming things.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_check_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_type    text        NOT NULL DEFAULT 'initial_onboarding'
                             CHECK (check_type IN ('initial_onboarding', 'periodic_recheck')),
  league_before text,
  league_after  text,
  taken_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_check_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_check_history_select_own" ON public.skill_check_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "skill_check_history_insert_own" ON public.skill_check_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS skill_check_history_user_id_idx
  ON public.skill_check_history (user_id);
