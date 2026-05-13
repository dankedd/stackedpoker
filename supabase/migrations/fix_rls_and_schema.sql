-- ============================================================
-- Fix: hand_analyses RLS + schema alignment
-- Run in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Ensure table exists with full schema
CREATE TABLE IF NOT EXISTS public.hand_analyses (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type            text          NOT NULL DEFAULT 'text',
  raw_hand_text         text,
  site                  text,
  game_type             text,
  stakes                text,
  hero_position         text,
  hero_cards            jsonb         DEFAULT '[]',
  board                 jsonb         DEFAULT '[]',
  actions               jsonb         DEFAULT '[]',
  effective_stack_bb    numeric,
  spot_classification   jsonb         DEFAULT '{}',
  board_texture         jsonb         DEFAULT '{}',
  findings              jsonb         DEFAULT '[]',
  overall_score         integer,
  ai_coaching           text,
  mistakes_count        integer       DEFAULT 0,
  replay_state          jsonb,
  analyzed_at           timestamptz   NOT NULL DEFAULT now(),
  title                 text,
  is_favorite           boolean       NOT NULL DEFAULT false,
  notes                 text,
  tags                  text[]        NOT NULL DEFAULT '{}',
  analysis_type         text          NOT NULL DEFAULT 'hand'
);

-- 2. Add missing columns to any pre-existing table (idempotent)
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'spot_classification jsonb DEFAULT ''{}''',
    'board_texture jsonb DEFAULT ''{}''',
    'findings jsonb DEFAULT ''[]''',
    'actions jsonb DEFAULT ''[]''',
    'replay_state jsonb',
    'title text',
    'notes text',
    'analysis_type text NOT NULL DEFAULT ''hand'''
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.hand_analyses ADD COLUMN IF NOT EXISTS %s', col);
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;

  -- Boolean with default (separate to avoid NOT NULL migration issues)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='is_favorite'
  ) THEN
    ALTER TABLE public.hand_analyses ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
  END IF;

  -- tags array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='tags'
  ) THEN
    ALTER TABLE public.hand_analyses ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.hand_analyses ENABLE ROW LEVEL SECURITY;

-- 4. Drop ALL existing policies cleanly
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'hand_analyses' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hand_analyses', pol.policyname);
  END LOOP;
END $$;

-- 5. Recreate policies
-- service_role bypasses RLS automatically — these policies are for authenticated users
CREATE POLICY "Users can view own analyses"
  ON public.hand_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.hand_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON public.hand_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON public.hand_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Grants — service_role always has full access; authenticated for user-JWT path
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hand_analyses TO authenticated;
GRANT ALL ON public.hand_analyses TO service_role;

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS hand_analyses_user_analyzed_idx
  ON public.hand_analyses (user_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS hand_analyses_type_idx
  ON public.hand_analyses (user_id, analysis_type, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS hand_analyses_favorite_idx
  ON public.hand_analyses (user_id, is_favorite)
  WHERE is_favorite = true;
