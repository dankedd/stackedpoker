-- ============================================================
-- Free / Pro subscriptions — entitlements, usage limits, reverse trial
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
-- Depends on: supabase_schema.sql (profiles), supabase_hand_history.sql.
--
-- The ONE place that decides what a user may do:
--
--   effective_plan(user)      'pro' | 'trial' | 'free'
--   get_entitlements(user)    plan + limits + today's/this week's usage
--   consume_usage(user, m)    atomic check-and-increment of a daily limit
--
-- Subscription state is written ONLY by the Stripe webhook
-- (backend/app/api/routes/stripe_routes.py, service role). Clients can read
-- their own row and nothing else; there is no client write path at all.
--
-- Tables
--   plan_limits     tunable numbers (50 hands, 1 tournament, 3/100 questions…)
--   subscriptions   one row per user that has a trial or a Stripe customer
--   stripe_events   processed webhook event ids (idempotency)
--   usage_daily     per-day counters, day = Europe/Amsterdam calendar day
--   usage_events    rolling-window events (tournament uploads)
--
-- Every function that reads the clock takes p_now (default now()) so the
-- tests can pin "23:59 in Amsterdam" without waiting for midnight.
-- ============================================================

-- ── Limits ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_limits (
  key         text         PRIMARY KEY,
  value       integer      NOT NULL CHECK (value >= 0),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

INSERT INTO public.plan_limits (key, value) VALUES
  ('free_trainer_hands_per_day', 50),
  ('free_tournaments_per_week',  1),
  ('free_ai_questions_per_day',  3),
  -- Hidden fair-use cap for Pro and trial: never shown in the UI.
  ('pro_ai_questions_per_day',   100),
  ('trial_days',                 7),
  ('past_due_grace_days',        3)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

CREATE OR REPLACE FUNCTION public.plan_limit(p_key text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.plan_limits WHERE key = p_key;
$$;

-- ── Subscriptions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id                 uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      text         UNIQUE,
  stripe_subscription_id  text         UNIQUE,
  -- Stripe's own subscription status: active, trialing, past_due, canceled,
  -- unpaid, incomplete, incomplete_expired, paused. NULL = never subscribed.
  status                  text,
  plan                    text         NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro')),
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean      NOT NULL DEFAULT false,
  -- First failed payment of the current dunning run; cleared once paid.
  past_due_since          timestamptz,
  -- Reverse trial: set at signup for new accounts only.
  trial_ends_at           timestamptz,
  trial_ended_seen_at     timestamptz,
  -- hand_limit | upload_limit | ai_limit | trial_ending | trial_ended | pricing_page
  upgrade_source          text,
  -- `created` of the newest Stripe event applied: older events arriving late
  -- (Stripe does not guarantee order) are ignored.
  stripe_event_at         timestamptz,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy: only the webhook (service role) writes.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     text         PRIMARY KEY,
  type         text         NOT NULL,
  received_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- ── Usage ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_daily (
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric      text         NOT NULL CHECK (metric IN ('trainer_hand', 'ai_question')),
  usage_date  date         NOT NULL,  -- Europe/Amsterdam calendar day
  count       integer      NOT NULL DEFAULT 0,
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, usage_date)
);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_daily_select_own" ON public.usage_daily;
CREATE POLICY "usage_daily_select_own" ON public.usage_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id          bigserial    PRIMARY KEY,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric      text         NOT NULL CHECK (metric IN ('tournament_upload')),
  ref         text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_user_metric_idx
  ON public.usage_events (user_id, metric, created_at DESC);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_events_select_own" ON public.usage_events;
CREATE POLICY "usage_events_select_own" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);
-- Deleting a tournament does not give the upload back: events are never
-- deleted by the client.

-- ── Plan ───────────────────────────────────────────────────────────────────

-- 'pro'   paid (active/trialing in Stripe), past_due inside the grace window,
--         or the admin (development) account
-- 'trial' reverse trial still running — same limits as Pro
-- 'free'  everything else
CREATE OR REPLACE FUNCTION public.effective_plan(p_user_id uuid, p_now timestamptz DEFAULT now())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.subscription_tier = 'admin' THEN 'pro'
    WHEN s.status IN ('active', 'trialing') THEN 'pro'
    WHEN s.status = 'past_due'
         AND s.past_due_since IS NOT NULL
         AND p_now < s.past_due_since + make_interval(days => public.plan_limit('past_due_grace_days'))
      THEN 'pro'
    WHEN s.trial_ends_at IS NOT NULL AND p_now < s.trial_ends_at THEN 'trial'
    ELSE 'free'
  END
  FROM (SELECT p_user_id AS id) u
  LEFT JOIN public.profiles p      ON p.id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id;
$$;

-- NULL = unlimited.
CREATE OR REPLACE FUNCTION public.usage_limit(p_plan text, p_metric text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_metric
    WHEN 'trainer_hand'      THEN CASE WHEN p_plan = 'free' THEN public.plan_limit('free_trainer_hands_per_day') END
    WHEN 'tournament_upload' THEN CASE WHEN p_plan = 'free' THEN public.plan_limit('free_tournaments_per_week') END
    WHEN 'ai_question'       THEN CASE WHEN p_plan = 'free' THEN public.plan_limit('free_ai_questions_per_day')
                                       ELSE public.plan_limit('pro_ai_questions_per_day') END
  END;
$$;

CREATE OR REPLACE FUNCTION public.amsterdam_day(p_now timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_now AT TIME ZONE 'Europe/Amsterdam')::date;
$$;

-- Next 00:00 in Amsterdam (handles the DST switch: 23- or 25-hour days).
CREATE OR REPLACE FUNCTION public.next_amsterdam_midnight(p_now timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((public.amsterdam_day(p_now) + 1)::timestamp AT TIME ZONE 'Europe/Amsterdam');
$$;

-- ── consume_usage — the atomic gate for daily limits ───────────────────────
--
-- One INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit statement:
-- Postgres row-locks the (user, metric, day) row, so two simultaneous calls
-- at 49/50 can never both land hand 50 — the loser's WHERE is false and it
-- gets allowed=false. Same pattern as reserve_coach_usage
-- (supabase_ai_coach_usage_schema.sql), with the limit resolved here from
-- the plan instead of passed in by the caller.
CREATE OR REPLACE FUNCTION public.consume_usage(p_user_id uuid, p_metric text, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text    := public.effective_plan(p_user_id, p_now);
  v_limit integer := public.usage_limit(v_plan, p_metric);
  v_day   date    := public.amsterdam_day(p_now);
  v_count integer;
BEGIN
  IF p_metric NOT IN ('trainer_hand', 'ai_question') THEN
    RAISE EXCEPTION 'consume_usage: unknown daily metric %', p_metric;
  END IF;

  IF v_limit IS NULL OR v_limit > 0 THEN
    INSERT INTO public.usage_daily AS u (user_id, metric, usage_date, count, updated_at)
    VALUES (p_user_id, p_metric, v_day, 1, p_now)
    ON CONFLICT (user_id, metric, usage_date) DO UPDATE
      SET count = u.count + 1, updated_at = p_now
      WHERE v_limit IS NULL OR u.count < v_limit
    RETURNING u.count INTO v_count;
  END IF;

  IF v_count IS NULL THEN
    SELECT u.count INTO v_count
      FROM public.usage_daily u
     WHERE u.user_id = p_user_id AND u.metric = p_metric AND u.usage_date = v_day;
    RETURN jsonb_build_object(
      'allowed', false, 'used', COALESCE(v_count, 0), 'limit', v_limit,
      'plan', v_plan, 'reset_at', public.next_amsterdam_midnight(p_now));
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 'used', v_count, 'limit', v_limit,
    'plan', v_plan, 'reset_at', public.next_amsterdam_midnight(p_now));
END;
$$;

-- Gives back one unit when the request it paid for failed (e.g. the LLM call
-- errored after the gate let it through). Floors at 0.
CREATE OR REPLACE FUNCTION public.release_usage(p_user_id uuid, p_metric text, p_now timestamptz DEFAULT now())
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usage_daily
     SET count = GREATEST(count - 1, 0), updated_at = p_now
   WHERE user_id = p_user_id AND metric = p_metric AND usage_date = public.amsterdam_day(p_now);
$$;

-- ── Tournament uploads — enforced in the database ──────────────────────────
--
-- The hand importer writes straight to Supabase under the user's session
-- (frontend/lib/handHistory/importer.ts), so the limit has to live here:
-- a free user's second NEW tournament inside 7 rolling days is rejected.
-- Re-uploading a tournament the user already has is not a new upload (the
-- importer's ON CONFLICT DO NOTHING then skips the row).
CREATE OR REPLACE FUNCTION public.hh_tournaments_upload_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit  integer;
  v_used   integer;
  v_oldest timestamptz;
BEGIN
  -- Serialise this user's uploads so two tabs can't both take the last slot.
  PERFORM pg_advisory_xact_lock(hashtext('tournament_upload:' || NEW.user_id::text));

  IF EXISTS (
    SELECT 1 FROM public.hh_tournaments t
     WHERE t.user_id = NEW.user_id AND t.site = NEW.site AND t.tournament_id = NEW.tournament_id
  ) THEN
    RETURN NEW;
  END IF;

  v_limit := public.usage_limit(public.effective_plan(NEW.user_id), 'tournament_upload');
  IF v_limit IS NOT NULL THEN
    SELECT count(*), min(e.created_at) INTO v_used, v_oldest
      FROM public.usage_events e
     WHERE e.user_id = NEW.user_id AND e.metric = 'tournament_upload'
       AND e.created_at > now() - interval '7 days';
    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'UPLOAD_LIMIT_REACHED'
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object('limit', v_limit, 'used', v_used,
                                          'next_available_at', v_oldest + interval '7 days')::text,
              HINT    = 'Free includes 1 tournament per week.';
    END IF;
  END IF;

  INSERT INTO public.usage_events (user_id, metric, ref)
  VALUES (NEW.user_id, 'tournament_upload', NEW.site || ':' || NEW.tournament_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hh_tournaments_upload_limit ON public.hh_tournaments;
CREATE TRIGGER hh_tournaments_upload_limit
  BEFORE INSERT ON public.hh_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.hh_tournaments_upload_limit();

-- ── Upload history — Free sees only the most recent tournament ─────────────
--
-- Nothing is deleted: older tournaments come back the moment the user is on
-- Pro again. The helpers are SECURITY DEFINER (owner bypasses RLS), so the
-- policies below can call them without recursing into themselves, and they
-- are wrapped in scalar sub-selects so Postgres evaluates them once per
-- query, not once per row.

CREATE OR REPLACE FUNCTION public.hh_full_history()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.effective_plan(auth.uid()) <> 'free';
$$;

CREATE OR REPLACE FUNCTION public.hh_latest_tournament()
RETURNS public.hh_tournaments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.* FROM public.hh_tournaments t
   WHERE t.user_id = auth.uid()
   ORDER BY t.created_at DESC, t.last_hand_at DESC NULLS LAST, t.id DESC
   LIMIT 1;
$$;

-- `created_at > latest`: Postgres also checks this policy against the row an
-- INSERT ... ON CONFLICT proposes, before it exists. The importer's upsert of
-- a brand-new tournament (created_at = now()) must pass, and once committed
-- that row IS the latest. `latest IS NULL`: the user's very first tournament
-- (nothing to compare against — without this the comparison is NULL and the
-- first upload is refused).
DROP POLICY IF EXISTS "hh_tournaments_select_own" ON public.hh_tournaments;
CREATE POLICY "hh_tournaments_select_own" ON public.hh_tournaments
  FOR SELECT USING (
    auth.uid() = user_id
    AND (
      (SELECT public.hh_full_history())
      OR (SELECT (public.hh_latest_tournament()).id) IS NULL
      OR id = (SELECT (public.hh_latest_tournament()).id)
      OR created_at > (SELECT (public.hh_latest_tournament()).created_at)
    )
  );

DROP POLICY IF EXISTS "hh_hands_select_own" ON public.hh_hands;
CREATE POLICY "hh_hands_select_own" ON public.hh_hands
  FOR SELECT USING (
    auth.uid() = user_id
    AND (
      (SELECT public.hh_full_history())
      OR (site = (SELECT (public.hh_latest_tournament()).site)
          AND tournament_id = (SELECT (public.hh_latest_tournament()).tournament_id))
    )
  );

-- ── Entitlements — what the app shows and checks ───────────────────────────

CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          text := public.effective_plan(p_user_id, p_now);
  v_sub           public.subscriptions;
  v_day           date := public.amsterdam_day(p_now);
  v_hands         integer;
  v_ai            integer;
  v_uploads       integer;
  v_oldest_upload timestamptz;
  v_upload_limit  integer := public.usage_limit(v_plan, 'tournament_upload');
  v_hidden        integer := 0;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;

  SELECT COALESCE(sum(count) FILTER (WHERE metric = 'trainer_hand'), 0),
         COALESCE(sum(count) FILTER (WHERE metric = 'ai_question'), 0)
    INTO v_hands, v_ai
    FROM public.usage_daily
   WHERE user_id = p_user_id AND usage_date = v_day;

  SELECT count(*), min(created_at) INTO v_uploads, v_oldest_upload
    FROM public.usage_events
   WHERE user_id = p_user_id AND metric = 'tournament_upload'
     AND created_at > p_now - interval '7 days';

  IF v_plan = 'free' THEN
    SELECT GREATEST(count(*) - 1, 0) INTO v_hidden
      FROM public.hh_tournaments WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_ended', v_plan = 'free' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= p_now,
    'trial_ended_seen', v_sub.trial_ended_seen_at IS NOT NULL,
    'subscription', jsonb_build_object(
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
      'has_customer', v_sub.stripe_customer_id IS NOT NULL
    ),
    -- NULL = unlimited. Pro's AI fair-use cap is deliberately not exposed.
    'limits', jsonb_build_object(
      'trainer_hands_per_day', public.usage_limit(v_plan, 'trainer_hand'),
      'tournaments_per_week',  v_upload_limit,
      'ai_questions_per_day',  CASE WHEN v_plan = 'free' THEN public.usage_limit(v_plan, 'ai_question') END
    ),
    'usage', jsonb_build_object(
      'trainer_hands_today',   v_hands,
      'ai_questions_today',    v_ai,
      'tournaments_this_week', v_uploads
    ),
    'daily_reset_at', public.next_amsterdam_midnight(p_now),
    'next_upload_at', CASE WHEN v_upload_limit IS NOT NULL AND v_uploads >= v_upload_limit
                           THEN v_oldest_upload + interval '7 days' END,
    'hidden_tournaments', v_hidden
  );
END;
$$;

-- The signed-in user's own entitlements, callable straight from the browser
-- or a server component. Read-only.
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.get_entitlements(auth.uid()) END;
$$;

-- "Your trial ended" is shown once.
CREATE OR REPLACE FUNCTION public.mark_trial_ended_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subscriptions
     SET trial_ended_seen_at = COALESCE(trial_ended_seen_at, now()), updated_at = now()
   WHERE user_id = auth.uid();
$$;

-- ── Reverse trial on signup (email and Google alike) ───────────────────────
-- Only accounts created after this file runs get a trial: there is no
-- backfill for existing users.

CREATE OR REPLACE FUNCTION public.start_reverse_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, trial_ends_at)
  VALUES (NEW.id, now() + make_interval(days => COALESCE(public.plan_limit('trial_days'), 7)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_start_trial ON auth.users;
CREATE TRIGGER on_auth_user_start_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.start_reverse_trial();

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Functions are EXECUTE-able by PUBLIC by default; close that first.

REVOKE ALL ON FUNCTION public.plan_limit(text)                               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.effective_plan(uuid, timestamptz)               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.usage_limit(text, text)                         FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_usage(uuid, text, timestamptz)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_usage(uuid, text, timestamptz)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid, timestamptz)             FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.hh_tournaments_upload_limit()                   FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_reverse_trial()                           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_entitlements()                               FROM public, anon;
REVOKE ALL ON FUNCTION public.mark_trial_ended_seen()                         FROM public, anon;
REVOKE ALL ON FUNCTION public.hh_full_history()                               FROM public, anon;
REVOKE ALL ON FUNCTION public.hh_latest_tournament()                          FROM public, anon;

GRANT EXECUTE ON FUNCTION public.consume_usage(uuid, text, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.release_usage(uuid, text, timestamptz)       TO service_role;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid, timestamptz)          TO service_role;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid, timestamptz)            TO service_role;
GRANT EXECUTE ON FUNCTION public.my_entitlements()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_trial_ended_seen()                      TO authenticated;
-- Called by the hh_* RLS policies as the querying user.
GRANT EXECUTE ON FUNCTION public.hh_full_history()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_latest_tournament()                       TO authenticated;
