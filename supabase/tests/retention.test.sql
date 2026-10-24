-- Tests for supabase_retention.sql (run by supabase/tests/run.sh).
-- "Now" is pinned to 2026-10-20 12:00 UTC = 14:00 in Amsterdam (CEST, UTC+2)
-- and 13:00 in London (BST, UTC+1).
\set ON_ERROR_STOP on
\set QUIET on

INSERT INTO auth.users (id, email, created_at, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'streak@test',          '2026-10-15 10:00Z', '{"full_name": "Sam Streak"}'),
  ('00000000-0000-0000-0000-0000000005a2', 'yesterday@test',       '2026-10-18 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a3', 'lapsed@test',          '2026-10-13 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a4', 'london@test',          '2026-10-19 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a5', 'robot@example.invalid','2026-10-19 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a6', 'old@test',             '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a7', 'optout@test',          '2026-10-19 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a8', 'unconfirmed@test',     '2026-10-19 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000005a9', 'admin@test',           '2026-10-19 10:00Z', '{}');
UPDATE auth.users SET email_confirmed_at = NULL WHERE id = '00000000-0000-0000-0000-0000000005a8';
INSERT INTO public.profiles (id, subscription_tier) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'free'),
  ('00000000-0000-0000-0000-0000000005a2', 'free'),
  ('00000000-0000-0000-0000-0000000005a3', 'free'),
  ('00000000-0000-0000-0000-0000000005a4', 'free'),
  ('00000000-0000-0000-0000-0000000005a5', 'free'),
  ('00000000-0000-0000-0000-0000000005a6', 'free'),
  ('00000000-0000-0000-0000-0000000005a7', 'free'),
  ('00000000-0000-0000-0000-0000000005a8', 'free'),
  ('00000000-0000-0000-0000-0000000005a9', 'admin');
UPDATE public.profiles SET email_opt_out = true WHERE id = '00000000-0000-0000-0000-0000000005a7';
UPDATE public.profiles SET timezone = 'Europe/London' WHERE id = '00000000-0000-0000-0000-0000000005a4';

-- f1: active today, yesterday and 3 days ago → streak 2 (the gap ends it).
INSERT INTO public.xp_events (user_id, amount, source_type, earned_at) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 1, 'preflop_trainer', '2026-10-20 09:00Z'),
  ('00000000-0000-0000-0000-0000000005a1', 1, 'preflop_trainer', '2026-10-19 09:00Z'),
  ('00000000-0000-0000-0000-0000000005a1', 1, 'preflop_trainer', '2026-10-17 09:00Z');
-- f1 drilled 4 hands of one push/fold chart (3 wrong) and 3 opens (all good).
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'pushfold:301:8:A5s', 'wrong',   '2026-10-20 09:01Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'pushfold:301:6:K9o', 'wrong',   '2026-10-20 09:02Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'pushfold:301:4:Q2s', 'wrong',   '2026-10-20 09:03Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'pushfold:301:9:AA',  'correct', '2026-10-20 09:04Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'open:112::AKs',      'correct', '2026-10-20 09:05Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'open:112::72o',      'correct', '2026-10-20 09:06Z'),
  ('00000000-0000-0000-0000-0000000005a1', 'open:112::JTs',      'mixed',   '2026-10-20 09:07Z');
-- f2: only a wrong trainer hand yesterday (no xp_event) → still a 1-day streak.
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at) VALUES
  ('00000000-0000-0000-0000-0000000005a2', 'open:112::72o', 'wrong', '2026-10-19 18:00Z');
-- f3: last active 3 days ago → streak 0. Played before the log existed.
INSERT INTO public.xp_events (user_id, amount, source_type, earned_at) VALUES
  ('00000000-0000-0000-0000-0000000005a3', 1, 'preflop_trainer', '2026-10-17 09:00Z'),
  ('00000000-0000-0000-0000-0000000005a3', 2, 'preflop_trainer', '2026-10-17 09:01Z'),
  ('00000000-0000-0000-0000-0000000005a3', 50, 'lesson_completion', '2026-10-17 09:30Z');
INSERT INTO public.trainer_highscores (user_id, trainer_key, hands_played) VALUES
  ('00000000-0000-0000-0000-0000000005a3', 'preflop-ranges', 5);
-- f4 (London): 22:30 UTC on the 19th is 23:30 the 19th in London, 00:30 the 20th in Amsterdam.
INSERT INTO public.xp_events (user_id, amount, source_type, earned_at) VALUES
  ('00000000-0000-0000-0000-0000000005a4', 1, 'preflop_trainer', '2026-10-19 22:30Z');
-- Not in the candidate list, whatever they did.
INSERT INTO public.email_log (user_id, template, sent_at) VALUES
  ('00000000-0000-0000-0000-0000000005a3', 'day1', '2026-10-14 16:00Z'),
  ('00000000-0000-0000-0000-0000000005a3', 'day3', '2026-10-16 16:00Z');

\echo '── retention: streaks'
DO $$
DECLARE
  n timestamptz := '2026-10-20 12:00Z';
  s jsonb;
BEGIN
  s := public.activity_streak('00000000-0000-0000-0000-0000000005a1', n);
  PERFORM test.eq((s ->> 'streak')::int, 2, 'today + yesterday = 2, the gap before ends it');
  PERFORM test.eq((s ->> 'active_today')::boolean, true, 'active today');

  s := public.activity_streak('00000000-0000-0000-0000-0000000005a2', n);
  PERFORM test.eq((s ->> 'streak')::int, 1, 'a wrong trainer hand yesterday keeps a 1-day streak alive');
  PERFORM test.eq((s ->> 'active_today')::boolean, false, 'not active today yet');

  s := public.activity_streak('00000000-0000-0000-0000-0000000005a3', n);
  PERFORM test.eq((s ->> 'streak')::int, 0, 'nothing yesterday or today = 0');

  s := public.activity_streak('00000000-0000-0000-0000-0000000005a4', n);
  PERFORM test.eq(s ->> 'timezone', 'Europe/London', 'stored zone used');
  PERFORM test.eq((s ->> 'active_today')::boolean, false, 'London: 23:30 yesterday is not today');
  PERFORM test.eq((s ->> 'streak')::int, 1, 'London: yesterday counts');

  UPDATE public.profiles SET timezone = NULL WHERE id = '00000000-0000-0000-0000-0000000005a4';
  s := public.activity_streak('00000000-0000-0000-0000-0000000005a4', n);
  PERFORM test.eq((s ->> 'active_today')::boolean, true, 'default Amsterdam: 00:30 today is today');
  UPDATE public.profiles SET timezone = 'Europe/London' WHERE id = '00000000-0000-0000-0000-0000000005a4';

  -- Before any activity at all.
  s := public.activity_streak('00000000-0000-0000-0000-0000000005a9', n);
  PERFORM test.eq((s ->> 'streak')::int, 0, 'no activity = 0');
  PERFORM test.eq((s ->> 'active_today')::boolean, false, 'no activity = not active');
END $$;

\echo '── retention: candidates'
DO $$
DECLARE
  n timestamptz := '2026-10-20 12:00Z';
  r record;
BEGIN
  PERFORM test.eq(
    (SELECT string_agg(c.email, ',' ORDER BY c.signed_up_at) FROM public.lifecycle_email_candidates(n) c),
    'lapsed@test,streak@test,yesterday@test,london@test',
    'excludes example.invalid, >15 days, opted out, unconfirmed and admin');

  SELECT * INTO r FROM public.lifecycle_email_candidates(n) c WHERE c.email = 'streak@test';
  PERFORM test.eq(r.name, 'Sam Streak', 'name from signup metadata');
  PERFORM test.eq(r.hands_total, 7, 'hands from the log');
  PERFORM test.eq(r.hands_good, 4, 'correct + mixed');
  PERFORM test.eq(r.hands_source, 'log', 'exact');
  PERFORM test.eq(r.weakest_ref, 'pushfold:301', 'weakest = the chart with the worst wrong rate');
  PERFORM test.eq(r.weakest_wrong, 3, 'its mistakes');
  PERFORM test.eq(r.weakest_hands, 4, 'its hands');
  PERFORM test.eq(r.active_today, true, 'active today');
  PERFORM test.eq(r.streak, 2, 'streak carried');
  PERFORM test.eq(r.last_active_at, '2026-10-20 09:07Z'::timestamptz, 'last activity = latest of xp and log');

  SELECT * INTO r FROM public.lifecycle_email_candidates(n) c WHERE c.email = 'lapsed@test';
  PERFORM test.eq(r.hands_source, 'estimate', 'no log rows = estimate');
  PERFORM test.eq(r.hands_total, 5, 'estimate total from trainer_highscores');
  PERFORM test.eq(r.hands_good, 2, 'estimate good = trainer xp_events only');
  PERFORM test.eq(r.weakest_ref, NULL::text, 'no weakest spot without the log');
  PERFORM test.eq(r.emails_sent ? 'day1' AND r.emails_sent ? 'day3', true, 'emails sent listed');
  PERFORM test.eq(r.last_email_at, '2026-10-16 16:00Z'::timestamptz, 'last email');

  SELECT * INTO r FROM public.lifecycle_email_candidates(n) c WHERE c.email = 'yesterday@test';
  PERFORM test.eq(r.weakest_ref, NULL::text, 'one hand is not a weakest spot');
  PERFORM test.eq(r.emails_sent, '{}'::jsonb, 'nothing sent = {}');
  PERFORM test.eq(r.last_active_at, '2026-10-19 18:00Z'::timestamptz, 'a 0-XP hand is activity');

  -- The past is the past: activity after "now" is ignored.
  PERFORM test.eq(
    (SELECT c.last_active_at FROM public.lifecycle_email_candidates('2026-10-18 12:00Z') c WHERE c.email = 'streak@test'),
    '2026-10-17 09:00Z'::timestamptz, 'pinned now ignores later activity');

  BEGIN
    INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000005a3', 'day1');
    RAISE EXCEPTION 'FAIL logged the same template twice';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'ok   one row per (user, template)';
  END;
END $$;

\echo '── retention: what a signed-in user can do'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000005a2', false) \gset

DO $$
BEGIN
  PERFORM test.eq(public.my_streak() ? 'streak', true, 'my_streak callable');
  PERFORM test.eq(public.set_my_timezone('Not/AZone'), false, 'unknown zone refused');
  PERFORM test.eq(public.set_my_timezone('America/New_York'), true, 'known zone stored');
  PERFORM test.eq(public.set_email_opt_out(true), true, 'opt out');
  PERFORM test.eq((SELECT count(*) FROM public.email_log), 0::bigint, 'email_log is invisible to users');

  BEGIN
    PERFORM public.lifecycle_email_candidates();
    RAISE EXCEPTION 'FAIL a user could list candidates';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   candidates are service-role only';
  END;
  BEGIN
    PERFORM public.activity_streak('00000000-0000-0000-0000-0000000005a1');
    RAISE EXCEPTION 'FAIL a user could read someone else''s streak';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   other users'' streaks are private';
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  PERFORM test.eq((SELECT timezone FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000005a2'), 'America/New_York', 'zone saved');
  PERFORM test.eq((SELECT email_opt_out AND email_opt_out_at IS NOT NULL FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000005a2'), true, 'opt-out saved with time');
  PERFORM test.eq((SELECT count(*) FROM public.lifecycle_email_candidates('2026-10-20 12:00Z') c WHERE c.email = 'yesterday@test'), 0::bigint, 'opted-out user leaves the candidates');
  PERFORM test.eq((SELECT email_opt_out FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000005a1'), false, 'other users untouched');
END $$;

\echo '── retention: trial_ending facts'
DO $$
BEGIN
  -- streak@test is on a trial ending 2026-10-22 12:00Z; lapsed@test upgraded.
  UPDATE public.subscriptions SET trial_ends_at = '2026-10-22 12:00Z' WHERE user_id = '00000000-0000-0000-0000-0000000005a1';
  UPDATE public.subscriptions SET trial_ends_at = '2026-10-22 12:00Z', status = 'active' WHERE user_id = '00000000-0000-0000-0000-0000000005a3';
  PERFORM test.eq((SELECT c.plan FROM public.lifecycle_email_candidates('2026-10-20 12:00Z') c WHERE c.email = 'streak@test'), 'trial', 'trial user: plan trial');
  PERFORM test.eq((SELECT c.trial_ends_at FROM public.lifecycle_email_candidates('2026-10-20 12:00Z') c WHERE c.email = 'streak@test'), '2026-10-22 12:00Z'::timestamptz, 'trial end passed through');
  PERFORM test.eq((SELECT c.plan FROM public.lifecycle_email_candidates('2026-10-20 12:00Z') c WHERE c.email = 'lapsed@test'), 'pro', 'upgraded user: plan pro');
  PERFORM test.eq((SELECT c.plan FROM public.lifecycle_email_candidates('2026-10-23 12:00Z') c WHERE c.email = 'streak@test'), 'free', 'after the trial: plan free');
  INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000005a1', 'trial_ending');
  PERFORM test.eq((SELECT c.emails_sent ? 'trial_ending' FROM public.lifecycle_email_candidates('2026-10-20 12:00Z') c WHERE c.email = 'streak@test'), true, 'trial_ending is logged');
  BEGIN
    INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000005a1', 'bogus');
    RAISE EXCEPTION 'FAIL unknown template accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok   unknown templates refused';
  END;
END $$;
