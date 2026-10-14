-- Tests for supabase_onboarding.sql (run by supabase/tests/run.sh).
\set ON_ERROR_STOP on
\set QUIET on

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test');

\echo '── onboarding: users own exactly their row'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false) \gset

INSERT INTO public.user_onboarding (user_id, onboarding_choice, onboarding_choice_seen_at)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'preflop', now());

UPDATE public.user_onboarding SET tour_preflop_completed_at = now() WHERE user_id = '00000000-0000-0000-0000-0000000000c1';

DO $$
DECLARE n int;
BEGIN
  PERFORM test.eq((SELECT onboarding_choice FROM public.user_onboarding), 'preflop', 'own row readable');
  PERFORM test.eq((SELECT tour_preflop_completed_at IS NOT NULL FROM public.user_onboarding), true, 'own row updatable');

  BEGIN
    INSERT INTO public.user_onboarding (user_id, onboarding_choice) VALUES ('00000000-0000-0000-0000-0000000000c2', 'skip');
    RAISE EXCEPTION 'FAIL wrote another user''s onboarding row';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   cannot create a row for someone else';
  END;

  BEGIN
    INSERT INTO public.user_onboarding (user_id, onboarding_choice) VALUES ('00000000-0000-0000-0000-0000000000c1', 'learn')
    ON CONFLICT (user_id) DO UPDATE SET onboarding_choice = EXCLUDED.onboarding_choice;
    RAISE EXCEPTION 'FAIL accepted an unknown choice';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok   unknown choice rejected';
  END;
END $$;

RESET ROLE;
INSERT INTO public.user_onboarding (user_id, onboarding_choice) VALUES ('00000000-0000-0000-0000-0000000000c2', 'hands');
SET ROLE authenticated;

DO $$
DECLARE n int;
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.user_onboarding), 1::bigint, 'other users'' rows invisible');
  UPDATE public.user_onboarding SET onboarding_choice = 'skip' WHERE user_id = '00000000-0000-0000-0000-0000000000c2';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM test.eq(n, 0, 'cannot update someone else''s row');
END $$;
RESET ROLE;

\echo 'ALL ONBOARDING SQL TESTS PASSED'
