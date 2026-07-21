-- ============================================================
-- Learn / Poker Journey — Persistence completion migration
-- Run in Supabase SQL editor AFTER supabase_learning_schema.sql
-- and supabase_achievements_schema.sql (both already applied).
--
-- Why: those two files were built assuming a DB-driven curriculum
-- (lessons.id uuid, concept_id FK'd to a small concept_nodes seed).
-- The real curriculum lives in frontend/lib/learn/curriculum.ts and
-- uses stable string slugs as IDs, plus concept tags that are a
-- superset of the concept_nodes seed. This migration retypes the
-- mismatched column, drops the now-invalid FK constraints, adds the
-- resume/bookkeeping columns needed for step-level persistence, and
-- adds the new per-step progress table. All statements are
-- IF EXISTS / IF NOT EXISTS — safe to run more than once.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. user_lesson_progress: lesson_id must hold curriculum.ts
--    string IDs (e.g. 'think-like-a-poker-player'), not lessons.id uuid.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.user_lesson_progress
  DROP CONSTRAINT IF EXISTS user_lesson_progress_lesson_id_fkey;

ALTER TABLE public.user_lesson_progress
  ALTER COLUMN lesson_id TYPE text USING lesson_id::text;

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS module_id             text,
  ADD COLUMN IF NOT EXISTS path_id               text,
  ADD COLUMN IF NOT EXISTS current_step_index    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_step_id       text,
  ADD COLUMN IF NOT EXISTS total_steps           integer,
  ADD COLUMN IF NOT EXISTS started_at            timestamptz,
  ADD COLUMN IF NOT EXISTS completion_xp_awarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now();

-- Reuse the generic set_updated_at() trigger fn defined in supabase_schema.sql
DROP TRIGGER IF EXISTS trg_user_lesson_progress_updated_at ON public.user_lesson_progress;
CREATE TRIGGER trg_user_lesson_progress_updated_at
  BEFORE UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS user_lesson_progress_updated_idx
  ON public.user_lesson_progress (user_id, updated_at DESC);


-- ──────────────────────────────────────────────────────────
-- 2. concept_id / lesson_id free-text tags no longer FK into
--    curriculum content tables (curriculum concept tags are a
--    superset of the concept_nodes seed — e.g. 'table_position',
--    'range_thinking', 'ip_advantage' are used but never seeded).
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.user_concept_mastery
  DROP CONSTRAINT IF EXISTS user_concept_mastery_concept_id_fkey;

ALTER TABLE public.user_leaks
  DROP CONSTRAINT IF EXISTS user_leaks_concept_id_fkey;


-- ──────────────────────────────────────────────────────────
-- 3. USER STEP PROGRESS
--    Per-step resume state + XP-award ledger (prevents duplicate
--    XP credit on refresh/replay of an already-completed step).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_step_progress (
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id          text        NOT NULL,
  step_id            text        NOT NULL,
  attempts           integer     NOT NULL DEFAULT 1,
  best_score         integer     NOT NULL DEFAULT 0,
  last_score         integer     NOT NULL DEFAULT 0,
  last_quality       text,
  xp_awarded         integer     NOT NULL DEFAULT 0,   -- credited once, on first completion only
  last_response      jsonb,
  concept_ids        text[]      DEFAULT '{}',
  first_completed_at timestamptz NOT NULL DEFAULT now(),
  last_attempted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id, step_id)
);

ALTER TABLE public.user_step_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_step_progress_select_own" ON public.user_step_progress;
DROP POLICY IF EXISTS "user_step_progress_insert_own" ON public.user_step_progress;
DROP POLICY IF EXISTS "user_step_progress_update_own" ON public.user_step_progress;

CREATE POLICY "user_step_progress_select_own" ON public.user_step_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_step_progress_insert_own" ON public.user_step_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_step_progress_update_own" ON public.user_step_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_step_progress_lesson_idx
  ON public.user_step_progress (user_id, lesson_id);


-- ──────────────────────────────────────────────────────────
-- 4. Note: learning_paths / learning_modules / lessons /
--    concept_nodes / concept_edges are intentionally left as-is
--    and unused — curriculum content stays static in
--    frontend/lib/learn/curriculum.ts. user_skill_progress.achievements
--    (text[]) is also left in place but superseded by the
--    user_achievements table as the canonical source going forward.
-- ──────────────────────────────────────────────────────────
