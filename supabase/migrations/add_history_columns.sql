-- ============================================================
-- Add history/study columns to hand_analyses
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.hand_analyses
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS is_favorite    boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS tags           text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS analysis_type  text         NOT NULL DEFAULT 'hand'
    CHECK (analysis_type IN ('hand', 'session', 'tournament'));

-- Index for fast favorite look-up
CREATE INDEX IF NOT EXISTS hand_analyses_favorite_idx
  ON public.hand_analyses (user_id, is_favorite)
  WHERE is_favorite = true;

-- Index for analysis_type filtering
CREATE INDEX IF NOT EXISTS hand_analyses_type_idx
  ON public.hand_analyses (user_id, analysis_type, analyzed_at DESC);
