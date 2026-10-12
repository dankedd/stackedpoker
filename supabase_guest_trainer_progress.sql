-- ============================================================
-- Preflop Trainer — move a guest's progress into the account
-- Run in the Supabase SQL editor AFTER supabase_preflop_trainer_xp.sql.
-- Safe to run more than once.
--
-- Signed-out visitors keep their trainer progress in localStorage
-- (sp_guest_progress, frontend/lib/ranges/guestProgress.ts). On the first
-- page after sign-up or log-in the client sends it here once:
--   hands_played  += the guest's hands
--   best_streak    = GREATEST(old, guest best)   (never lowered)
--   guest_progress = the raw guest snapshot, incl. right/wrong per spot
-- No XP is awarded: guest hands were never graded by the server, and XP only
-- ever comes from server-graded hands (record_preflop_trainer_hand).
--
-- The numbers come from the browser, so they are clamped: at most 1000 hands
-- per merge, and a best streak can never exceed the hands played. This is the
-- same trust level as record_trainer_streak(), and these columns feed no
-- public leaderboard.
-- ============================================================

ALTER TABLE public.trainer_highscores
  ADD COLUMN IF NOT EXISTS guest_progress  jsonb,
  ADD COLUMN IF NOT EXISTS guest_merged_at timestamptz;

CREATE OR REPLACE FUNCTION public.merge_guest_trainer_progress(p_progress jsonb)
RETURNS TABLE (hands_played integer, best_streak integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_key   constant text := 'preflop-ranges';
  v_uid   uuid := auth.uid();
  v_hands integer;
  v_best  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF jsonb_typeof(p_progress) <> 'object' OR pg_column_size(p_progress) > 32768 THEN
    RAISE EXCEPTION 'invalid guest progress';
  END IF;

  v_hands := LEAST(GREATEST(COALESCE((p_progress ->> 'hands_played')::integer, 0), 0), 1000);
  v_best  := LEAST(GREATEST(COALESCE((p_progress ->> 'best_streak')::integer, 0), 0), v_hands);

  INSERT INTO public.trainer_highscores (user_id, trainer_key)
  VALUES (v_uid, c_key)
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  RETURN QUERY
  UPDATE public.trainer_highscores h SET
    hands_played    = h.hands_played + v_hands,
    best_streak     = GREATEST(h.best_streak, v_best),
    guest_progress  = p_progress,
    guest_merged_at = now(),
    updated_at      = now()
  WHERE h.user_id = v_uid AND h.trainer_key = c_key
  RETURNING h.hands_played, h.best_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_guest_trainer_progress(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_guest_trainer_progress(jsonb) TO authenticated;
