-- ============================================================
-- XP rebalance (2026-10): Learn XP off, levels around the trainers
-- Run in the Supabase SQL editor AFTER:
--   supabase_xp_leaderboard_schema.sql   (xp_events + increment_user_xp)
--   supabase_preflop_trainer_xp.sql, supabase_flop_trainer.sql,
--   supabase_flop_trainer_phase3.sql      (the trainer RPCs replaced below)
--   supabase_display_name.sql             (the 24h leaderboards replaced below)
--   supabase_retention.sql                (activity_streak: the day streak users see)
--   supabase_subscriptions.sql            (amsterdam_day: the day for the daily XP cap)
--   supabase_xp_levels_data.sql           (GENERATED level table + XP rules)
-- Safe to run more than once: backups and the rebalance log keep their FIRST
-- contents, voiding and the recompute are idempotent.
-- Dry run first: supabase/queries/xp_rebalance_report.sql (read-only).
--
-- What it does
--   1. Full copies: xp_events_backup_2026_10, user_skill_progress_backup_2026_10.
--   2. Learn XP is marked, never deleted: voided_at + void_reason = 'learn_offline'
--      on 'step', 'lesson_completion', 'module_completion', 'guest_merge' (the
--      Learn guest merge in learn.py — the trainer guest merge never awards XP)
--      and every 'achievement' (all 18 catalog achievements are Learn ones: the
--      streak ones count Learn's streak_days, the level ones were reached with
--      Learn XP), and 'unknown' (one admin account on 2026-07-29, Learn
--      step/lesson awards logged before source types existed; approved).
--      Afterwards only trainer XP remains.
--      Undo: UPDATE xp_events SET voided_at = NULL, void_reason = NULL
--            WHERE void_reason = 'learn_offline';  then re-run section 6.
--   3. total_xp := sum of the user's non-voided xp_events. XP that never had a
--      ledger row (Learn lesson bonuses from before the ledger existed) is
--      dropped with it; the backup keeps the old totals.
--   4. level / level_seen := the new level, so nobody gets a level-up or
--      level-down moment from the recompute. levels_notice_pending marks who
--      sees the one-time "we've rebalanced levels" note.
--   5. XP from now on: one daily trainer cap for both trainers together, a
--      day-streak bonus and a daily hand-review bonus (grant_trainer_xp,
--      values in xp_rules = shared/levels.json). Learn and achievements award
--      no XP while Learn is offline.
--   6. Invariant: total_xp = sum of non-voided xp_events, for every user
--      (xp_ledger_drift() lists violations; supabase/tests/xp_rebalance.test.sql).
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.xp_levels') IS NULL OR NOT EXISTS (SELECT 1 FROM public.xp_rules WHERE key = 'daily_cap') THEN
    RAISE EXCEPTION 'run supabase_xp_levels_data.sql first';
  END IF;
  IF to_regprocedure('public.activity_streak(uuid, timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'run supabase_retention.sql first';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 1. Backups (first run only — a re-run never overwrites them).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_events_backup_2026_10 AS TABLE public.xp_events;
CREATE TABLE IF NOT EXISTS public.user_skill_progress_backup_2026_10 AS TABLE public.user_skill_progress;
-- Not readable through the API.
ALTER TABLE public.xp_events_backup_2026_10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_progress_backup_2026_10 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_events_backup_2026_10, public.user_skill_progress_backup_2026_10 FROM anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 2. Schema
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.xp_events
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_source_type_check CHECK (source_type IN (
  'step', 'lesson_completion', 'module_completion',
  'achievement', 'guest_merge', 'unknown', 'preflop_trainer', 'flop_equity',
  'streak_bonus', 'hand_review'
));

CREATE INDEX IF NOT EXISTS xp_events_user_live_idx ON public.xp_events (user_id) WHERE voided_at IS NULL;

ALTER TABLE public.user_skill_progress
  ADD COLUMN IF NOT EXISTS level                      integer NOT NULL DEFAULT 1,
  -- Highest level the user has been shown; a level-up moment only above it.
  ADD COLUMN IF NOT EXISTS level_seen                 integer,
  ADD COLUMN IF NOT EXISTS levels_notice_pending      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS levels_notice_dismissed_at timestamptz;

-- XP per user per day (xp_day(): Amsterdam): the shared trainer cap and the bonuses.
CREATE TABLE IF NOT EXISTS public.xp_daily (
  user_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day            date    NOT NULL,
  trainer_xp     integer NOT NULL DEFAULT 0 CHECK (trainer_xp >= 0),
  bonus_xp       integer NOT NULL DEFAULT 0 CHECK (bonus_xp >= 0),
  -- Streak bonus remainder in 1/100 XP, so +10% also adds up on 1-XP answers.
  bonus_carry    integer NOT NULL DEFAULT 0,
  -- The day streak (activity_streak) at the first trainer XP of the day.
  streak_days    integer,
  hand_review_at timestamptz,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.xp_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_daily_select_own" ON public.xp_daily;
CREATE POLICY "xp_daily_select_own" ON public.xp_daily FOR SELECT USING (auth.uid() = user_id);
-- No write policies: grant_trainer_xp / the hand-review trigger only.

-- What the recompute changed, per user (first run only).
CREATE TABLE IF NOT EXISTS public.xp_rebalance_2026_10 (
  user_id        uuid PRIMARY KEY,
  old_total_xp   integer NOT NULL,
  old_level      integer NOT NULL,
  new_total_xp   integer NOT NULL,
  new_level      integer NOT NULL,
  rebalanced_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_rebalance_2026_10 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_rebalance_2026_10 FROM anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 3. Close every XP path outside the ledger functions.
-- ──────────────────────────────────────────────────────────
-- Clients could UPDATE their own total_xp straight through the API.
DROP POLICY IF EXISTS "user_skill_progress_insert_own" ON public.user_skill_progress;
DROP POLICY IF EXISTS "user_skill_progress_update_own" ON public.user_skill_progress;

-- Fired level achievements (Learn XP) on every write of `level`, which the
-- recompute below does.
DROP TRIGGER IF EXISTS trg_check_level ON public.user_skill_progress;

-- Achievements still unlock, but grant no XP while Learn is offline (every
-- achievement is a Learn one). The XP version is in supabase_xp_leaderboard_schema.sql.
CREATE OR REPLACE FUNCTION public.award_achievement(
  p_user_id UUID,
  p_achievement_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE id = p_achievement_id) THEN RETURN FALSE; END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;

-- The one way total_xp changes: ledger row + total in one statement pair.
CREATE OR REPLACE FUNCTION public.increment_user_xp(
  p_user_id uuid,
  p_xp_delta integer,
  p_source_type text DEFAULT 'unknown',
  p_source_id text DEFAULT NULL
)
RETURNS TABLE(total_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_skill_progress (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_xp_delta IS NULL OR p_xp_delta <= 0 THEN
    RETURN QUERY SELECT s.total_xp FROM public.user_skill_progress s WHERE s.user_id = p_user_id;
    RETURN;
  END IF;

  INSERT INTO public.xp_events (user_id, amount, source_type, source_id)
  VALUES (p_user_id, p_xp_delta, p_source_type, p_source_id);

  RETURN QUERY
  UPDATE public.user_skill_progress
  SET total_xp = public.user_skill_progress.total_xp + p_xp_delta
  WHERE user_id = p_user_id
  RETURNING public.user_skill_progress.total_xp;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_xp(uuid, integer, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_xp(uuid, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.award_achievement(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_achievement(uuid, text) TO service_role;

-- ──────────────────────────────────────────────────────────
-- 4. Void Learn XP.
-- ──────────────────────────────────────────────────────────
UPDATE public.xp_events
SET voided_at = now(), void_reason = 'learn_offline'
WHERE voided_at IS NULL
  AND source_type IN ('step', 'lesson_completion', 'module_completion', 'guest_merge', 'achievement', 'unknown');

-- ──────────────────────────────────────────────────────────
-- 5. Recompute totals and levels.
-- ──────────────────────────────────────────────────────────
INSERT INTO public.user_skill_progress (user_id)
SELECT DISTINCT e.user_id FROM public.xp_events e
ON CONFLICT (user_id) DO NOTHING;

WITH ledger AS (
  SELECT s.user_id,
         COALESCE((SELECT sum(e.amount) FROM public.xp_events e
                   WHERE e.user_id = s.user_id AND e.voided_at IS NULL), 0)::integer AS xp
  FROM public.user_skill_progress s
)
INSERT INTO public.xp_rebalance_2026_10 (user_id, old_total_xp, old_level, new_total_xp, new_level)
SELECT s.user_id, s.total_xp, s.level, l.xp, public.xp_level_for(l.xp)
FROM public.user_skill_progress s JOIN ledger l USING (user_id)
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.user_skill_progress s
SET total_xp   = l.xp,
    level      = public.xp_level_for(l.xp),
    level_seen = public.xp_level_for(l.xp)
FROM (
  SELECT u.user_id,
         COALESCE((SELECT sum(e.amount) FROM public.xp_events e
                   WHERE e.user_id = u.user_id AND e.voided_at IS NULL), 0)::integer AS xp
  FROM public.user_skill_progress u
) l
WHERE l.user_id = s.user_id
  AND (s.total_xp IS DISTINCT FROM l.xp OR s.level_seen IS NULL);

-- The one-time note, for everyone who had XP before.
UPDATE public.user_skill_progress s
SET levels_notice_pending = true
FROM public.xp_rebalance_2026_10 r
WHERE r.user_id = s.user_id AND r.old_total_xp > 0 AND s.levels_notice_dismissed_at IS NULL;

-- ──────────────────────────────────────────────────────────
-- 6. Invariant check.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.xp_ledger_drift()
RETURNS TABLE(user_id uuid, total_xp integer, ledger_xp integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, s.total_xp, COALESCE(sum(e.amount), 0)::integer
  FROM public.user_skill_progress s
  LEFT JOIN public.xp_events e ON e.user_id = s.user_id AND e.voided_at IS NULL
  GROUP BY s.user_id, s.total_xp
  HAVING s.total_xp <> COALESCE(sum(e.amount), 0);
$$;
REVOKE ALL ON FUNCTION public.xp_ledger_drift() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xp_ledger_drift() TO service_role;

-- ──────────────────────────────────────────────────────────
-- 7. Granting XP: daily cap, play streak, bonuses, level-up.
-- ──────────────────────────────────────────────────────────

-- "Today" for XP is the Europe/Amsterdam calendar day — the same day as the
-- trainer's daily spot limit and its reset countdown (amsterdam_day() in
-- supabase_subscriptions.sql), so "Today: 12/50 spots" and "Today 30/150
-- trainer XP" always count the same hands. It used to be the UTC day, which
-- reset one or two hours later than the spots.
CREATE OR REPLACE FUNCTION public.xp_day(p_now timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.amsterdam_day(p_now);
$$;

-- After XP: cache the level and say whether it passed the highest level seen.
CREATE OR REPLACE FUNCTION public._settle_level(p_user_id uuid, OUT level integer, OUT previous_level integer, OUT leveled_up boolean, OUT total_xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.user_skill_progress%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.user_skill_progress u WHERE u.user_id = p_user_id;
  total_xp := COALESCE(s.total_xp, 0);
  level := public.xp_level_for(total_xp);
  previous_level := COALESCE(s.level_seen, level);
  leveled_up := level > previous_level;
  UPDATE public.user_skill_progress u
  SET level = _settle_level.level,
      level_seen = GREATEST(COALESCE(u.level_seen, _settle_level.level), _settle_level.level)
  WHERE u.user_id = p_user_id
    AND (u.level IS DISTINCT FROM _settle_level.level OR u.level_seen IS DISTINCT FROM GREATEST(COALESCE(u.level_seen, _settle_level.level), _settle_level.level));
END;
$$;

-- Trainer XP for one answer. p_xp is what the trainer's own rules give (0 is
-- fine: it still returns today's numbers). The cap is shared by both trainers;
-- the streak bonus comes on top as its own 'streak_bonus' ledger row. The
-- streak is the day streak users see (activity_streak, their time zone),
-- read once per day after the day's first XP has counted as activity.
CREATE OR REPLACE FUNCTION public.grant_trainer_xp(
  p_user_id     uuid,
  p_xp          integer,
  p_source_type text,
  p_source_id   text DEFAULT NULL
)
RETURNS TABLE(
  xp_awarded     integer,
  bonus_xp       integer,
  daily_xp       integer,
  daily_cap      integer,
  total_xp       integer,
  level          integer,
  previous_level integer,
  leveled_up     boolean,
  streak_days    integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cap     constant integer := (SELECT value FROM public.xp_rules WHERE key = 'daily_cap');
  c_min     constant integer := (SELECT value FROM public.xp_rules WHERE key = 'streak_min_days');
  c_pct     constant integer := (SELECT value FROM public.xp_rules WHERE key = 'streak_percent');
  c_bmax    constant integer := (SELECT value FROM public.xp_rules WHERE key = 'streak_daily_max');
  v_today   date := public.xp_day();
  d         public.xp_daily%ROWTYPE;
  v_xp      integer;
  v_bonus   integer := 0;
  v_carry   integer;
  v_streak  integer;
  lv        record;
BEGIN
  IF p_source_type NOT IN ('preflop_trainer', 'flop_equity') THEN
    RAISE EXCEPTION 'not a trainer source: %', p_source_type;
  END IF;

  INSERT INTO public.user_skill_progress (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  -- One grant per user at a time (both trainers lock this row first).
  PERFORM 1 FROM public.user_skill_progress s WHERE s.user_id = p_user_id FOR UPDATE;

  INSERT INTO public.xp_daily (user_id, day) VALUES (p_user_id, v_today) ON CONFLICT DO NOTHING;
  SELECT * INTO d FROM public.xp_daily x WHERE x.user_id = p_user_id AND x.day = v_today FOR UPDATE;

  v_xp := GREATEST(0, LEAST(COALESCE(p_xp, 0), c_cap - d.trainer_xp));
  v_streak := d.streak_days;
  v_carry := d.bonus_carry;

  IF v_xp > 0 THEN
    PERFORM public.increment_user_xp(p_user_id, v_xp, p_source_type, p_source_id);
    IF v_streak IS NULL THEN
      v_streak := COALESCE((public.activity_streak(p_user_id) ->> 'streak')::integer, 0);
    END IF;
    IF v_streak >= c_min THEN
      v_carry := v_carry + v_xp * c_pct;
      v_bonus := LEAST(v_carry / 100, c_bmax - d.bonus_xp);
      v_carry := v_carry - (v_carry / 100) * 100;
    END IF;
    UPDATE public.xp_daily x SET
      trainer_xp  = x.trainer_xp + v_xp,
      bonus_xp    = x.bonus_xp + v_bonus,
      bonus_carry = v_carry,
      streak_days = v_streak
    WHERE x.user_id = p_user_id AND x.day = v_today;
    IF v_bonus > 0 THEN
      PERFORM public.increment_user_xp(p_user_id, v_bonus, 'streak_bonus', v_today::text);
    END IF;
  END IF;

  SELECT * INTO lv FROM public._settle_level(p_user_id);
  RETURN QUERY SELECT v_xp, v_bonus, d.trainer_xp + v_xp, c_cap, lv.total_xp, lv.level, lv.previous_level,
    lv.leveled_up, COALESCE(v_streak, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_trainer_xp(uuid, integer, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_trainer_xp(uuid, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public._settle_level(uuid) FROM public, anon, authenticated;

-- Hand review: the first new tournament of the day (xp_day) earns a small bonus.
-- Never blocks an import.
CREATE OR REPLACE FUNCTION public.hand_review_daily_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.xp_day();
  v_xp    integer := (SELECT value FROM public.xp_rules WHERE key = 'hand_review_xp');
BEGIN
  BEGIN
    INSERT INTO public.user_skill_progress (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.user_skill_progress s WHERE s.user_id = NEW.user_id FOR UPDATE;
    INSERT INTO public.xp_daily (user_id, day) VALUES (NEW.user_id, v_today) ON CONFLICT DO NOTHING;
    UPDATE public.xp_daily x SET hand_review_at = now()
    WHERE x.user_id = NEW.user_id AND x.day = v_today AND x.hand_review_at IS NULL;
    IF FOUND AND v_xp > 0 THEN
      PERFORM public.increment_user_xp(NEW.user_id, v_xp, 'hand_review', NEW.id::text);
      -- level / level_seen follow at the next trainer answer, which then
      -- also shows the level-up moment if this bonus crossed a level.
      UPDATE public.user_skill_progress s SET level = public.xp_level_for(s.total_xp) WHERE s.user_id = NEW.user_id;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'hand review XP skipped for %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hand_review_daily_xp() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_hand_review_daily_xp ON public.hh_tournaments;
CREATE TRIGGER trg_hand_review_daily_xp
  AFTER INSERT ON public.hh_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.hand_review_daily_xp();

-- ──────────────────────────────────────────────────────────
-- 8. Trainer RPCs on grant_trainer_xp. Their own XP rules are unchanged;
--    only the cap moved (per trainer → shared) and level fields were added.
-- ──────────────────────────────────────────────────────────
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
  total_xp       integer,
  bonus_xp       integer,
  level          integer,
  previous_level integer,
  leveled_up     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_key     constant text     := 'preflop-ranges';
  c_min_gap constant interval := interval '1500 milliseconds';
  r         public.trainer_highscores%ROWTYPE;
  g         record;
  v_streak  integer;
  v_xp      integer := 0;
BEGIN
  IF p_verdict NOT IN ('correct', 'mixed', 'wrong') THEN
    RAISE EXCEPTION 'invalid verdict %', p_verdict;
  END IF;

  INSERT INTO public.trainer_highscores (user_id, trainer_key)
  VALUES (p_user_id, c_key)
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  SELECT * INTO r FROM public.trainer_highscores h
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  FOR UPDATE;

  IF r.last_hand_at IS NOT NULL AND now() - r.last_hand_at < c_min_gap THEN
    SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, 0, 'preflop_trainer');
    RETURN QUERY SELECT 0, r.current_streak, r.best_streak, g.daily_xp, g.daily_cap,
      1 + LEAST(r.current_streak / 10, 3),
      CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
      true, g.total_xp, 0, g.level, g.previous_level, false;
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

  UPDATE public.trainer_highscores h SET
    current_streak = v_streak,
    best_streak    = GREATEST(h.best_streak, v_streak),
    last_hand_at   = now(),
    hands_played   = h.hands_played + 1,
    updated_at     = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  RETURNING * INTO r;

  INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict)
  VALUES (p_user_id, p_hand_ref, p_verdict);

  SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, v_xp, 'preflop_trainer', p_hand_ref);

  RETURN QUERY SELECT g.xp_awarded, r.current_streak, r.best_streak, g.daily_xp, g.daily_cap,
    1 + LEAST(r.current_streak / 10, 3),
    CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
    false, g.total_xp, g.bonus_xp, g.level, g.previous_level, g.leveled_up;
END;
$$;

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
    SELECT h.current_streak, h.best_streak, h.hands_played
    FROM public.trainer_highscores h
    WHERE h.user_id = p_user_id AND h.trainer_key = 'preflop-ranges'
    UNION ALL
    SELECT 0, 0, 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trainer_highscores h
      WHERE h.user_id = p_user_id AND h.trainer_key = 'preflop-ranges'
    )
  )
  SELECT r.current_streak, r.best_streak,
         COALESCE((SELECT x.trainer_xp FROM public.xp_daily x
                   WHERE x.user_id = p_user_id AND x.day = public.xp_day()), 0),
         (SELECT value FROM public.xp_rules WHERE key = 'daily_cap'),
         1 + LEAST(r.current_streak / 10, 3),
         CASE WHEN r.current_streak >= 30 THEN NULL ELSE (r.current_streak / 10 + 1) * 10 END,
         r.hands_played
  FROM r;
$$;

REVOKE ALL ON FUNCTION public.preflop_trainer_state(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preflop_trainer_state(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.record_preflop_trainer_hand(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_preflop_trainer_hand(uuid, text, text) TO service_role;


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
  hands_played        integer,
  bonus_xp            integer,
  level               integer,
  previous_level      integer,
  leveled_up          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_key     constant text     := 'flop-equity';
  c_session constant integer  := 10;
  c_min_gap constant interval := interval '1500 milliseconds';
  r         public.trainer_highscores%ROWTYPE;
  g         record;
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

  IF r.last_hand_at IS NOT NULL AND now() - r.last_hand_at < c_min_gap THEN
    SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, 0, 'flop_equity');
    RETURN QUERY SELECT 0, g.daily_xp, g.daily_cap, true, g.total_xp,
      r.session_answers, r.session_points, false, r.best_session_points, false, r.hands_played,
      0, g.level, g.previous_level, false;
    RETURN;
  END IF;

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
    last_hand_at        = now(),
    hands_played        = h.hands_played + 1,
    updated_at          = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = c_key
  RETURNING * INTO r;

  SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, p_points, 'flop_equity', p_spot_id || ':' || p_flop);

  INSERT INTO public.flop_trainer_answers (
    user_id, spot_id, flop, category, guess_equity, actual_equity, abs_error, verdict,
    nut_guess, nut_actual, points, xp_awarded, session_id,
    cbet_band_guess, cbet_size_guess, cbet_band_ok, cbet_size_ok
  ) VALUES (
    p_user_id, p_spot_id, p_flop, p_category, p_guess, p_actual, round(abs(p_guess - p_actual), 2), p_verdict,
    p_nut_guess, p_nut_actual, p_points, g.xp_awarded, p_session_id,
    p_cbet_band, p_cbet_size, p_cbet_band_ok, p_cbet_size_ok
  );

  RETURN QUERY SELECT g.xp_awarded, g.daily_xp, g.daily_cap, false, g.total_xp,
    v_answers, v_points, v_done, v_best, v_record, r.hands_played,
    g.bonus_xp, g.level, g.previous_level, g.leveled_up;
END;
$$;

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
  xp_awarded     integer,
  daily_xp       integer,
  daily_cap      integer,
  too_fast       boolean,
  total_xp       integer,
  streak         integer,
  best_streak    integer,
  bonus_xp       integer,
  level          integer,
  previous_level integer,
  leveled_up     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min_gap constant interval := interval '800 milliseconds';
  v         public.trainer_highscores%ROWTYPE;  -- 'flop-versus': streak
  g         record;
BEGIN
  IF p_pick NOT IN ('a', 'b') THEN
    RAISE EXCEPTION 'invalid pick %', p_pick;
  END IF;

  INSERT INTO public.trainer_highscores (user_id, trainer_key) VALUES (p_user_id, 'flop-versus')
  ON CONFLICT (user_id, trainer_key) DO NOTHING;

  SELECT * INTO v FROM public.trainer_highscores h WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-versus' FOR UPDATE;

  IF v.last_hand_at IS NOT NULL AND now() - v.last_hand_at < c_min_gap THEN
    SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, 0, 'flop_equity');
    RETURN QUERY SELECT 0, g.daily_xp, g.daily_cap, true, g.total_xp, v.current_streak, v.best_streak,
      0, g.level, g.previous_level, false;
    RETURN;
  END IF;

  UPDATE public.trainer_highscores h SET
    current_streak = CASE WHEN p_correct THEN h.current_streak + 1 ELSE 0 END,
    best_streak    = GREATEST(h.best_streak, CASE WHEN p_correct THEN h.current_streak + 1 ELSE 0 END),
    last_hand_at   = now(),
    hands_played   = h.hands_played + 1,
    updated_at     = now()
  WHERE h.user_id = p_user_id AND h.trainer_key = 'flop-versus'
  RETURNING * INTO v;

  SELECT * INTO g FROM public.grant_trainer_xp(p_user_id, CASE WHEN p_correct THEN 1 ELSE 0 END, 'flop_equity',
    'versus:' || p_spot_id || ':' || p_flop_a || ':' || p_flop_b);

  INSERT INTO public.flop_versus_answers (user_id, spot_id, flop_a, flop_b, pick, correct, equity_gap, xp_awarded)
  VALUES (p_user_id, p_spot_id, p_flop_a, p_flop_b, p_pick, p_correct, p_gap, g.xp_awarded);

  RETURN QUERY SELECT g.xp_awarded, g.daily_xp, g.daily_cap, false, g.total_xp, v.current_streak, v.best_streak,
    g.bonus_xp, g.level, g.previous_level, g.leveled_up;
END;
$$;

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
    SELECT t.best_session_points, t.hands_played
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
  SELECT COALESCE((SELECT x.trainer_xp FROM public.xp_daily x
                   WHERE x.user_id = p_user_id AND x.day = public.xp_day()), 0),
         (SELECT value FROM public.xp_rules WHERE key = 'daily_cap'),
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

-- ──────────────────────────────────────────────────────────
-- 9. Reading XP.
-- ──────────────────────────────────────────────────────────

-- Profile numbers. The level itself is derived from total_xp by the caller
-- (lib/levels, xp_calculator) — the same table as xp_levels.
CREATE OR REPLACE FUNCTION public.xp_profile(p_user_id uuid)
RETURNS TABLE(
  total_xp         integer,
  preflop_xp       integer,
  flop_xp          integer,
  bonus_xp         integer,
  hand_review_xp   integer,
  streak_days      integer,
  daily_xp         integer,
  daily_cap        integer,
  levels_notice    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(s.total_xp, 0),
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'preflop_trainer'), 0)::integer,
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'flop_equity'), 0)::integer,
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'streak_bonus'), 0)::integer,
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'hand_review'), 0)::integer,
    COALESCE((public.activity_streak(p_user_id) ->> 'streak')::integer, 0),
    COALESCE((SELECT x.trainer_xp FROM public.xp_daily x
              WHERE x.user_id = p_user_id AND x.day = public.xp_day()), 0),
    (SELECT value FROM public.xp_rules WHERE key = 'daily_cap'),
    COALESCE(s.levels_notice_pending, false)
  FROM (SELECT p_user_id AS user_id) me
  LEFT JOIN public.user_skill_progress s ON s.user_id = me.user_id
  LEFT JOIN public.xp_events e ON e.user_id = me.user_id AND e.voided_at IS NULL
  GROUP BY s.total_xp, s.levels_notice_pending;
$$;
REVOKE ALL ON FUNCTION public.xp_profile(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xp_profile(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.my_xp_profile()
RETURNS TABLE(
  total_xp         integer,
  preflop_xp       integer,
  flop_xp          integer,
  bonus_xp         integer,
  hand_review_xp   integer,
  streak_days      integer,
  daily_xp         integer,
  daily_cap        integer,
  levels_notice    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.xp_profile(auth.uid()) WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.my_xp_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_xp_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_levels_notice()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_skill_progress
  SET levels_notice_pending = false, levels_notice_dismissed_at = now()
  WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.dismiss_levels_notice() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_levels_notice() TO authenticated;

-- 24h leaderboards without voided rows. Same bodies as supabase_display_name.sql
-- plus `voided_at IS NULL` — if that file is ever re-run, run this one after it.
CREATE OR REPLACE FUNCTION public.leaderboard_24h(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(user_id uuid, username text, total_xp integer, period_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_totals AS (
    SELECT xe.user_id, SUM(xe.amount)::integer AS period_xp
    FROM public.xp_events xe
    WHERE xe.earned_at >= now() - interval '24 hours' AND xe.voided_at IS NULL
    GROUP BY xe.user_id
  )
  SELECT
    pt.user_id,
    public.public_player_name(p.display_name, p.id),
    usp.total_xp,
    pt.period_xp,
    RANK() OVER (ORDER BY pt.period_xp DESC)::integer AS rank
  FROM period_totals pt
  JOIN public.profiles p ON p.id = pt.user_id
  JOIN public.user_skill_progress usp ON usp.user_id = pt.user_id
  ORDER BY pt.period_xp DESC, pt.user_id ASC
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_my_rank_24h(p_user_id uuid)
RETURNS TABLE(username text, total_xp integer, period_xp integer, rank integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_period AS (
    SELECT COALESCE(SUM(amount), 0)::integer AS period_xp
    FROM public.xp_events
    WHERE user_id = p_user_id AND earned_at >= now() - interval '24 hours' AND voided_at IS NULL
  ),
  others AS (
    SELECT xe2.user_id, SUM(xe2.amount)::integer AS period_xp
    FROM public.xp_events xe2
    WHERE xe2.earned_at >= now() - interval '24 hours' AND xe2.voided_at IS NULL
    GROUP BY xe2.user_id
  )
  SELECT
    public.public_player_name(p.display_name, p.id),
    COALESCE(usp.total_xp, 0),
    mp.period_xp,
    (
      SELECT COUNT(*) + 1
      FROM others o
      WHERE o.period_xp > mp.period_xp
    )::integer AS rank
  FROM public.profiles p
  CROSS JOIN my_period mp
  LEFT JOIN public.user_skill_progress usp ON usp.user_id = p_user_id
  WHERE p.id = p_user_id AND mp.period_xp > 0;
$$;
