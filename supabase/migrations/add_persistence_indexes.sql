-- Ensure hand_analyses supports session rows and has efficient query indexes.
-- All columns already exist from supabase_schema.sql + add_history_columns.sql.
-- This migration only adds missing indexes for the persistence feature.

-- Fast lookup for session-type rows per user
CREATE INDEX IF NOT EXISTS hand_analyses_session_user_idx
  ON public.hand_analyses (user_id, analyzed_at DESC)
  WHERE analysis_type = 'session';

-- Fast lookup for hand-type rows per user (complements existing user_id_idx)
CREATE INDEX IF NOT EXISTS hand_analyses_hand_user_idx
  ON public.hand_analyses (user_id, analyzed_at DESC)
  WHERE analysis_type = 'hand';

-- Score-based sorting for leaderboard / best-hand queries
CREATE INDEX IF NOT EXISTS hand_analyses_score_idx
  ON public.hand_analyses (user_id, overall_score DESC)
  WHERE analysis_type = 'hand';
