-- Tests for supabase_subscriptions.sql. Run with supabase/tests/run.sh
-- (throwaway local Postgres). Every check RAISEs on failure, so the run
-- stops at the first broken expectation.
--
-- Users
--   A  existing account (created before the migration): no trial, Free
--   P  existing account that pays (…0e; Stripe status set below)
--   D  the admin (development) account (…0d)
--   B  new account (created after the migration): reverse trial (…0b)

\set ON_ERROR_STOP on
\set QUIET on

CREATE SCHEMA test;
GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role;

CREATE FUNCTION test.eq(actual anyelement, expected anyelement, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'ok   %', label;
END $$;
GRANT EXECUTE ON FUNCTION test.eq(anyelement, anyelement, text) TO anon, authenticated, service_role;

-- Consume n units and return the last result.
CREATE FUNCTION test.consume_n(p_user uuid, p_metric text, n int, p_now timestamptz) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  FOR i IN 1..n LOOP r := public.consume_usage(p_user, p_metric, p_now); END LOOP;
  RETURN r;
END $$;

-- B signs up after the migration ran.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000000b', 'b@test');
INSERT INTO public.profiles (id) VALUES ('00000000-0000-0000-0000-00000000000b');

\echo '── plans and the reverse trial'
DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  d uuid := '00000000-0000-0000-0000-00000000000d';
  ends timestamptz;
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.subscriptions WHERE user_id = a), 0::bigint, 'existing account gets no trial');
  PERFORM test.eq(public.effective_plan(a), 'free', 'existing account is free');
  PERFORM test.eq(public.effective_plan(d), 'pro', 'admin counts as pro');

  SELECT trial_ends_at INTO ends FROM public.subscriptions WHERE user_id = b;
  PERFORM test.eq(ends BETWEEN now() + interval '7 days' - interval '1 minute' AND now() + interval '7 days', true, 'new account: trial ends in 7 days');
  PERFORM test.eq(public.effective_plan(b), 'trial', 'new account is on trial');
  PERFORM test.eq(public.effective_plan(b, ends - interval '1 second'), 'trial', 'trial: last second still trial');
  PERFORM test.eq(public.effective_plan(b, ends), 'free', 'trial over at trial_ends_at');
  PERFORM test.eq((public.get_entitlements(b, ends + interval '1 hour') ->> 'trial_ended')::boolean, true, 'entitlements: trial_ended after the trial');
  PERFORM test.eq((public.get_entitlements(b) ->> 'trial_ended')::boolean, false, 'entitlements: not ended during the trial');
  -- Trial has Pro limits: no hand limit.
  PERFORM test.eq(public.get_entitlements(b) -> 'limits' -> 'trainer_hands_per_day', 'null'::jsonb, 'trial: hands unlimited');
END $$;

\echo '── Preflop Trainer: 50 hands per Amsterdam day'
DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-00000000000a';
  -- 12:00 CEST on 13 Oct 2026
  t timestamptz := '2026-10-13 10:00:00+00';
  r jsonb;
BEGIN
  r := test.consume_n(a, 'trainer_hand', 49, t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'hand 49 allowed');
  PERFORM test.eq((r ->> 'used')::int, 49, 'hand 49: used 49');
  r := public.consume_usage(a, 'trainer_hand', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'hand 50 allowed');
  PERFORM test.eq((r ->> 'used')::int, 50, 'hand 50: used 50');
  r := public.consume_usage(a, 'trainer_hand', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, false, 'hand 51 refused');
  PERFORM test.eq((r ->> 'used')::int, 50, 'hand 51: count stays at 50');
  PERFORM test.eq((r ->> 'limit')::int, 50, 'limit reported as 50');
  PERFORM test.eq((r ->> 'reset_at')::timestamptz, '2026-10-13 22:00:00+00'::timestamptz, 'reset at 00:00 Amsterdam (22:00 UTC in summer time)');

  -- 23:59:59 Amsterdam is still the same day…
  r := public.consume_usage(a, 'trainer_hand', '2026-10-13 21:59:59+00');
  PERFORM test.eq((r ->> 'allowed')::boolean, false, '23:59:59 Amsterdam: still refused');
  -- …00:00:00 Amsterdam is a new one.
  r := public.consume_usage(a, 'trainer_hand', '2026-10-13 22:00:00+00');
  PERFORM test.eq((r ->> 'allowed')::boolean, true, '00:00 Amsterdam: new day');
  PERFORM test.eq((r ->> 'used')::int, 1, 'new day starts at 1');

  -- Winter time: midnight is 23:00 UTC.
  PERFORM test.eq(public.next_amsterdam_midnight('2026-12-01 12:00+00'), '2026-12-01 23:00:00+00'::timestamptz, 'winter: reset at 23:00 UTC');
  -- DST switch day (25 Oct 2026 has 25 hours).
  PERFORM test.eq(public.next_amsterdam_midnight('2026-10-25 12:00+00'), '2026-10-25 23:00:00+00'::timestamptz, 'DST switch day: next midnight correct');
  PERFORM test.eq(public.amsterdam_day('2026-10-13 21:59:59+00'), '2026-10-13'::date, 'amsterdam_day before midnight');
  PERFORM test.eq(public.amsterdam_day('2026-10-13 22:00:00+00'), '2026-10-14'::date, 'amsterdam_day after midnight');

  PERFORM test.eq((public.get_entitlements(a, t) -> 'usage' ->> 'trainer_hands_today')::int, 50, 'entitlements show 50 hands today');
END $$;

\echo '── AI Coach: 3 per day free, hidden 100 for Pro'
DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-00000000000a';
  p uuid := '00000000-0000-0000-0000-00000000000e';
  t timestamptz := '2026-10-14 08:00:00+00';
  r jsonb;
BEGIN
  r := test.consume_n(a, 'ai_question', 3, t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'question 3 allowed');
  r := public.consume_usage(a, 'ai_question', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, false, 'question 4 refused');
  PERFORM test.eq((r ->> 'used')::int, 3, 'question 4: used stays 3');

  -- release gives one back (failed LLM call), never below 0
  PERFORM public.release_usage(a, 'ai_question', t);
  r := public.consume_usage(a, 'ai_question', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'released slot can be used again');
  PERFORM public.release_usage(a, 'trainer_hand', '2030-01-01 12:00+00');
  PERFORM test.eq((SELECT count(*) FROM public.usage_daily WHERE user_id = a AND usage_date = '2030-01-01'), 0::bigint, 'release on an empty day is a no-op');

  INSERT INTO public.subscriptions (user_id, stripe_customer_id, status) VALUES (p, 'cus_test', 'active');
  PERFORM test.eq(public.effective_plan(p), 'pro', 'active subscription is pro');
  r := test.consume_n(p, 'ai_question', 100, t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'pro: question 100 allowed');
  r := public.consume_usage(p, 'ai_question', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, false, 'pro: question 101 refused (fair use)');
  PERFORM test.eq(public.get_entitlements(p) -> 'limits' -> 'ai_questions_per_day', 'null'::jsonb, 'pro: fair-use cap not exposed');
  r := test.consume_n(p, 'trainer_hand', 500, t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'pro: 500 hands allowed');

  UPDATE public.plan_limits SET value = 5 WHERE key = 'free_ai_questions_per_day';
  r := public.consume_usage(a, 'ai_question', t);
  PERFORM test.eq((r ->> 'allowed')::boolean, true, 'limits are configurable (3 → 5)');
  UPDATE public.plan_limits SET value = 3 WHERE key = 'free_ai_questions_per_day';
END $$;

\echo '── past_due: 3 days grace, then Free'
DO $$
DECLARE
  p uuid := '00000000-0000-0000-0000-00000000000e';
  since timestamptz := '2026-10-10 12:00:00+00';
BEGIN
  UPDATE public.subscriptions SET status = 'past_due', past_due_since = since WHERE user_id = p;
  PERFORM test.eq(public.effective_plan(p, since + interval '2 days'), 'pro', 'past_due day 2: still pro');
  PERFORM test.eq(public.effective_plan(p, since + interval '3 days' - interval '1 second'), 'pro', 'past_due: last second of grace');
  PERFORM test.eq(public.effective_plan(p, since + interval '3 days'), 'free', 'past_due after 3 days: free');
  UPDATE public.subscriptions SET past_due_since = NULL WHERE user_id = p;
  PERFORM test.eq(public.effective_plan(p), 'free', 'past_due without a start date: no grace');
  UPDATE public.subscriptions SET status = 'canceled' WHERE user_id = p;
  PERFORM test.eq(public.effective_plan(p), 'free', 'canceled: free');
  UPDATE public.subscriptions SET status = 'active', past_due_since = NULL WHERE user_id = p;
END $$;

\echo '── Hand Review: 1 tournament per rolling 7 days (as the signed-in user)'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset

-- A Free user's very first tournament, sent exactly like the importer does
-- (upsert): with no tournament yet there is no "latest" to compare against.
INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
VALUES ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T1', 'First')
ON CONFLICT (user_id, site, tournament_id) DO NOTHING;
\echo 'ok   first upload of a free user with no tournaments accepted'

DO $$
BEGIN
  INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T2', 'Second');
  RAISE EXCEPTION 'FAIL second upload within 7 days was accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'UPLOAD_LIMIT_REACHED' THEN
    RAISE NOTICE 'ok   upload 2 within 7 days refused';
  ELSE
    RAISE;
  END IF;
END $$;

-- Re-uploading the tournament you already have is not a new upload.
INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
VALUES ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T1', 'First')
ON CONFLICT (user_id, site, tournament_id) DO NOTHING;
\echo 'ok   re-upload of the same tournament accepted'

DO $$
DECLARE e jsonb := public.my_entitlements();
BEGIN
  PERFORM test.eq((e -> 'usage' ->> 'tournaments_this_week')::int, 1, 'entitlements: 1/1 upload this week');
  PERFORM test.eq((e ->> 'next_upload_at')::timestamptz IS NOT NULL, true, 'entitlements: next free upload date given');
  PERFORM test.eq(e ->> 'plan', 'free', 'my_entitlements returns my own plan');
END $$;

-- The client cannot hand itself an upload back.
DO $$
BEGIN
  DELETE FROM public.usage_events;
  PERFORM test.eq((SELECT count(*) FROM public.usage_events), 1::bigint, 'client cannot delete usage events');
END $$;

RESET ROLE;
-- Eight days later the slot is free again.
UPDATE public.usage_events SET created_at = now() - interval '8 days';
UPDATE public.hh_tournaments SET created_at = now() - interval '8 days';
SET ROLE authenticated;

-- Exactly what the importer sends: tournament upsert, then hands with RETURNING.
INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
VALUES ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T2', 'Second')
ON CONFLICT (user_id, site, tournament_id) DO NOTHING;
\echo 'ok   upload accepted again after 7 days'
INSERT INTO public.hh_hands (user_id, site, hand_id, tournament_id, played_at, small_blind, big_blind, player_count,
                             last_street, pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown,
                             hero_all_in, data, raw_text, parser, parser_version)
VALUES ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'H3', 'T2', now(), 1, 2, 6, 'preflop', 3, 1.5, 0, 0, false, false, false,
        '{}'::jsonb, 'x', 'test', 1)
ON CONFLICT (user_id, site, hand_id) DO NOTHING
RETURNING hand_id;

\echo '── Upload history: Free sees only the most recent tournament'
RESET ROLE;
INSERT INTO public.hh_hands (user_id, site, hand_id, tournament_id, played_at, small_blind, big_blind, player_count,
                             last_street, pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown,
                             hero_all_in, data, raw_text, parser, parser_version)
SELECT '00000000-0000-0000-0000-00000000000a', 'ggpoker', h, t, now(), 1, 2, 6, 'preflop', 3, 1.5, 0, 0, false, false, false,
       '{}'::jsonb, 'x', 'test', 1
FROM (VALUES ('H1', 'T1'), ('H2', 'T1')) v(h, t);
SET ROLE authenticated;

DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_tournaments), 1::bigint, 'free: 1 tournament visible');
  PERFORM test.eq((SELECT tournament_id FROM public.hh_tournaments), 'T2', 'free: it is the most recent upload');
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands), 1::bigint, 'free: only its hands visible');
  PERFORM test.eq((public.my_entitlements() ->> 'hidden_tournaments')::int, 1, 'entitlements: 1 tournament hidden');
END $$;

RESET ROLE;
INSERT INTO public.subscriptions (user_id, status) VALUES ('00000000-0000-0000-0000-00000000000a', 'active')
ON CONFLICT (user_id) DO UPDATE SET status = 'active';
SET ROLE authenticated;

DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_tournaments), 2::bigint, 'pro: full history visible');
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands), 3::bigint, 'pro: all hands visible');
END $$;

-- Pro uploads are unlimited.
INSERT INTO public.hh_tournaments (user_id, site, tournament_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T3'),
  ('00000000-0000-0000-0000-00000000000a', 'ggpoker', 'T4');
\echo 'ok   pro: several uploads in one week'

\echo '── Entitlements cannot be changed from the client'
DO $$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.subscriptions (user_id, status) VALUES ('00000000-0000-0000-0000-00000000000b', 'active');
    RAISE EXCEPTION 'FAIL client inserted a subscription';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   client cannot insert a subscription';
  END;

  UPDATE public.subscriptions SET status = 'active', trial_ends_at = now() + interval '1 year';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM test.eq(n, 0, 'client cannot update its subscription');

  UPDATE public.usage_daily SET count = 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM test.eq(n, 0, 'client cannot reset its usage');

  BEGIN
    PERFORM public.consume_usage('00000000-0000-0000-0000-00000000000a', 'trainer_hand');
    RAISE EXCEPTION 'FAIL client called consume_usage';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   client cannot call consume_usage';
  END;

  BEGIN
    PERFORM public.get_entitlements('00000000-0000-0000-0000-00000000000b');
    RAISE EXCEPTION 'FAIL client read another user''s entitlements';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   client cannot read another user''s entitlements';
  END;

  BEGIN
    PERFORM public.release_usage('00000000-0000-0000-0000-00000000000a', 'trainer_hand');
    RAISE EXCEPTION 'FAIL client called release_usage';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   client cannot call release_usage';
  END;

  PERFORM test.eq((SELECT count(*) FROM public.stripe_events), 0::bigint, 'client sees no webhook events');
END $$;
RESET ROLE;

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.my_entitlements();
    RAISE EXCEPTION 'FAIL anon called my_entitlements';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   anon cannot call my_entitlements';
  END;
END $$;
RESET ROLE;

\echo '── trial-ended screen is shown once'
RESET ROLE;
UPDATE public.subscriptions SET trial_ends_at = now() - interval '1 hour' WHERE user_id = '00000000-0000-0000-0000-00000000000b';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset
DO $$
BEGIN
  PERFORM test.eq((public.my_entitlements() ->> 'trial_ended')::boolean, true, 'B: trial ended');
  PERFORM test.eq((public.my_entitlements() ->> 'trial_ended_seen')::boolean, false, 'B: screen not seen yet');
  PERFORM public.mark_trial_ended_seen();
  PERFORM test.eq((public.my_entitlements() ->> 'trial_ended_seen')::boolean, true, 'B: screen marked seen');
END $$;
RESET ROLE;

\echo 'ALL BILLING SQL TESTS PASSED'
