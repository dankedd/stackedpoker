-- ============================================================
-- Privileged profile columns can only be written by the server
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Why: supabase_security_hardening.sql tried to protect subscription_tier
-- with a column-level REVOKE UPDATE. Postgres ignores a column-level revoke
-- while the role still holds the table-level UPDATE privilege, which
-- Supabase grants to `authenticated` on every public table. So any signed-in
-- user could run
--     supabase.from('profiles').update({ subscription_tier: 'admin' })
-- on their own row (profiles_update_own allows it) and get Pro plus
-- development access (effective_plan() and lib/features.ts both read it).
--
-- This trigger refuses changes to the listed columns unless the writer is
-- trusted: the service role (Stripe webhook, backend, cron), the postgres
-- owner (SQL editor, SECURITY DEFINER functions such as set_my_handle), or
-- the auth trigger. The list includes the social columns from
-- 20261024_02_social_foundation.sql (role, bans, handle) — absent columns
-- are simply skipped, so the order the two files run in does not matter.
-- ============================================================

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- Columns only the server may change.
  protected text[] := ARRAY[
    'subscription_tier', 'analyses_limit', 'hands_analyzed_count', 'subscription_status',
    'stripe_customer_id', 'stripe_subscription_id', 'current_period_end',
    'role', 'banned_until', 'ban_reason', 'handle', 'handle_changed_at', 'bio_hidden_at'
  ];
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  k text;
BEGIN
  -- Only the API roles are restricted; everything else is a trusted path.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A user creating their own row (lib/auth/profileSync.ts fallback) gets
    -- the defaults for every protected column.
    IF coalesce(v_new ->> 'subscription_tier', 'free') <> 'free'
       OR coalesce(v_new ->> 'role', 'user') <> 'user' THEN
      RAISE EXCEPTION 'profiles: % may not be set by the client', 'subscription_tier/role'
        USING ERRCODE = '42501';
    END IF;
    FOREACH k IN ARRAY protected LOOP
      CONTINUE WHEN k IN ('subscription_tier', 'role', 'analyses_limit', 'hands_analyzed_count');
      IF v_new ? k AND v_new -> k <> 'null'::jsonb THEN
        RAISE EXCEPTION 'profiles: % may not be set by the client', k USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  FOREACH k IN ARRAY protected LOOP
    IF v_new ? k AND (v_new -> k) IS DISTINCT FROM (v_old -> k) THEN
      RAISE EXCEPTION 'profiles: % may not be changed by the client', k USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged ON public.profiles;
CREATE TRIGGER profiles_guard_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

REVOKE ALL ON FUNCTION public.profiles_guard_privileged() FROM public, anon, authenticated;
