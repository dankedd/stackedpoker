-- Tests for supabase_hand_history_preflop_defense.sql (run by supabase/tests/run.sh,
-- after manual_hands.test.sql, whose user f1 and hands it reuses).
\set ON_ERROR_STOP on
\set QUIET on

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false) \gset

\echo '── preflop_spot follows preflop_detail'
SELECT public.hh_set_preflop_checks(jsonb_build_array(
  jsonb_build_object('id', '10000000-0000-0000-0000-000000000001', 'preflop_check', 'too_tight', 'preflop_position', 'BB',
                     'preflop_detail', '{"spot":{"kind":"vs_open"}}'::jsonb, 'preflop_version', '3-test'),
  jsonb_build_object('id', '20000000-0000-0000-0000-000000000001', 'preflop_check', 'correct', 'preflop_position', 'BB',
                     'preflop_detail', '{"spot":{"kind":"vs_push"}}'::jsonb, 'preflop_version', '3-test'),
  jsonb_build_object('id', '20000000-0000-0000-0000-000000000002', 'preflop_check', 'correct', 'preflop_position', 'BN',
                     'preflop_detail', '{"spot":{"kind":"rfi"}}'::jsonb, 'preflop_version', '3-test')
)) \gset

DO $$
BEGIN
  PERFORM test.eq((SELECT preflop_spot FROM public.hh_hands WHERE id = '10000000-0000-0000-0000-000000000001'), 'vs_open', 'generated from the detail');
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands WHERE preflop_spot IN ('vs_open', 'vs_push')), 2::bigint, 'filterable by spot kind');
  PERFORM test.eq((SELECT preflop_spot FROM public.hh_hands WHERE id = '20000000-0000-0000-0000-000000000003'), NULL::text, 'NULL without a check');
END $$;

\echo '── summary groups by spot kind'
DO $$
BEGIN
  PERFORM test.eq((SELECT n FROM public.hh_preflop_summary() WHERE preflop_spot = 'vs_open' AND preflop_check = 'too_tight'), 1::bigint, 'vs_open too_tight counted');
  PERFORM test.eq((SELECT sum(n)::bigint FROM public.hh_preflop_summary()), (SELECT count(*) FROM public.hh_hands WHERE preflop_check IS NOT NULL), 'only checked hands, all of them');
END $$;

\echo '── only your own hands'
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false) \gset
DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_preflop_summary()), 0::bigint, 'someone else sees nothing');
END $$;

RESET ROLE;
