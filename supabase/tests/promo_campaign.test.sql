-- Tests for supabase/migrations/20261025_01_promo_3m_50.sql (run by supabase/tests/run.sh).
-- New auth.users rows get a 7-day reverse trial from the signup trigger
-- (supabase_subscriptions.sql); each fixture below rewrites that row into
-- the state it stands for.
\set ON_ERROR_STOP on
\set QUIET on

-- The legacy Stripe mirror on profiles (supabase/migrations/add_stripe_columns.sql).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

INSERT INTO auth.users (id, email, created_at, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000007b1', 'ended@test',            '2026-09-01 10:00Z', '{"full_name": "Erin Ended"}'),
  ('00000000-0000-0000-0000-0000000007b2', 'notrial@test',          '2026-01-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b3', 'ontrial@test',          '2026-10-20 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b4', 'pro@test',              '2026-08-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b5', 'churned@test',          '2026-08-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b6', 'legacy@test',           '2026-02-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b7', 'optout@promo.test',     '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b8', 'unconfirmed@promo.test','2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007b9', 'already@test',          '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007ba', 'day7@test',             '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007bb', 'bot@example.invalid',   '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007bc', 'tierpro@test',          '2026-03-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007bd', 'deleted@test',          '2026-09-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007be', 'grace@test',            '2026-08-01 10:00Z', '{}'),
  ('00000000-0000-0000-0000-0000000007bf', 'incomplete@test',       '2026-09-01 10:00Z', '{}');
INSERT INTO public.profiles (id, subscription_tier)
SELECT id, 'free' FROM auth.users WHERE id::text LIKE '00000000-0000-0000-0000-0000000007b_'
ON CONFLICT (id) DO NOTHING;

-- Trial ended, never paid: the audience this campaign is for.
UPDATE public.subscriptions SET trial_ends_at = now() - interval '20 days' WHERE user_id = '00000000-0000-0000-0000-0000000007b1';
-- Signed up before reverse trials existed: no subscriptions row at all.
DELETE FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-0000000007b2';
-- b3 keeps the running trial from the signup trigger.
UPDATE public.subscriptions SET stripe_customer_id = 'cus_pro', stripe_subscription_id = 'sub_pro', status = 'active',
       trial_ends_at = now() - interval '60 days' WHERE user_id = '00000000-0000-0000-0000-0000000007b4';
UPDATE public.subscriptions SET stripe_customer_id = 'cus_churned', stripe_subscription_id = 'sub_churned', status = 'canceled',
       trial_ends_at = now() - interval '60 days' WHERE user_id = '00000000-0000-0000-0000-0000000007b5';
DELETE FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-0000000007b6';
UPDATE public.profiles SET stripe_customer_id = 'cus_legacy' WHERE id = '00000000-0000-0000-0000-0000000007b6';
UPDATE public.subscriptions SET trial_ends_at = now() - interval '10 days'
 WHERE user_id IN ('00000000-0000-0000-0000-0000000007b7', '00000000-0000-0000-0000-0000000007b8',
                   '00000000-0000-0000-0000-0000000007b9', '00000000-0000-0000-0000-0000000007ba',
                   '00000000-0000-0000-0000-0000000007bb', '00000000-0000-0000-0000-0000000007bd');
UPDATE public.profiles SET email_opt_out = true WHERE id = '00000000-0000-0000-0000-0000000007b7';
UPDATE auth.users SET email_confirmed_at = NULL WHERE id = '00000000-0000-0000-0000-0000000007b8';
INSERT INTO public.email_log (user_id, template) VALUES
  ('00000000-0000-0000-0000-0000000007b9', 'promo_3m_50'),
  ('00000000-0000-0000-0000-0000000007ba', 'day7');
DELETE FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-0000000007bc';
UPDATE public.profiles SET subscription_tier = 'pro' WHERE id = '00000000-0000-0000-0000-0000000007bc';
UPDATE auth.users SET deleted_at = now() - interval '1 day' WHERE id = '00000000-0000-0000-0000-0000000007bd';
-- Failed payment, still inside the 3-day grace window.
UPDATE public.subscriptions SET stripe_customer_id = 'cus_grace', stripe_subscription_id = 'sub_grace', status = 'past_due',
       past_due_since = now() - interval '1 day', trial_ends_at = now() - interval '60 days'
 WHERE user_id = '00000000-0000-0000-0000-0000000007be';
-- Finished checkout but the first payment never went through: a Stripe customer, so out.
UPDATE public.subscriptions SET stripe_customer_id = 'cus_incomplete', stripe_subscription_id = 'sub_incomplete', status = 'incomplete_expired',
       trial_ends_at = now() - interval '20 days' WHERE user_id = '00000000-0000-0000-0000-0000000007bf';

CREATE FUNCTION test.promo_has(p_user uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM public.promo_email_candidates('promo_3m_50') c WHERE c.user_id = p_user);
$$;

\echo '── promo campaign: audience'
DO $$
DECLARE
  r record;
BEGIN
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b1'), true,  'trial ended, never paid: included');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b2'), true,  'free account without a subscriptions row: included');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007ba'), true,  'a lifecycle email (day7) does not count as this campaign');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b3'), false, 'running trial: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b4'), false, 'active Pro: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b5'), false, 'past payer (canceled): excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b6'), false, 'legacy profiles.stripe_customer_id: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b7'), false, 'opted out: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b8'), false, 'unconfirmed email: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b9'), false, 'already got promo_3m_50: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007bb'), false, '@example.invalid: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007bc'), false, 'tier pro without a subscription: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007bd'), false, 'deleted account: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007be'), false, 'past_due in grace: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007bf'), false, 'Stripe customer whose first payment failed: excluded');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-00000000000d'), false, 'admin account: excluded');

  PERFORM test.eq(
    (SELECT count(*) FROM public.promo_email_candidates('promo_3m_50')),
    (SELECT count(DISTINCT c.user_id) FROM public.promo_email_candidates('promo_3m_50') c),
    'every user at most once');
  PERFORM test.eq(
    (SELECT count(*) FROM public.promo_email_candidates('promo_3m_50') c WHERE c.plan <> 'free'), 0::bigint,
    'only effective_plan = free');

  SELECT * INTO r FROM public.promo_email_candidates('promo_3m_50') c WHERE c.user_id = '00000000-0000-0000-0000-0000000007b1';
  PERFORM test.eq(r.email, 'ended@test', 'email returned');
  PERFORM test.eq(r.name, 'Erin Ended', 'name from user metadata');
  PERFORM test.eq(r.timezone, 'Europe/Amsterdam', 'default time zone');

  -- A trial that ends tomorrow is still a trial today, and free once it has ended.
  PERFORM test.eq(
    EXISTS (SELECT 1 FROM public.promo_email_candidates('promo_3m_50', now() + interval '8 days') c
             WHERE c.user_id = '00000000-0000-0000-0000-0000000007b3'),
    true, 'trial over at p_now: included');
END $$;

\echo '── promo campaign: email_log'
DO $$
BEGIN
  INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000007b1', 'promo_3m_50');
  PERFORM test.eq(test.promo_has('00000000-0000-0000-0000-0000000007b1'), false, 'logged send removes the user from the audience');
  BEGIN
    INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000007b1', 'promo_3m_50');
    RAISE EXCEPTION 'FAIL second promo_3m_50 row for one user was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'ok   one promo_3m_50 row per user (unique)';
  END;
  BEGIN
    INSERT INTO public.email_log (user_id, template) VALUES ('00000000-0000-0000-0000-0000000007b2', 'promo_typo');
    RAISE EXCEPTION 'FAIL unknown template accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok   unknown template refused';
  END;
END $$;

\echo '── promo campaign: grants'
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM public.promo_email_candidates('promo_3m_50');
  RAISE EXCEPTION 'FAIL authenticated may read the promo audience';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok   authenticated cannot read the promo audience';
END $$;
RESET ROLE;
