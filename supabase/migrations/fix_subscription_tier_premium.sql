-- ============================================================
-- Migration: Allow 'premium' (Elite) in profiles.subscription_tier
-- Run this once in your Supabase SQL Editor (Dashboard → SQL)
--
-- Bug this fixes: backend/app/api/routes/stripe_routes.py's webhook
-- handlers have always written subscription_tier: "premium" for Elite
-- purchases, but the CHECK constraint (see supabase_schema.sql /
-- supabase_migration_usage.sql) only ever allowed ('free','pro','admin').
-- PostgREST silently rejects the disallowed write (logged, never raised),
-- so an Elite purchase upgraded billing in Stripe but never actually
-- upgraded the user's tier in the app. This migration makes 'premium' a
-- legal value so those writes succeed.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro', 'premium', 'admin'));

-- Give any user whose tier previously failed to write 'premium' the
-- unlimited analyses_limit they were already entitled to via Stripe —
-- harmless no-op for accounts unaffected by the bug (subscription_status
-- comes from add_stripe_columns.sql, applied earlier).
UPDATE public.profiles
  SET analyses_limit = 2147483647
  WHERE subscription_tier = 'premium'
    AND (analyses_limit IS NULL OR analyses_limit < 2147483647);

-- Keep my_usage's is_unlimited CASE (defined in supabase_migration_usage.sql)
-- in sync with the newly-legal 'premium' value.
CREATE OR REPLACE VIEW public.my_usage AS
SELECT
  subscription_tier  AS plan,
  hands_analyzed_count AS analyses_used,
  analyses_limit,
  CASE
    WHEN subscription_tier IN ('admin', 'pro', 'premium') THEN true
    ELSE false
  END AS is_unlimited
FROM public.profiles
WHERE id = auth.uid();
