-- ============================================================
-- Stacked Poker — Learning System Schema
-- Additive migration: run after supabase_schema.sql
-- All new tables use CREATE TABLE IF NOT EXISTS.
-- Existing tables are extended with ADD COLUMN IF NOT EXISTS.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- EXTEND EXISTING TABLES
-- ──────────────────────────────────────────────────────────

-- hand_analyses: tag which concepts were violated and what lesson to recommend
ALTER TABLE public.hand_analyses
  ADD COLUMN IF NOT EXISTS leaked_concepts    text[],
  ADD COLUMN IF NOT EXISTS lesson_recommended text;

-- profiles: track XP and level earned through the learning system
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_xp    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_level integer NOT NULL DEFAULT 1;


-- ──────────────────────────────────────────────────────────
-- 1. LEARNING PATHS
--    Static curriculum entries — public read, no RLS needed.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id            text        PRIMARY KEY,
  title         text        NOT NULL,
  description   text,
  tier_required text        NOT NULL DEFAULT 'free',
  sort_order    integer     NOT NULL DEFAULT 0
);

-- No RLS: this is static reference data, readable by everyone.


-- ──────────────────────────────────────────────────────────
-- 2. LEARNING MODULES
--    Groups of lessons within a path.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_modules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id      text        NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  slug         text        UNIQUE NOT NULL,
  title        text        NOT NULL,
  description  text,
  concept_ids  text[]      DEFAULT '{}',
  unlock_after text[]      DEFAULT '{}',   -- slugs of modules that must be completed first
  sort_order   integer     NOT NULL DEFAULT 0,
  xp_reward    integer     NOT NULL DEFAULT 100
);

-- No RLS: curriculum data is public reference content.


-- ──────────────────────────────────────────────────────────
-- 3. LESSONS
--    Individual interactive steps within a module.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lessons (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid        NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  slug          text        UNIQUE NOT NULL,
  title         text        NOT NULL,
  lesson_type   text        NOT NULL CHECK (lesson_type IN (
                              'micro',
                              'range_trainer',
                              'puzzle_drill',
                              'concept_reveal',
                              'simulation'
                            )),
  concept_ids   text[]      DEFAULT '{}',
  steps         jsonb       NOT NULL DEFAULT '[]',
  estimated_min integer     NOT NULL DEFAULT 3,
  xp_reward     integer     NOT NULL DEFAULT 50,
  sort_order    integer     NOT NULL DEFAULT 0
);

-- No RLS: lesson definitions are public reference content.


-- ──────────────────────────────────────────────────────────
-- 4. CONCEPT NODES
--    Vertices in the poker knowledge graph — public read.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.concept_nodes (
  id           text        PRIMARY KEY,
  title        text        NOT NULL,
  domain       text,                        -- e.g. 'preflop', 'postflop', 'mental_game'
  difficulty   text,                        -- e.g. 'beginner', 'intermediate', 'advanced'
  summary      text,
  full_content jsonb,
  formula      text,
  visual_type  text,                        -- e.g. 'range_grid', 'equity_chart', 'decision_tree'
  tags         text[]      DEFAULT '{}'
);

-- No RLS: concept definitions are public reference content.


-- ──────────────────────────────────────────────────────────
-- 5. CONCEPT EDGES
--    Directed edges in the poker knowledge graph — public read.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.concept_edges (
  from_concept text        NOT NULL REFERENCES public.concept_nodes(id) ON DELETE CASCADE,
  to_concept   text        NOT NULL REFERENCES public.concept_nodes(id) ON DELETE CASCADE,
  edge_type    text        NOT NULL CHECK (edge_type IN (
                              'prerequisite',
                              'related',
                              'applies_to',
                              'opposite'
                            )),
  weight       float       NOT NULL DEFAULT 1.0,
  PRIMARY KEY (from_concept, to_concept, edge_type)
);

-- No RLS: graph structure is public reference content.


-- ──────────────────────────────────────────────────────────
-- 6. USER LESSON PROGRESS
--    Tracks per-user completion state for every lesson.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id       uuid        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'locked'
                              CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  attempts        integer     NOT NULL DEFAULT 0,
  best_score      integer     NOT NULL DEFAULT 0,
  last_score      integer     NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  time_spent_sec  integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_lesson_progress_select_own" ON public.user_lesson_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_lesson_progress_insert_own" ON public.user_lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_lesson_progress_update_own" ON public.user_lesson_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_lesson_progress_user_id_idx
  ON public.user_lesson_progress (user_id);


-- ──────────────────────────────────────────────────────────
-- 7. USER CONCEPT MASTERY
--    SRS (spaced repetition) state per user per concept.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_concept_mastery (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id      text        NOT NULL REFERENCES public.concept_nodes(id) ON DELETE CASCADE,
  mastery_level   integer     NOT NULL DEFAULT 0,      -- 0–5 scale
  exposures       integer     NOT NULL DEFAULT 0,
  correct_streak  integer     NOT NULL DEFAULT 0,
  last_tested     timestamptz,
  ease_factor     float       NOT NULL DEFAULT 2.5,    -- SM-2 ease factor
  interval_days   float       NOT NULL DEFAULT 1.0,    -- days until next review
  next_review     timestamptz,
  PRIMARY KEY (user_id, concept_id)
);

ALTER TABLE public.user_concept_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_concept_mastery_select_own" ON public.user_concept_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_concept_mastery_insert_own" ON public.user_concept_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_concept_mastery_update_own" ON public.user_concept_mastery
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_concept_mastery_user_id_idx
  ON public.user_concept_mastery (user_id);


-- ──────────────────────────────────────────────────────────
-- 8. USER SKILL PROGRESS
--    One row per user — aggregate XP, level, streak, etc.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_skill_progress (
  user_id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp        integer     NOT NULL DEFAULT 0,
  level           integer     NOT NULL DEFAULT 1,
  streak_days     integer     NOT NULL DEFAULT 0,
  last_active     date,
  unlocked_paths  text[]      NOT NULL DEFAULT '{beginner}',
  achievements    text[]      NOT NULL DEFAULT '{}'
);

ALTER TABLE public.user_skill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_skill_progress_select_own" ON public.user_skill_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_skill_progress_insert_own" ON public.user_skill_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_skill_progress_update_own" ON public.user_skill_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 9. USER LEAKS
--    Detected conceptual leaks from hand analysis and drills.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_leaks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id     text        NOT NULL REFERENCES public.concept_nodes(id) ON DELETE CASCADE,
  node_type      text,                        -- e.g. 'spot', 'concept', 'range'
  leak_type      text,                        -- e.g. 'over_fold', 'over_call', 'bad_sizing'
  severity       text        NOT NULL DEFAULT 'mild'
                             CHECK (severity IN ('mild', 'moderate', 'severe')),
  evidence_count integer     NOT NULL DEFAULT 1,
  last_seen      timestamptz NOT NULL DEFAULT now(),
  resolved       boolean     NOT NULL DEFAULT false
);

ALTER TABLE public.user_leaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_leaks_select_own" ON public.user_leaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_leaks_insert_own" ON public.user_leaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_leaks_update_own" ON public.user_leaks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Partial index: fast lookup of active (unresolved) leaks per user
CREATE INDEX IF NOT EXISTS user_leaks_active_idx
  ON public.user_leaks (user_id, resolved)
  WHERE resolved = false;


-- ──────────────────────────────────────────────────────────
-- 10. TRAINING SESSIONS
--     Stores conversational or drill sessions with the AI coach.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type text,                          -- e.g. 'chat', 'drill', 'range_trainer'
  context      jsonb       NOT NULL DEFAULT '{}',
  messages     jsonb       NOT NULL DEFAULT '[]',
  started_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_sessions_select_own" ON public.training_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "training_sessions_insert_own" ON public.training_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "training_sessions_update_own" ON public.training_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS training_sessions_user_updated_idx
  ON public.training_sessions (user_id, updated_at DESC);
