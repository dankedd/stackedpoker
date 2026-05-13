-- ============================================================
-- Fix: hand_analyses table + RLS policies
-- Run in Supabase SQL Editor (Dashboard → SQL)
-- This is idempotent — safe to run multiple times.
-- ============================================================

-- 1. Create table if it doesn't exist (full schema)
CREATE TABLE IF NOT EXISTS public.hand_analyses (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type            text          NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'image')),
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
  -- history columns (from add_history_columns.sql)
  title                 text,
  is_favorite           boolean       NOT NULL DEFAULT false,
  notes                 text,
  tags                  text[]        NOT NULL DEFAULT '{}',
  analysis_type         text          NOT NULL DEFAULT 'hand'
                          CHECK (analysis_type IN ('hand', 'session', 'tournament'))
);

-- 2. Add any missing columns to existing table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='title') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='is_favorite') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='notes') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='tags') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='analysis_type') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN analysis_type text NOT NULL DEFAULT 'hand'
      CHECK (analysis_type IN ('hand', 'session', 'tournament'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hand_analyses' AND column_name='replay_state') THEN
    ALTER TABLE public.hand_analyses ADD COLUMN replay_state jsonb;
  END IF;
END $$;

-- 3. Enable Row Level Security
ALTER TABLE public.hand_analyses ENABLE ROW LEVEL SECURITY;

-- 4. Drop old/broken policies and recreate correctly
DROP POLICY IF EXISTS "Users can view own analyses"   ON public.hand_analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON public.hand_analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON public.hand_analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON public.hand_analyses;
-- Also drop any other policies that might exist
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'hand_analyses' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hand_analyses', pol.policyname);
  END LOOP;
END $$;

-- 5. Create correct RLS policies
-- SELECT: users see only their own rows
CREATE POLICY "Users can view own analyses"
  ON public.hand_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can only insert rows with their own user_id
CREATE POLICY "Users can insert own analyses"
  ON public.hand_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own rows (for notes, favorites)
CREATE POLICY "Users can update own analyses"
  ON public.hand_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: users can only delete their own rows
CREATE POLICY "Users can delete own analyses"
  ON public.hand_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS hand_analyses_user_id_idx
  ON public.hand_analyses (user_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS hand_analyses_favorite_idx
  ON public.hand_analyses (user_id, is_favorite)
  WHERE is_favorite = true;

CREATE INDEX IF NOT EXISTS hand_analyses_type_idx
  ON public.hand_analyses (user_id, analysis_type, analyzed_at DESC);

-- 7. Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hand_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hand_analyses TO service_role;
