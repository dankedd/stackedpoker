-- Tests for supabase_hand_history_flop.sql (run by supabase/tests/run.sh,
-- after manual_hands.test.sql, whose users f1/f2 and hands it reuses).
\set ON_ERROR_STOP on
\set QUIET on

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false) \gset

\echo '── flop checks: written through the RPC, own hands only'
SELECT public.hh_set_flop_checks(jsonb_build_array(
  jsonb_build_object('id', '10000000-0000-0000-0000-000000000001', 'flop_check', 'questionable',
                     'flop_detail', '{"spot_id":"srp_bb_vs_bn_25","line":{"kind":"cbet"}}'::jsonb, 'flop_version', '1')
)) \gset

DO $$
BEGIN
  PERFORM test.eq((SELECT flop_check FROM public.hh_hands WHERE id = '10000000-0000-0000-0000-000000000001'), 'questionable', 'stored');
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands WHERE flop_check = 'questionable'), 1::bigint, 'filterable');
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false) \gset
DO $$
BEGIN
  PERFORM test.eq(public.hh_set_flop_checks(jsonb_build_array(
    jsonb_build_object('id', '10000000-0000-0000-0000-000000000001', 'flop_check', 'good', 'flop_detail', '{}'::jsonb, 'flop_version', '1'))), 0, 'someone else cannot write');
END $$;

RESET ROLE;
DO $$
BEGIN
  PERFORM test.eq((SELECT flop_check FROM public.hh_hands WHERE id = '10000000-0000-0000-0000-000000000001'), 'questionable', 'unchanged by the other user');
  -- The constraint (as the table owner: RLS would hide the row from a plain user).
  BEGIN
    UPDATE public.hh_hands SET flop_check = 'wrong' WHERE id = '10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAIL invalid verdict accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok   only good / ok / questionable / not_evaluated';
  END;
END $$;
