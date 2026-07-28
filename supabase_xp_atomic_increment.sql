-- ============================================================
-- Learn / Poker Journey — Atomic XP increment
-- Run in Supabase SQL editor AFTER supabase_learning_schema.sql
-- has already been applied. Safe to run more than once
-- (CREATE OR REPLACE FUNCTION).
--
-- Why: backend/app/api/routes/learn.py previously updated
-- user_skill_progress.total_xp with a read-current-value-then-PATCH
-- round trip (GET total_xp, compute new value in Python, PATCH it back).
-- Two XP-awarding requests for the same user arriving concurrently (e.g. a
-- step-completion save racing a lesson-completion save) could both read the
-- same starting value and one write would silently clobber the other's
-- delta — a classic lost-update race. This RPC makes the increment itself
-- a single atomic SQL statement (`total_xp = total_xp + delta`), so
-- Postgres's own row-level locking guarantees no delta is ever lost no
-- matter how many concurrent awards land for the same user. Mirrors the
-- existing `increment_analyses_used` pattern in supabase_schema.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_user_xp(p_user_id uuid, p_xp_delta integer)
RETURNS TABLE(total_xp integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_skill_progress
  SET total_xp = user_skill_progress.total_xp + p_xp_delta
  WHERE user_id = p_user_id
  RETURNING user_skill_progress.total_xp;
$$;
