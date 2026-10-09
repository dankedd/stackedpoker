-- ============================================================
-- Preflop Trainer — XP per hand, with a streak bonus and a daily cap
-- Run in the Supabase SQL editor AFTER:
--   supabase_xp_leaderboard_schema.sql   (xp_events + increment_user_xp)
--   supabase_trainer_highscores.sql      (trainer_highscores)
-- Safe to run more than once.
--
-- RULES (the single source of truth — the backend and UI only display them):
--   correct  1 XP, +1 for every 10 hands of streak before this one, max 4 XP
--            (streak 0–9 → 1, 10–19 → 2, 20–29 → 3, 30+ → 4); streak +1
--   mixed    1 XP; streak +1 (a real part of the strategy, so it keeps the streak)
--   wrong    0 XP; streak back to 0
--   daily cap 300 XP per UTC day from the trainer — about one median lesson
--            (≈305 XP in ≈14 min), so the trainer adds to Learn without
--            out-earning it. After the cap, streaks and records still count.
--   too fast a hand under 1.5 s after the previous one changes nothing.
--
-- Grading happens in the backend (app/engines/preflop_trainer) against its
-- own copy of the charts; this function only applies the verdict. It is
-- callable by the service role only — never directly by a signed-in client.
-- ============================================================

-- 1. Let the XP ledger record trainer awards (feeds both leaderboards).
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_source_type_check CHECK (source_type IN (
  'step', 'lesson_completion', 'module_completion',
  'achievement', 'guest_merge', 'unknown', 'preflop_trainer'
));

-- 2. Server-side trainer state on the existing per-user trainer row.
ALTER TABLE public.trainer_highscores
  ADD COLUMN IF NOT EXISTS current_streak integer     NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  ADD COLUMN IF NOT EXISTS daily_xp       integer     NOT NULL DEFAULT 0 CHECK (daily_xp >= 0),
  ADD COLUMN IF NOT EXISTS daily_date     date,
  ADD COLUMN IF NOT EXISTS last_hand_at   timestamptz,
  ADD COLUMN IF NOT EXISTS hands_played   integer     NOT NULL DEFAULT 0;

-- 3. Apply one graded hand: streak, record, daily cap and XP in one locked step.
DROP FUNCTION IF EXISTS public.record_preflop_trainer_hand(uuid, text, text);
CREATE OR REPLACE FUNCTION public.record_preflop_trainer_hand(
  p_user_id  uuid,
  p_verdict  text,
  p_hand_ref text DEFAULT NULL
)
RETURNS TABLE(
  xp_awarded     integer,
  streak         integer,
  best_streak    integer,
  daily_xp       integer,
  daily_cap      integer,
  xp_per_correct integer,
  next_tier_at   integer,
  too_fast       boolean,
  total_xp       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_key     constant text     := 'preflop-ranges';
  c_cap     constant integer  := 300;
  c_min_gap constant interval := interval '1500 milliseconds';
  r         public.trainer_highscores%ROWTYPE;
  v_today   date := (now() AT TIME ZONE 'utc')::date;
  v_daily   integer;
  v_streak  integer;
  v_xp      integer := 0;
  v_total   integer;
BEGIN
  IF p_verdict NOT IN ('correct', 'mixed', 'wrong') THEN
    RAISE EXCEPTION 'invalid verdict %', p_verdict;
  END IF;

  INSERT INTO public.trainer_highscores (user_id, trainer_key)
  VALUES (p_user_id, c_key)
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  -- Row lock: two hands from the same user are applied one after the other.
  SELECT * INTO r FROM public.trainer_highscores h
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  FOR UPDATE;

  v_daily := CASE WHEN r.daily_date = v_today THEN r.daily_xp ELSE 0 END;

  IF r.last_hand_at IS NOT NULL AND now() - r.last_hand_at < c_min_gap THEN
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
    RETURN QUERY SELECT 0, r.current_streak, r.best_streak, v_daily, c_cap,
      1 + LEAST(r.current_streak / 10, 3),
      CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
      true, COALESCE(v_total, 0);
    RETURN;
  END IF;

  IF p_verdict = 'wrong' THEN
    v_streak := 0;
  ELSIF p_verdict = 'mixed' THEN
    v_xp := 1;
    v_streak := r.current_streak + 1;
  ELSE
    v_xp := 1 + LEAST(r.current_streak / 10, 3);
    v_streak := r.current_streak + 1;
  END IF;

  v_xp := GREATEST(0, LEAST(v_xp, c_cap - v_daily));

  UPDATE public.trainer_highscores h SET
    current_streak = v_streak,
    best_streak    = GREATEST(h.best_streak, v_streak),
    daily_xp       = v_daily + v_xp,
    daily_date     = v_today,
    last_hand_at   = now(),
    hands_played   = h.hands_played + 1,
    updated_at     = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  RETURNING * INTO r;

  IF v_xp > 0 THEN
    -- increment_user_xp UPDATEs user_skill_progress, so make sure the row exists
    -- for someone who has only ever used the trainer.
    INSERT INTO public.user_skill_progress (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT i.total_xp INTO v_total FROM public.increment_user_xp(p_user_id, v_xp, 'preflop_trainer', p_hand_ref) i;
  ELSE
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_xp, r.current_streak, r.best_streak, r.daily_xp, c_cap,
    1 + LEAST(r.current_streak / 10, 3),
    CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
    false, COALESCE(v_total, 0);
END;
$$;

-- 4. Current state, for the trainer page on load (same tier/cap rules, read-only).
DROP FUNCTION IF EXISTS public.preflop_trainer_state(uuid);
CREATE OR REPLACE FUNCTION public.preflop_trainer_state(p_user_id uuid)
RETURNS TABLE(
  streak         integer,
  best_streak    integer,
  daily_xp       integer,
  daily_cap      integer,
  xp_per_correct integer,
  next_tier_at   integer,
  hands_played   integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT h.current_streak, h.best_streak,
           CASE WHEN h.daily_date = (now() AT TIME ZONE 'utc')::date THEN h.daily_xp ELSE 0 END AS daily_xp,
           h.hands_played
    FROM public.trainer_highscores h
    WHERE h.user_id = p_user_id AND h.trainer_key = 'preflop-ranges'
    UNION ALL
    SELECT 0, 0, 0, 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trainer_highscores h
      WHERE h.user_id = p_user_id AND h.trainer_key = 'preflop-ranges'
    )
  )
  SELECT r.current_streak, r.best_streak, r.daily_xp, 300,
         1 + LEAST(r.current_streak / 10, 3),
         CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
         r.hands_played
  FROM r;
$$;

REVOKE ALL ON FUNCTION public.preflop_trainer_state(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preflop_trainer_state(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_preflop_trainer_hand(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_preflop_trainer_hand(uuid, text, text) TO service_role;

-- The streak/record now come from the server for signed-in users, so the
-- client must not be able to write records directly any more.
REVOKE EXECUTE ON FUNCTION public.record_trainer_streak(text, integer) FROM authenticated;
