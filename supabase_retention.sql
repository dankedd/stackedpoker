-- ============================================================
-- Retention: day streaks, lifecycle emails (day 1 / 3 / 7), email opt-out
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
-- Run AFTER:
--   supabase_schema.sql               (profiles)
--   supabase_xp_leaderboard_schema.sql (xp_events)
--   supabase_preflop_trainer_xp.sql   (trainer_highscores, trainer_hand_log —
--                                       re-run it first: it now logs every hand)
--
-- What lives here
--   profiles.email_opt_out   one switch for every lifecycle email
--   profiles.timezone        IANA zone reported by the browser; days and
--                            streaks are counted in it (default Amsterdam)
--   email_log                one row per (user, template): each email is sent
--                            at most once, enforced by the unique constraint
--   activity_streak(user)    consecutive local days with activity
--   lifecycle_email_candidates()  the facts the daily cron decides on
--                            (frontend/app/api/cron/lifecycle-emails)
--
-- "Activity" = an xp_events row OR a trainer_hand_log row. xp_events alone
-- misses trainer hands that earn 0 XP (a wrong answer, or after the daily XP
-- cap), and a day spent drilling should never break a streak.
-- ============================================================

-- ── Profile columns ────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_out     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_out_at  timestamptz,
  ADD COLUMN IF NOT EXISTS timezone          text;

-- ── Email log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_log (
  id           bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template     text         NOT NULL CHECK (template IN ('day1', 'day3', 'day7')),
  sent_at      timestamptz  NOT NULL DEFAULT now(),
  -- Resend's message id, once the send went through.
  provider_id  text,
  CONSTRAINT email_log_user_template_key UNIQUE (user_id, template)
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- No policies: the cron route (service role) is the only reader and writer.

-- ── Time zone ──────────────────────────────────────────────────────────────

-- Never NULL and always a zone Postgres knows, so AT TIME ZONE cannot fail.
CREATE OR REPLACE FUNCTION public.user_tz(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.timezone FROM public.profiles p WHERE p.id = p_user_id), 'Europe/Amsterdam');
$$;

-- Called by the browser with Intl.DateTimeFormat().resolvedOptions().timeZone.
-- Unknown zones are ignored (returns false) rather than stored.
CREATE OR REPLACE FUNCTION public.set_my_timezone(p_tz text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_tz IS NULL OR length(p_tz) > 64
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz) THEN
    RETURN false;
  END IF;
  UPDATE public.profiles SET timezone = p_tz
   WHERE id = auth.uid() AND timezone IS DISTINCT FROM p_tz;
  RETURN true;
END;
$$;

-- ── Streak ─────────────────────────────────────────────────────────────────

-- Distinct local calendar days with activity.
CREATE OR REPLACE FUNCTION public.activity_days(p_user_id uuid, p_tz text)
RETURNS TABLE(day date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (e.earned_at AT TIME ZONE p_tz)::date FROM public.xp_events e WHERE e.user_id = p_user_id
  UNION
  SELECT (h.played_at AT TIME ZONE p_tz)::date FROM public.trainer_hand_log h WHERE h.user_id = p_user_id;
$$;

-- {streak, active_today, today, timezone}
--   streak        consecutive active days ending today, or ending yesterday
--                 when today has no activity yet (still alive until midnight)
--   active_today  today already counts
CREATE OR REPLACE FUNCTION public.activity_streak(p_user_id uuid, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH z AS (
    SELECT public.user_tz(p_user_id) AS tz
  ), t AS (
    SELECT z.tz, (p_now AT TIME ZONE z.tz)::date AS today FROM z
  ), d AS (
    SELECT a.day FROM t, public.activity_days(p_user_id, t.tz) a WHERE a.day <= t.today
  ), ranked AS (
    -- Consecutive days share day + rank (rank counts down from the newest).
    SELECT d.day, d.day + (row_number() OVER (ORDER BY d.day DESC))::int AS grp FROM d
  ), latest AS (
    SELECT r.day, r.grp FROM ranked r ORDER BY r.day DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'streak', CASE
                WHEN (SELECT l.day FROM latest l) >= t.today - 1
                  THEN (SELECT count(*) FROM ranked r WHERE r.grp = (SELECT l.grp FROM latest l))::int
                ELSE 0
              END,
    'active_today', COALESCE((SELECT l.day FROM latest l) = t.today, false),
    'today', t.today,
    'timezone', t.tz
  )
  FROM t;
$$;

-- The signed-in user's own streak (trainer header, dashboard).
CREATE OR REPLACE FUNCTION public.my_streak()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.activity_streak(auth.uid()) END;
$$;

-- ── Email preferences ──────────────────────────────────────────────────────

-- Settings toggle. The no-login unsubscribe link writes with the service role.
CREATE OR REPLACE FUNCTION public.set_email_opt_out(p_opt_out boolean)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET email_opt_out = p_opt_out,
         email_opt_out_at = CASE WHEN p_opt_out THEN now() END
   WHERE id = auth.uid()
  RETURNING email_opt_out;
$$;

-- ── Lifecycle email candidates ─────────────────────────────────────────────
--
-- Facts only: which template (if any) a user gets is decided in
-- frontend/lib/lifecycle/plan.ts, which is unit-tested. Everyone excluded
-- for good is filtered out here:
--   unconfirmed or deleted accounts, @example.invalid (test suites), the
--   admin/dev account, users who opted out, accounts older than 15 days
--   (the flow ends with day 7).
CREATE OR REPLACE FUNCTION public.lifecycle_email_candidates(p_now timestamptz DEFAULT now())
RETURNS TABLE(
  user_id         uuid,
  email           text,
  name            text,
  signed_up_at    timestamptz,
  timezone        text,
  last_active_at  timestamptz,
  active_today    boolean,
  streak          integer,
  -- Trainer hands. 'log' = exact (trainer_hand_log). 'estimate' = hands
  -- played before the log existed: total from trainer_highscores, good =
  -- trainer xp_events (one per correct/mixed hand under the daily XP cap).
  hands_total     integer,
  hands_good      integer,
  hands_source    text,
  -- The chart (kind:chart_id) with the worst wrong rate, at least 3 hands
  -- and 2 mistakes in it; NULL when no spot qualifies.
  weakest_ref     text,
  weakest_hands   integer,
  weakest_wrong   integer,
  emails_sent     jsonb,
  last_email_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    SELECT au.id, au.email, au.created_at, public.user_tz(au.id) AS tz,
           NULLIF(btrim(COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name')), '') AS name
      FROM auth.users au
      JOIN public.profiles p ON p.id = au.id
     WHERE au.email IS NOT NULL
       AND au.email_confirmed_at IS NOT NULL
       AND au.deleted_at IS NULL
       AND au.created_at <= p_now
       AND au.created_at >  p_now - interval '15 days'
       AND lower(au.email) NOT LIKE '%@example.invalid'
       AND NOT p.email_opt_out
       AND p.subscription_tier <> 'admin'
  )
  SELECT
    u.id,
    u.email,
    u.name,
    u.created_at,
    u.tz,
    act.last_active_at,
    COALESCE((act.last_active_at AT TIME ZONE u.tz)::date = (p_now AT TIME ZONE u.tz)::date, false),
    (public.activity_streak(u.id, p_now) ->> 'streak')::int,
    CASE WHEN lg.total > 0 THEN lg.total ELSE COALESCE(hs.hands_played, 0) END,
    CASE WHEN lg.total > 0 THEN lg.good  ELSE LEAST(COALESCE(xe.good, 0), COALESCE(hs.hands_played, 0)) END,
    CASE WHEN lg.total > 0 THEN 'log' ELSE 'estimate' END,
    wk.ref,
    wk.total,
    wk.wrong,
    COALESCE(el.sent, '{}'::jsonb),
    el.last_at
  FROM u
  LEFT JOIN LATERAL (
    SELECT GREATEST(
      (SELECT max(e.earned_at) FROM public.xp_events e WHERE e.user_id = u.id AND e.earned_at <= p_now),
      (SELECT max(h.played_at) FROM public.trainer_hand_log h WHERE h.user_id = u.id AND h.played_at <= p_now)
    ) AS last_active_at
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total, count(*) FILTER (WHERE h.verdict <> 'wrong')::int AS good
      FROM public.trainer_hand_log h WHERE h.user_id = u.id AND h.played_at <= p_now
  ) lg ON true
  LEFT JOIN LATERAL (
    SELECT t.hands_played FROM public.trainer_highscores t
     WHERE t.user_id = u.id AND t.trainer_key = 'preflop-ranges'
  ) hs ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS good FROM public.xp_events e
     WHERE e.user_id = u.id AND e.source_type = 'preflop_trainer' AND e.earned_at <= p_now
  ) xe ON true
  LEFT JOIN LATERAL (
    SELECT split_part(h.hand_ref, ':', 1) || ':' || split_part(h.hand_ref, ':', 2) AS ref,
           count(*)::int AS total,
           count(*) FILTER (WHERE h.verdict = 'wrong')::int AS wrong
      FROM public.trainer_hand_log h
     WHERE h.user_id = u.id AND h.hand_ref IS NOT NULL AND h.played_at <= p_now
     GROUP BY 1
    HAVING count(*) >= 3 AND count(*) FILTER (WHERE h.verdict = 'wrong') >= 2
     ORDER BY count(*) FILTER (WHERE h.verdict = 'wrong')::numeric / count(*) DESC,
              count(*) FILTER (WHERE h.verdict = 'wrong') DESC, 1
     LIMIT 1
  ) wk ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_object_agg(l.template, l.sent_at) AS sent, max(l.sent_at) AS last_at
      FROM public.email_log l WHERE l.user_id = u.id
  ) el ON true
  ORDER BY u.created_at;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.user_tz(uuid)                              FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_days(uuid, text)                  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_streak(uuid, timestamptz)         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.lifecycle_email_candidates(timestamptz)    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_streak()                                FROM public, anon;
REVOKE ALL ON FUNCTION public.set_my_timezone(text)                      FROM public, anon;
REVOKE ALL ON FUNCTION public.set_email_opt_out(boolean)                 FROM public, anon;

GRANT EXECUTE ON FUNCTION public.activity_streak(uuid, timestamptz)      TO service_role;
GRANT EXECUTE ON FUNCTION public.lifecycle_email_candidates(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_streak()                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_timezone(text)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_email_opt_out(boolean)              TO authenticated;
