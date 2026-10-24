-- Tests for supabase_hand_history_summary.sql (run after subscriptions.test.sql,
-- which creates the test schema and test.eq).
\set ON_ERROR_STOP on
\set QUIET on

-- S: a Free user (trial over) with two tournaments. X: someone else.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 's@test'),
  ('00000000-0000-0000-0000-0000000005a2', 'x@test');
INSERT INTO public.profiles (id) VALUES ('00000000-0000-0000-0000-0000000005a1'), ('00000000-0000-0000-0000-0000000005a2');
UPDATE public.subscriptions SET trial_ends_at = now() - interval '1 day'
 WHERE user_id IN ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2');

-- Fixture rows straight in (no upload-limit trigger): an older scored
-- tournament A, the latest B, and X's tournament.
SET session_replication_role = replica;
INSERT INTO public.hh_tournaments (id, user_id, site, tournament_id, name, hand_count, last_hand_at, created_at, score) VALUES
  ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a1', 'ggpoker', 'A', 'Daily 10', 80, '2026-10-01 22:00', now() - interval '20 days', 88),
  ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000005a1', 'ggpoker', 'B', 'Daily 20', 95, '2026-10-20 22:00', now() - interval '1 day', NULL),
  ('50000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000005a2', 'ggpoker', 'C', 'Other', 50, '2026-10-10 22:00', now() - interval '2 days', 70);
SET session_replication_role = DEFAULT;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000005a1', false) \gset

\echo '── tournament summary: written through the RPC, own tournament only'
DO $$
BEGIN
  PERFORM test.eq(public.hh_set_tournament_summary('50000000-0000-0000-0000-00000000000b', 91::smallint, '{"version":"1-x","handCount":95}'::jsonb, '1-x'), true, 'own tournament');
  PERFORM test.eq((SELECT score FROM public.hh_tournaments WHERE id = '50000000-0000-0000-0000-00000000000b'), 91::smallint, 'score stored');
  PERFORM test.eq((SELECT summary ->> 'handCount' FROM public.hh_tournaments WHERE id = '50000000-0000-0000-0000-00000000000b'), '95', 'summary stored');
  PERFORM test.eq((SELECT summary_at IS NOT NULL FROM public.hh_tournaments WHERE id = '50000000-0000-0000-0000-00000000000b'), true, 'summary_at set');
  PERFORM test.eq(public.hh_set_tournament_summary('50000000-0000-0000-0000-00000000000c', 10::smallint, '{}'::jsonb, '1-x'), false, 'someone else''s tournament: no row');
END $$;

\echo '── score must be 0–100'
DO $$
BEGIN
  PERFORM public.hh_set_tournament_summary('50000000-0000-0000-0000-00000000000b', 101::smallint, '{}'::jsonb, '1-x');
  RAISE EXCEPTION 'FAIL: score 101 accepted';
EXCEPTION WHEN check_violation THEN
  NULL;
END $$;

\echo '── previous score: visible on Free although the tournament itself is not'
DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_tournaments), 1::bigint, 'Free sees only the latest tournament');
  PERFORM test.eq((SELECT score FROM public.hh_previous_tournament_score('50000000-0000-0000-0000-00000000000b')), 88::smallint, 'previous score');
  PERFORM test.eq((SELECT name FROM public.hh_previous_tournament_score('50000000-0000-0000-0000-00000000000b')), 'Daily 10', 'previous name');
  PERFORM test.eq((SELECT count(*) FROM public.hh_previous_tournament_score('50000000-0000-0000-0000-00000000000a')), 0::bigint, 'nothing before the first');
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000005a2', false) \gset
DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_previous_tournament_score('50000000-0000-0000-0000-00000000000b')), 0::bigint, 'not for someone else''s tournament');
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  PERFORM public.hh_previous_tournament_score('50000000-0000-0000-0000-00000000000b');
  RAISE EXCEPTION 'FAIL: anon may call hh_previous_tournament_score';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
RESET ROLE;

\echo 'tournament summary tests passed'
