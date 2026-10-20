-- ============================================================
-- Flop Equity Trainer — Phase 3: c-bet question, quick fire (A vs B),
-- texture tracking. Run in the Supabase SQL editor AFTER
-- supabase_flop_trainer.sql. Safe to run more than once.
--
--   c-bet question  optional with every flop: frequency band (high/mid/low)
--                   and size (small/big), graded by the backend from the
--                   book's profiles (data/mpt/cbet_profiles.json). +1 point
--                   each, so a flop is now worth up to 5 points.
--   quick fire      two flops, "which is better for the raiser?": 1 XP when
--                   right; a streak per user (trainer_key 'flop-versus').
--                   Shares the flop trainer's 300 XP/day cap.
--   tracking        flop_trainer_state also returns the hit rate (within 7
--                   points) per texture category.
-- The Pro explorer needs no SQL: the backend checks effective_plan().
-- ============================================================

-- 1. C-bet answers on the existing answer log.
ALTER TABLE public.flop_trainer_answers
  ADD COLUMN IF NOT EXISTS cbet_band_guess text CHECK (cbet_band_guess IN ('high', 'mid', 'low')),
  ADD COLUMN IF NOT EXISTS cbet_size_guess text CHECK (cbet_size_guess IN ('small', 'big')),
  ADD COLUMN IF NOT EXISTS cbet_band_ok    boolean,
  ADD COLUMN IF NOT EXISTS cbet_size_ok    boolean;

-- 2. Record one answer — now with the optional c-bet part (points 0-5).
DROP FUNCTION IF EXISTS public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text);
DROP FUNCTION IF EXISTS public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text, text, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.record_flop_trainer_answer(
  p_user_id      uuid,
  p_spot_id      text,
  p_flop         text,
  p_category     text,
  p_guess        numeric,
  p_actual       numeric,
  p_verdict      text,
  p_nut_guess    text,
  p_nut_actual   text,
  p_points       integer,
  p_session_id   text,
  p_cbet_band    text    DEFAULT NULL,
  p_cbet_size    text    DEFAULT NULL,
  p_cbet_band_ok boolean DEFAULT NULL,
  p_cbet_size_ok boolean DEFAULT NULL
)
RETURNS TABLE(
  xp_awarded          integer,
  daily_xp            integer,
  daily_cap           integer,
  too_fast            boolean,
  total_xp            integer,
  session_answers     integer,
  session_points      integer,
  session_complete    boolean,
  best_session_points integer,
  new_record          boolean,
  hands_played        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_key     constant text     := 'flop-equity';
  c_cap     constant integer  := 300;
  c_session constant integer  := 10;
  c_min_gap constant interval := interval '1500 milliseconds';
  r         public.trainer_highscores%ROWTYPE;
  v_today   date := (now() AT TIME ZONE 'utc')::date;
  v_daily   integer;
  v_xp      integer;
  v_total   integer;
  v_answers integer;
  v_points  integer;
  v_done    boolean := false;
  v_best    integer;
  v_record  boolean := false;
BEGIN
  IF p_verdict NOT IN ('perfect', 'good', 'miss') THEN
    RAISE EXCEPTION 'invalid verdict %', p_verdict;
  END IF;
  IF p_points < 0 OR p_points > 5 THEN
    RAISE EXCEPTION 'invalid points %', p_points;
  END IF;

  INSERT INTO public.trainer_highscores (user_id, trainer_key)
  VALUES (p_user_id, c_key)
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  SELECT * INTO r FROM public.trainer_highscores h
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  FOR UPDATE;

  v_daily := CASE WHEN r.daily_date = v_today THEN r.daily_xp ELSE 0 END;

  IF r.last_hand_at IS NOT NULL AND now() - r.last_hand_at < c_min_gap THEN
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
    RETURN QUERY SELECT 0, v_daily, c_cap, true, COALESCE(v_total, 0),
      r.session_answers, r.session_points, false, r.best_session_points, false, r.hands_played;
    RETURN;
  END IF;

  v_xp := GREATEST(0, LEAST(p_points, c_cap - v_daily));

  IF r.session_id IS DISTINCT FROM p_session_id THEN
    v_answers := 1;
    v_points  := p_points;
  ELSE
    v_answers := r.session_answers + 1;
    v_points  := r.session_points + p_points;
  END IF;
  v_best := r.best_session_points;
  IF v_answers >= c_session THEN
    v_done   := true;
    v_record := v_points > r.best_session_points;
    v_best   := GREATEST(r.best_session_points, v_points);
  END IF;

  UPDATE public.trainer_highscores h SET
    session_id          = p_session_id,
    session_answers     = CASE WHEN v_done THEN 0 ELSE v_answers END,
    session_points      = CASE WHEN v_done THEN 0 ELSE v_points END,
    best_session_points = v_best,
    daily_xp            = v_daily + v_xp,
    daily_date          = v_today,
    last_hand_at        = now(),
    hands_played        = h.hands_played + 1,
    updated_at          = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  RETURNING * INTO r;

  INSERT INTO public.flop_trainer_answers (
    user_id, spot_id, flop, category, guess_equity, actual_equity, abs_error, verdict,
    nut_guess, nut_actual, points, xp_awarded, session_id,
    cbet_band_guess, cbet_size_guess, cbet_band_ok, cbet_size_ok
  ) VALUES (
    p_user_id, p_spot_id, p_flop, p_category, p_guess, p_actual, round(abs(p_guess - p_actual), 2), p_verdict,
    p_nut_guess, p_nut_actual, p_points, v_xp, p_session_id,
    p_cbet_band, p_cbet_size, p_cbet_band_ok, p_cbet_size_ok
  );

  IF v_xp > 0 THEN
    INSERT INTO public.user_skill_progress (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT i.total_xp INTO v_total
    FROM public.increment_user_xp(p_user_id, v_xp, 'flop_equity', p_spot_id || ':' || p_flop) i;
  ELSE
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_xp, r.daily_xp, c_cap, false, COALESCE(v_total, 0),
    v_answers, v_points, v_done, v_best, v_record, r.hands_played;
END;
$$;

-- 3. Quick fire: every pick.
CREATE TABLE IF NOT EXISTS public.flop_versus_answers (
  id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id     text         NOT NULL,
  flop_a      text         NOT NULL,
  flop_b      text         NOT NULL,
  pick        text         NOT NULL CHECK (pick IN ('a', 'b')),
  correct     boolean      NOT NULL,
  equity_gap  numeric(5,2) NOT NULL,
  xp_awarded  smallint     NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flop_versus_answers_user_idx ON public.flop_versus_answers (user_id, created_at DESC);

ALTER TABLE public.flop_versus_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flop_versus_answers_select_own" ON public.flop_versus_answers;
CREATE POLICY "flop_versus_answers_select_own" ON public.flop_versus_answers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.record_flop_versus_answer(uuid, text, text, text, text, boolean, numeric);
CREATE OR REPLACE FUNCTION public.record_flop_versus_answer(
  p_user_id uuid,
  p_spot_id text,
  p_flop_a  text,
  p_flop_b  text,
  p_pick    text,
  p_correct boolean,
  p_gap     numeric
)
RETURNS TABLE(
  xp_awarded  integer,
  daily_xp    integer,
  daily_cap   integer,
  too_fast    boolean,
  total_xp    integer,
  streak      integer,
  best_streak integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cap     constant integer  := 300;  -- shared with the flop equity questions
  c_min_gap constant interval := interval '800 milliseconds';
  e         public.trainer_highscores%ROWTYPE;  -- 'flop-equity': daily XP
  v         public.trainer_highscores%ROWTYPE;  -- 'flop-versus': streak
  v_today   date := (now() AT TIME ZONE 'utc')::date;
  v_daily   integer;
  v_xp      integer;
  v_total   integer;
BEGIN
  IF p_pick NOT IN ('a', 'b') THEN
    RAISE EXCEPTION 'invalid pick %', p_pick;
  END IF;

  INSERT INTO public.trainer_highscores (user_id, trainer_key) VALUES (p_user_id, 'flop-equity'), (p_user_id, 'flop-versus')
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  -- Fixed lock order (equity row, then versus row) so this never deadlocks
  -- with record_flop_trainer_answer, which locks only the equity row.
  SELECT * INTO e FROM public.trainer_highscores h WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-equity' FOR UPDATE;
  SELECT * INTO v FROM public.trainer_highscores h WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-versus' FOR UPDATE;

  v_daily := CASE WHEN e.daily_date = v_today THEN e.daily_xp ELSE 0 END;

  IF v.last_hand_at IS NOT NULL AND now() - v.last_hand_at < c_min_gap THEN
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
    RETURN QUERY SELECT 0, v_daily, c_cap, true, COALESCE(v_total, 0), v.current_streak, v.best_streak;
    RETURN;
  END IF;

  v_xp := CASE WHEN p_correct THEN GREATEST(0, LEAST(1, c_cap - v_daily)) ELSE 0 END;

  UPDATE public.trainer_highscores h SET
    daily_xp = v_daily + v_xp, daily_date = v_today, updated_at = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-equity';

  UPDATE public.trainer_highscores h SET
    current_streak = CASE WHEN p_correct THEN h.current_streak + 1 ELSE 0 END,
    best_streak    = GREATEST(h.best_streak, CASE WHEN p_correct THEN h.current_streak + 1 ELSE 0 END),
    last_hand_at   = now(),
    hands_played   = h.hands_played + 1,
    updated_at     = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-versus'
  RETURNING * INTO v;

  INSERT INTO public.flop_versus_answers (user_id, spot_id, flop_a, flop_b, pick, correct, equity_gap, xp_awarded)
  VALUES (p_user_id, p_spot_id, p_flop_a, p_flop_b, p_pick, p_correct, p_gap, v_xp);

  IF v_xp > 0 THEN
    INSERT INTO public.user_skill_progress (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT i.total_xp INTO v_total
    FROM public.increment_user_xp(p_user_id, v_xp, 'flop_equity', 'versus:' || p_spot_id || ':' || p_flop_a || ':' || p_flop_b) i;
  ELSE
    SELECT s.total_xp INTO v_total FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_xp, v_daily + v_xp, c_cap, false, COALESCE(v_total, 0), v.current_streak, v.best_streak;
END;
$$;

-- 4. State: per category [answers, average error, hit rate % within 7 points],
--    plus the quick-fire streak.
DROP FUNCTION IF EXISTS public.flop_trainer_state(uuid);
CREATE OR REPLACE FUNCTION public.flop_trainer_state(p_user_id uuid)
RETURNS TABLE(
  daily_xp            integer,
  daily_cap           integer,
  best_session_points integer,
  hands_played        integer,
  categories          jsonb,
  versus_streak       integer,
  versus_best         integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH h AS (
    SELECT CASE WHEN t.daily_date = (now() AT TIME ZONE 'utc')::date THEN t.daily_xp ELSE 0 END AS daily_xp,
           t.best_session_points, t.hands_played
    FROM public.trainer_highscores t
    WHERE t.user_id = p_user_id AND t.trainer_key = 'flop-equity'
  ),
  v AS (
    SELECT t.current_streak, t.best_streak
    FROM public.trainer_highscores t
    WHERE t.user_id = p_user_id AND t.trainer_key = 'flop-versus'
  ),
  recent AS (
    SELECT a.category, a.abs_error
    FROM public.flop_trainer_answers a
    WHERE a.user_id = p_user_id
    ORDER BY a.created_at DESC
    LIMIT 200
  ),
  cats AS (
    SELECT COALESCE(jsonb_object_agg(category, jsonb_build_array(n, avg_error, hit_pct)), '{}'::jsonb) AS categories
    FROM (
      SELECT category, count(*) AS n, round(avg(abs_error), 2) AS avg_error,
             round(100.0 * count(*) FILTER (WHERE abs_error <= 7) / count(*), 1) AS hit_pct
      FROM recent GROUP BY category
    ) x
  )
  SELECT COALESCE((SELECT daily_xp FROM h), 0), 300,
         COALESCE((SELECT best_session_points FROM h), 0),
         COALESCE((SELECT hands_played FROM h), 0),
         (SELECT categories FROM cats),
         COALESCE((SELECT current_streak FROM v), 0),
         COALESCE((SELECT best_streak FROM v), 0);
$$;

REVOKE ALL ON FUNCTION public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text, text, text, boolean, boolean)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text, text, text, boolean, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.record_flop_versus_answer(uuid, text, text, text, text, boolean, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_flop_versus_answer(uuid, text, text, text, text, boolean, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.flop_trainer_state(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flop_trainer_state(uuid) TO service_role;
