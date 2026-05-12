-- ============================================================
-- Stacked Poker — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. PROFILES
--    Auto-created on signup via trigger below.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username             text        UNIQUE,
  avatar_url           text,
  subscription_tier    text        NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','admin')),
  hands_analyzed_count integer     NOT NULL DEFAULT 0,
  analyses_limit       integer     NOT NULL DEFAULT 3,  -- 3 for free, 2147483647 for pro/admin
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────────────────
-- 2. HAND ANALYSES
--    Stores every analysis result linked to the user.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hand_analyses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- raw input
  input_type           text        NOT NULL CHECK (input_type IN ('text','image')),
  raw_hand_text        text,
  -- parsed hand
  site                 text,
  game_type            text,
  stakes               text,
  hero_position        text,
  hero_cards           jsonb,
  board                jsonb,
  actions              jsonb,
  effective_stack_bb   numeric,
  -- analysis output
  spot_classification  jsonb,
  board_texture        jsonb,
  findings             jsonb,
  overall_score        integer,
  ai_coaching          text,
  mistakes_count       integer     DEFAULT 0,
  -- replay
  replay_state         jsonb,
  -- meta
  analyzed_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hand_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hand_analyses_all_own" ON public.hand_analyses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast look-up by user
CREATE INDEX IF NOT EXISTS hand_analyses_user_id_idx
  ON public.hand_analyses (user_id, analyzed_at DESC);

-- ──────────────────────────────────────────────────────────
-- 3. UPLOADED IMAGES
--    Tracks screenshot uploads; actual file lives in Storage.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hand_analysis_id uuid        REFERENCES public.hand_analyses(id) ON DELETE SET NULL,
  storage_path     text        NOT NULL,
  content_type     text,
  size_bytes       bigint,
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploaded_images_all_own" ON public.uploaded_images
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 4. AUTO-CREATE PROFILE ON SIGNUP
-- ──────────────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at ON PROFILES
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────
-- 6. ATOMIC INCREMENT VIA RPC (called by backend after analysis)
--    SECURITY DEFINER: bypasses RLS — safe because only the
--    backend (service role key) can reach this endpoint.
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- 7. STORAGE BUCKET FOR POKER SCREENSHOTS
--    Run this separately or via the Supabase dashboard.
-- ──────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('poker-screenshots', 'poker-screenshots', false)
-- ON CONFLICT DO NOTHING;
--
-- CREATE POLICY "screenshots_owner_only" ON storage.objects
--   USING (auth.uid()::text = (storage.foldername(name))[1])
--   WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
