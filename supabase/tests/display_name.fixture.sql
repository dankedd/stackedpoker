-- Slices of the tables supabase_display_name.sql reads that the local stub
-- does not have (run by supabase/tests/run.sh BEFORE the migration: SQL
-- function bodies are checked against the tables when they are created).
-- xp_events comes from retention.fixture.sql, hh_hands from
-- supabase_hand_history.sql.

-- supabase_learning_schema.sql
CREATE TABLE IF NOT EXISTS public.user_skill_progress (
  user_id   uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp  integer NOT NULL DEFAULT 0
);
