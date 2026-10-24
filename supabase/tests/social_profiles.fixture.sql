-- Slices of the tables 20261025_04_profiles_stats.sql reads that the local
-- stub does not have yet (run by supabase/tests/run.sh before the migration).

-- supabase_achievements_schema.sql
CREATE TABLE IF NOT EXISTS public.achievements (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL DEFAULT '🏆',
  category    text NOT NULL CHECK (category IN ('learning','consistency','mastery','exploration','performance')),
  condition   text NOT NULL,
  xp_bonus    int  NOT NULL DEFAULT 0,
  tier        text NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.achievements (id, title, description, icon, category, condition, xp_bonus, tier) VALUES
  ('streak_7',  'Week Warrior', '7-day streak',  '🔥', 'consistency', '7 days',  75,  'silver'),
  ('streak_30', 'Iron Will',    '30-day streak', '💎', 'consistency', '30 days', 300, 'gold')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text        NOT NULL REFERENCES public.achievements(id),
  earned_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_achievements_select" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;
CREATE POLICY "user_achievements_select" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_achievements_insert" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- supabase_preflop_trainer_xp.sql
ALTER TABLE public.trainer_highscores
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak    integer NOT NULL DEFAULT 0;

-- supabase_flop_trainer.sql / supabase_flop_trainer_phase3.sql
CREATE TABLE IF NOT EXISTS public.flop_trainer_answers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id     text   NOT NULL DEFAULT 'x',
  flop        text   NOT NULL DEFAULT 'x',
  category    text   NOT NULL,
  verdict     text   NOT NULL CHECK (verdict IN ('perfect', 'good', 'miss')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.flop_versus_answers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  correct     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
