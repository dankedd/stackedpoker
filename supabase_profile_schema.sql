-- ============================================================
-- Stacked Poker — Player Profile Extension Schema
-- Run this in the Supabase SQL Editor after the base schema.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. PUZZLE COMPLETIONS
--    Tracks every puzzle attempt for progress + profile stats.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.puzzle_completions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id      text        NOT NULL,
  difficulty     text        NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced','expert')),
  category       text        NOT NULL,
  score          integer     NOT NULL CHECK (score BETWEEN 0 AND 100),
  ev_loss_bb     numeric     NOT NULL DEFAULT 0,
  tags           text[]      DEFAULT '{}',
  completed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.puzzle_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "puzzle_completions_own" ON public.puzzle_completions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookups by user and time
CREATE INDEX IF NOT EXISTS puzzle_completions_user_idx
  ON public.puzzle_completions (user_id, completed_at DESC);

-- Fast lookup by puzzle_id (for deduplication / best-score tracking)
CREATE INDEX IF NOT EXISTS puzzle_completions_puzzle_idx
  ON public.puzzle_completions (user_id, puzzle_id);


-- ──────────────────────────────────────────────────────────
-- 2. PROFILE CACHE (optional — for expensive profile builds)
--    Stores the last computed profile snapshot per user.
--    Invalidated whenever a new hand_analyses row is inserted.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_cache (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data   jsonb       NOT NULL,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  hand_count     integer     NOT NULL DEFAULT 0   -- # of hands when cache was built
);

ALTER TABLE public.profile_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_cache_own" ON public.profile_cache
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 3. HELPER FUNCTIONS
-- ──────────────────────────────────────────────────────────

-- Get puzzle completion stats for a user (used by backend profile service)
CREATE OR REPLACE FUNCTION public.get_puzzle_stats(p_user_id uuid)
RETURNS TABLE (
  total_completed  bigint,
  avg_score        numeric,
  best_category    text,
  total_ev_loss    numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint                         AS total_completed,
    ROUND(AVG(score)::numeric, 1)            AS avg_score,
    (
      SELECT category
      FROM puzzle_completions
      WHERE user_id = p_user_id
      GROUP BY category
      ORDER BY AVG(score) DESC
      LIMIT 1
    )                                        AS best_category,
    ROUND(SUM(ev_loss_bb)::numeric, 1)       AS total_ev_loss
  FROM puzzle_completions
  WHERE user_id = p_user_id;
$$;


-- ──────────────────────────────────────────────────────────
-- 4. ADD analysis_type COLUMN TO hand_analyses (if missing)
--    Safe to run even if column already exists.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.hand_analyses
  ADD COLUMN IF NOT EXISTS analysis_type text DEFAULT 'hand'
  CHECK (analysis_type IN ('hand', 'session', 'tournament'));
