-- Tables the XP migrations expect from supabase_learning_schema.sql /
-- supabase_display_name.sql, as in production (run_xp_rebalance.sh).

CREATE TABLE IF NOT EXISTS public.user_skill_progress (
  user_id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp        integer     NOT NULL DEFAULT 0,
  level           integer     NOT NULL DEFAULT 1,
  streak_days     integer     NOT NULL DEFAULT 0,
  last_active     date,
  unlocked_paths  text[]      NOT NULL DEFAULT '{beginner}',
  achievements    text[]      NOT NULL DEFAULT '{}',
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.user_skill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_skill_progress_select_own" ON public.user_skill_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_skill_progress_insert_own" ON public.user_skill_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_skill_progress_update_own" ON public.user_skill_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Read by the backfill at the end of supabase_xp_leaderboard_schema.sql.
CREATE TABLE IF NOT EXISTS public.user_step_progress (
  user_id uuid, lesson_id text, step_id text, xp_awarded integer, first_completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.user_module_progress (
  user_id uuid, module_id text, xp_awarded integer, completed_at timestamptz
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
CREATE OR REPLACE FUNCTION public.public_player_name(p_display_name text, p_user_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_display_name, 'Player ' || left(md5(p_user_id::text), 4))
$$;
