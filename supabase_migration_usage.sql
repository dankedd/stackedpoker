-- ============================================================
-- Migration: Usage & Access Control
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add analyses_limit column (default 3 for free tier)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analyses_limit integer NOT NULL DEFAULT 3;

-- 2. Extend subscription_tier CHECK to include 'admin'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro', 'admin'));

-- 3. Backfill analyses_limit for existing users
UPDATE public.profiles
  SET analyses_limit = 3
  WHERE subscription_tier = 'free' AND analyses_limit IS NULL;

UPDATE public.profiles
  SET analyses_limit = 2147483647  -- effectively unlimited
  WHERE subscription_tier IN ('pro', 'admin');

-- 4. Atomic increment RPC (called by backend after successful analysis)
--    Uses SECURITY DEFINER so it bypasses RLS — only callable server-side
--    via service role key.
CREATE OR REPLACE FUNCTION public.increment_analyses_used(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
  SET hands_analyzed_count = hands_analyzed_count + 1
  WHERE id = p_user_id;
$$;

-- 5. Allow service role to read profiles for server-side usage checks
--    (Service role already bypasses RLS by default in Supabase,
--     but explicit policy makes intent clear in audits.)
-- No extra policy needed — service role bypasses RLS automatically.

-- 6. Expose a read-only usage view that users can query via anon/user key
--    (so the frontend can show usage without touching the full profiles row)
CREATE OR REPLACE VIEW public.my_usage AS
SELECT
  subscription_tier  AS plan,
  hands_analyzed_count AS analyses_used,
  analyses_limit,
  CASE
    WHEN subscription_tier IN ('admin', 'pro') THEN true
    ELSE false
  END AS is_unlimited
FROM public.profiles
WHERE id = auth.uid();

-- 7. Update the signup trigger to carry over analyses_limit correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, subscription_tier, analyses_limit)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    3
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- After running this migration, set your account to admin:
--   UPDATE public.profiles
--   SET subscription_tier = 'admin', analyses_limit = 2147483647
--   WHERE id = '<your-auth-user-uuid>';
-- ============================================================
