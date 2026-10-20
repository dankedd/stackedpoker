-- ============================================================
-- Flop Equity Trainer — answers, XP and session highscores (Phase 2)
-- Run in the Supabase SQL editor AFTER:
--   supabase_flop_equity.sql             (flop_spots, flop_equity)
--   supabase_xp_leaderboard_schema.sql   (xp_events + increment_user_xp)
--   supabase_preflop_trainer_xp.sql      (trainer_highscores trainer columns)
-- Safe to run more than once.
--
-- RULES (the backend grades, this applies):
--   equity guess   |guess - exact| <= 3  Perfect  2 XP
--                                  <= 7  Good     1 XP
--                                  >  7  Miss     0 XP
--   nut advantage  right answer          +1 XP
--   daily cap      300 XP per UTC day from this trainer (same as the
--                  preflop trainer's own cap).
--   too fast       an answer under 1.5 s after the previous one changes nothing.
--   session        10 flops; the session's points (= XP before the cap) are
--                  the highscore, kept per user in trainer_highscores.
--
-- Every answer is stored in flop_trainer_answers (also a Miss, which earns no
-- XP: xp_events.amount must be > 0). That table drives the adaptive flop
-- choice (weak texture categories come up more often) and, later, texture
-- tracking and "leak of the week".
-- ============================================================

-- 1. Let the XP ledger record flop trainer awards (feeds both leaderboards).
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_source_type_check CHECK (source_type IN (
  'step', 'lesson_completion', 'module_completion',
  'achievement', 'guest_merge', 'unknown', 'preflop_trainer', 'flop_equity'
));

-- 2. Session highscore on the existing per-user trainer row (trainer_key 'flop-equity').
ALTER TABLE public.trainer_highscores
  ADD COLUMN IF NOT EXISTS session_id          text,
  ADD COLUMN IF NOT EXISTS session_answers     integer NOT NULL DEFAULT 0 CHECK (session_answers >= 0),
  ADD COLUMN IF NOT EXISTS session_points      integer NOT NULL DEFAULT 0 CHECK (session_points >= 0),
  ADD COLUMN IF NOT EXISTS best_session_points integer NOT NULL DEFAULT 0 CHECK (best_session_points >= 0);

-- 3. Every answer.
CREATE TABLE IF NOT EXISTS public.flop_trainer_answers (
  id             bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id        text         NOT NULL,
  flop           text         NOT NULL,
  category       text         NOT NULL,              -- texture category, e.g. 'paired', 'ace_high'
  guess_equity   numeric(5,2) NOT NULL CHECK (guess_equity BETWEEN 0 AND 100),
  actual_equity  numeric(5,2) NOT NULL,
  abs_error      numeric(5,2) NOT NULL,
  verdict        text         NOT NULL CHECK (verdict IN ('perfect', 'good', 'miss')),
  nut_guess      text         NOT NULL CHECK (nut_guess IN ('IP', 'OOP', 'EQUAL')),
  nut_actual     text         NOT NULL CHECK (nut_actual IN ('IP', 'OOP', 'EQUAL')),
  points         smallint     NOT NULL,
  xp_awarded     smallint     NOT NULL,
  session_id     text,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flop_trainer_answers_user_idx ON public.flop_trainer_answers (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flop_trainer_answers_created_idx ON public.flop_trainer_answers (created_at);

ALTER TABLE public.flop_trainer_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flop_trainer_answers_select_own" ON public.flop_trainer_answers;
CREATE POLICY "flop_trainer_answers_select_own" ON public.flop_trainer_answers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No write policies: the only write path is record_flop_trainer_answer (service role).

-- 4. Apply one graded answer: cap, session, highscore, XP — one locked step.
DROP FUNCTION IF EXISTS public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text);
CREATE OR REPLACE FUNCTION public.record_flop_trainer_answer(
  p_user_id    uuid,
  p_spot_id    text,
  p_flop       text,
  p_category   text,
  p_guess      numeric,
  p_actual     numeric,
  p_verdict    text,
  p_nut_guess  text,
  p_nut_actual text,
  p_points     integer,
  p_session_id text
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
  IF p_points < 0 OR p_points > 3 THEN
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

  -- A new session id starts a new 10-flop session.
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
    -- A finished session is closed; the next answer with this id starts over.
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
    nut_guess, nut_actual, points, xp_awarded, session_id
  ) VALUES (
    p_user_id, p_spot_id, p_flop, p_category, p_guess, p_actual, round(abs(p_guess - p_actual), 2), p_verdict,
    p_nut_guess, p_nut_actual, p_points, v_xp, p_session_id
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

-- 5. State for the page on load: today's XP, best session, and the average
--    error per texture category over the last 200 answers (adaptive choice).
DROP FUNCTION IF EXISTS public.flop_trainer_state(uuid);
CREATE OR REPLACE FUNCTION public.flop_trainer_state(p_user_id uuid)
RETURNS TABLE(
  daily_xp            integer,
  daily_cap           integer,
  best_session_points integer,
  hands_played        integer,
  categories          jsonb
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
  recent AS (
    SELECT a.category, a.abs_error
    FROM public.flop_trainer_answers a
    WHERE a.user_id = p_user_id
    ORDER BY a.created_at DESC
    LIMIT 200
  ),
  cats AS (
    SELECT COALESCE(jsonb_object_agg(category, jsonb_build_array(n, avg_error)), '{}'::jsonb) AS categories
    FROM (SELECT category, count(*) AS n, round(avg(abs_error), 2) AS avg_error FROM recent GROUP BY category) x
  )
  SELECT COALESCE((SELECT daily_xp FROM h), 0), 300,
         COALESCE((SELECT best_session_points FROM h), 0),
         COALESCE((SELECT hands_played FROM h), 0),
         (SELECT categories FROM cats);
$$;

REVOKE ALL ON FUNCTION public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_flop_trainer_answer(uuid, text, text, text, numeric, numeric, text, text, text, integer, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.flop_trainer_state(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flop_trainer_state(uuid) TO service_role;
