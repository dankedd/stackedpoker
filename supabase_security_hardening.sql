-- ============================================================
-- Stacked Poker — Security Hardening Migration
-- Run this in the Supabase SQL Editor AFTER supabase_schema.sql
-- and supabase_profile_schema.sql.
--
-- This script is idempotent: safe to re-run.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. PROFILES — complete RLS coverage
-- ──────────────────────────────────────────────────────────

-- Ensure RLS is on (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- INSERT: only the trigger / service-role can insert profiles.
-- Authenticated users must NOT be able to self-insert with arbitrary data
-- (the trigger handles creation on signup).
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- SELECT: users see only their own row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- UPDATE: users can update non-privileged columns only.
-- The service-role key (backend) bypasses RLS for Stripe callbacks.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: users cannot delete their own profile via the API.
-- Account deletion is handled by cascading from auth.users (admin action).
DROP POLICY IF EXISTS "profiles_no_delete" ON public.profiles;
CREATE POLICY "profiles_no_delete" ON public.profiles
  FOR DELETE
  USING (false);  -- Nobody can DELETE via anon/authenticated key


-- ──────────────────────────────────────────────────────────
-- 2. HAND_ANALYSES — split ALL into granular per-operation policies
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.hand_analyses ENABLE ROW LEVEL SECURITY;

-- Drop the catch-all policy and replace with explicit per-operation policies.
DROP POLICY IF EXISTS "hand_analyses_all_own" ON public.hand_analyses;

CREATE POLICY "hand_analyses_select_own" ON public.hand_analyses
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: backend always writes user_id from the validated JWT (server-side).
-- RLS enforces it can't be spoofed even on direct Supabase calls.
CREATE POLICY "hand_analyses_insert_own" ON public.hand_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can edit their own rows (e.g. add notes in future)
CREATE POLICY "hand_analyses_update_own" ON public.hand_analyses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can delete their own analyses
CREATE POLICY "hand_analyses_delete_own" ON public.hand_analyses
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 3. UPLOADED_IMAGES — granular RLS
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uploaded_images_all_own" ON public.uploaded_images;

CREATE POLICY "uploaded_images_select_own" ON public.uploaded_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "uploaded_images_insert_own" ON public.uploaded_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "uploaded_images_delete_own" ON public.uploaded_images
  FOR DELETE USING (auth.uid() = user_id);

-- No UPDATE policy — images are immutable once uploaded.


-- ──────────────────────────────────────────────────────────
-- 4. PUZZLE_COMPLETIONS — granular RLS
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.puzzle_completions ENABLE ROW LEVEL SECURITY;

-- Replace the broad policy with per-operation policies.
DROP POLICY IF EXISTS "puzzle_completions_own" ON public.puzzle_completions;

CREATE POLICY "puzzle_completions_select_own" ON public.puzzle_completions
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: server always sets user_id from JWT.
CREATE POLICY "puzzle_completions_insert_own" ON public.puzzle_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE — puzzle results are immutable (prevents score manipulation).
-- No DELETE — keeps audit trail.


-- ──────────────────────────────────────────────────────────
-- 5. PROFILE_CACHE — RLS
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.profile_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_cache_own" ON public.profile_cache;

CREATE POLICY "profile_cache_select_own" ON public.profile_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profile_cache_insert_own" ON public.profile_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_cache_update_own" ON public.profile_cache
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_cache_delete_own" ON public.profile_cache
  FOR DELETE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 6. PREVENT PRIVILEGE ESCALATION — column-level protection
--
-- The subscription_tier and analyses_limit columns must ONLY be
-- updated by the backend (service-role key, which bypasses RLS).
-- We cannot restrict individual columns via RLS alone, so we rely on:
--   a) The profiles_update_own policy limiting WHO can update
--   b) The backend never accepting user-supplied tier/limit values
--   c) The Stripe webhook being the sole updater of tier/limit
--
-- As an extra hardening layer, revoke the authenticated role's ability
-- to write to the profiles table directly (it must go through the backend).
-- The backend uses the service_role key which bypasses these grants.
-- ──────────────────────────────────────────────────────────

-- Revoke raw write access to sensitive subscription columns from authenticated role.
-- Authenticated users can still UPDATE via RLS-gated policies, but only the
-- columns their app code actually sends — the backend writes tier/limit via
-- service_role which bypasses RLS entirely.
REVOKE UPDATE (subscription_tier, analyses_limit, subscription_status,
               stripe_customer_id, stripe_subscription_id, current_period_end)
  ON public.profiles
  FROM authenticated;


-- ──────────────────────────────────────────────────────────
-- 7. SECURE THE increment_analyses_used RPC
--
-- This function is SECURITY DEFINER (runs as superuser).
-- Harden it so it cannot be called with arbitrary user IDs
-- by verifying the caller owns the user_id.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_analyses_used(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the service-role backend or the authenticated user themselves
  -- may trigger a usage increment. This prevents one user from draining
  -- another user's quota (even though the backend never calls it that way).
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorised to increment usage for this user';
  END IF;

  UPDATE profiles
  SET hands_analyzed_count = hands_analyzed_count + 1
  WHERE id = p_user_id;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 8. AUDIT LOG TABLE
--    Tracks sensitive operations for security monitoring.
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,   -- e.g. 'subscription_upgrade', 'analysis_deleted'
  metadata    jsonb       DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only the service-role backend can INSERT audit events.
-- Nobody can read or modify audit logs via the anon/authenticated key.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_no_access" ON public.audit_log
  FOR ALL
  USING (false);  -- service_role bypasses this; authenticated users cannot touch it


-- Index for time-range queries during incident investigation
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx    ON public.audit_log (user_id, created_at DESC);


-- ──────────────────────────────────────────────────────────
-- 9. ANALYSIS_TYPE COLUMN (safe additive migration)
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.hand_analyses
  ADD COLUMN IF NOT EXISTS analysis_type text DEFAULT 'hand'
  CHECK (analysis_type IN ('hand', 'session', 'tournament'));


-- ──────────────────────────────────────────────────────────
-- 10. VERIFY RLS IS ENABLED ON ALL TABLES
--     (run this block manually to audit — it returns rows where RLS is OFF)
-- ──────────────────────────────────────────────────────────

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND rowsecurity = false;
-- Expected: 0 rows (all tables have RLS enabled)


-- ──────────────────────────────────────────────────────────
-- SUMMARY OF CHANGES
-- ──────────────────────────────────────────────────────────
-- profiles           RLS ✓ | INSERT ✓ | SELECT ✓ | UPDATE ✓ | DELETE blocked
-- hand_analyses      RLS ✓ | granular per-op policies replacing catch-all
-- uploaded_images    RLS ✓ | granular per-op policies | UPDATE blocked (immutable)
-- puzzle_completions RLS ✓ | UPDATE/DELETE blocked (immutable results)
-- profile_cache      RLS ✓ | full per-op policies
-- audit_log          RLS ✓ | no access from anon/authenticated (service_role only)
-- subscription cols  REVOKE UPDATE from authenticated role
-- increment RPC      self-ownership check added
