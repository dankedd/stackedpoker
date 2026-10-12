-- ============================================================
-- Profiles — store the Google name, and backfill name + avatar once
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- /auth/callback copies the name and avatar Google sends into the profile
-- (frontend/lib/auth/profileSync.ts), filling only empty fields. profiles had
-- avatar_url but no full_name column, and the old callback upsert never wrote
-- anything (it also sent a non-existent `email` column, and ignoreDuplicates
-- skipped the row the signup trigger had already created).
--
-- Email is NOT added: it lives in auth.users and nothing reads it from here.
-- ============================================================

-- 1. The column. Users may update their own row (profiles_update_own); this is
--    not a privileged column, so no extra grant or revoke is needed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- 2. One-time backfill for existing Google accounts: fill only empty fields,
--    never overwrite a value that is already there.
UPDATE public.profiles p
SET
  full_name  = COALESCE(p.full_name,
                        NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                        NULLIF(btrim(u.raw_user_meta_data ->> 'name'), '')),
  avatar_url = COALESCE(p.avatar_url,
                        NULLIF(btrim(u.raw_user_meta_data ->> 'avatar_url'), ''),
                        NULLIF(btrim(u.raw_user_meta_data ->> 'picture'), ''))
FROM auth.users u
WHERE u.id = p.id
  AND u.raw_app_meta_data -> 'providers' ? 'google'
  AND (
        (p.full_name  IS NULL AND COALESCE(u.raw_user_meta_data ->> 'full_name',  u.raw_user_meta_data ->> 'name')    IS NOT NULL)
     OR (p.avatar_url IS NULL AND COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') IS NOT NULL)
  );

-- 3. Check: every Google account should now have both.
-- SELECT count(*) FILTER (WHERE p.full_name IS NULL)  AS missing_name,
--        count(*) FILTER (WHERE p.avatar_url IS NULL) AS missing_avatar,
--        count(*)                                     AS google_accounts
-- FROM public.profiles p JOIN auth.users u ON u.id = p.id
-- WHERE u.raw_app_meta_data -> 'providers' ? 'google';
