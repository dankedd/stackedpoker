-- ============================================================
-- One-time promo email: 50% off Pro for 3 months ('promo_3m_50')
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.
-- Run AFTER supabase_retention.sql (email_log, profiles.email_opt_out) and
-- supabase_subscriptions.sql (subscriptions, effective_plan).
--
-- What lives here
--   email_log.template      widened with 'promo_3m_50' (the same list is in
--                           supabase_retention.sql, so re-running that file
--                           keeps it)
--   promo_email_candidates(template)
--                           who may get a one-time promo email; the send
--                           script (frontend/scripts/promo-3m-50.ts) mails
--                           exactly these rows
--
-- The audience: confirmed, not deleted, not opted out, on Free right now
-- (effective_plan = 'free': no Pro, no running trial, no past_due grace),
-- never a paying customer, and not already sent this template. Users whose
-- reverse trial ended without paying are included.
--
-- "Never a paying customer" is read wide on purpose — any trace of Stripe
-- excludes the user: a subscriptions row with a Stripe customer,
-- subscription or status, or the legacy profiles.stripe_* /
-- subscription_status columns (read through to_jsonb so the function also
-- works where add_stripe_columns.sql never ran), or a tier other than free.
-- ============================================================

ALTER TABLE public.email_log DROP CONSTRAINT IF EXISTS email_log_template_check;
ALTER TABLE public.email_log ADD CONSTRAINT email_log_template_check
  CHECK (template IN ('day1', 'day3', 'day7', 'trial_ending', 'promo_3m_50'));

CREATE OR REPLACE FUNCTION public.promo_email_candidates(p_template text, p_now timestamptz DEFAULT now())
RETURNS TABLE(
  user_id   uuid,
  email     text,
  name      text,
  timezone  text,
  -- effective_plan() at p_now; always 'free' here, returned so the script can re-check.
  plan      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id,
         au.email,
         NULLIF(btrim(COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name')), ''),
         public.user_tz(au.id),
         public.effective_plan(au.id, p_now)
    FROM auth.users au
    JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.subscriptions s ON s.user_id = au.id
   WHERE au.email IS NOT NULL
     AND au.email_confirmed_at IS NOT NULL
     AND au.deleted_at IS NULL
     AND au.created_at <= p_now
     AND lower(au.email) NOT LIKE '%@example.invalid'
     AND NOT p.email_opt_out
     AND COALESCE(p.subscription_tier, 'free') = 'free'
     AND s.stripe_customer_id IS NULL
     AND s.stripe_subscription_id IS NULL
     AND s.status IS NULL
     AND to_jsonb(p) ->> 'stripe_customer_id' IS NULL
     AND to_jsonb(p) ->> 'stripe_subscription_id' IS NULL
     AND to_jsonb(p) ->> 'subscription_status' IS NULL
     AND public.effective_plan(au.id, p_now) = 'free'
     AND NOT EXISTS (SELECT 1 FROM public.email_log l WHERE l.user_id = au.id AND l.template = p_template)
   ORDER BY au.created_at;
$$;

REVOKE ALL ON FUNCTION public.promo_email_candidates(text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promo_email_candidates(text, timestamptz) TO service_role;
