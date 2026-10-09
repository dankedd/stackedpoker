-- ============================================================
-- Preflop range trainer — best streak per user
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- One row per (user, trainer). The record only ever goes UP: writes go
-- through record_trainer_streak(), which keeps GREATEST(old, new) in a single
-- statement, so two tabs finishing streaks at the same time can never lower
-- a record. Signed-out visitors keep their record in localStorage instead
-- (key `mpt-trainer-highscore`); the client merges both on sign-in.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trainer_highscores (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_key text        NOT NULL,
  best_streak integer     NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trainer_key)
);

ALTER TABLE public.trainer_highscores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_highscores_select_own" ON public.trainer_highscores;
CREATE POLICY "trainer_highscores_select_own"
  ON public.trainer_highscores FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies on purpose: the only write path is the function
-- below, which derives the user from auth.uid() and cannot lower a record.

CREATE OR REPLACE FUNCTION public.record_trainer_streak(p_trainer_key text, p_streak integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO trainer_highscores (user_id, trainer_key, best_streak, updated_at)
  VALUES (auth.uid(), p_trainer_key, GREATEST(p_streak, 0), now())
  ON CONFLICT (user_id, trainer_key) DO UPDATE
    SET best_streak = GREATEST(trainer_highscores.best_streak, EXCLUDED.best_streak),
        updated_at  = now()
  RETURNING best_streak;
$$;

REVOKE ALL ON FUNCTION public.record_trainer_streak(text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_trainer_streak(text, integer) TO authenticated;
