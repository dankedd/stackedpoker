-- ============================================================
-- Learn / Poker Journey — Module completion XP
-- Run in Supabase SQL editor AFTER supabase_learning_persistence_migration.sql
-- has already been applied. Safe to run more than once (IF NOT EXISTS).
--
-- Why: module.xp_reward (frontend/lib/learn/curriculum.ts) was, until now,
-- only ever displayed as a teaser label — no completion bonus was ever
-- awarded when a user finished every lesson in a module. This adds the
-- durable, idempotent record of "this user has been awarded this module's
-- completion bonus" that backend/app/api/routes/learn.py's
-- POST /learn/modules/{module_id}/complete relies on.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_module_progress (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id    text        NOT NULL,
  path_id      text,
  xp_awarded   integer     NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id)
);

ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_module_progress_select_own" ON public.user_module_progress;
DROP POLICY IF EXISTS "user_module_progress_insert_own" ON public.user_module_progress;
DROP POLICY IF EXISTS "user_module_progress_update_own" ON public.user_module_progress;

CREATE POLICY "user_module_progress_select_own" ON public.user_module_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_module_progress_insert_own" ON public.user_module_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_module_progress_update_own" ON public.user_module_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_module_progress_user_idx
  ON public.user_module_progress (user_id);
