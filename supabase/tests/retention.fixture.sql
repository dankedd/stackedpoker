-- Slices of the tables supabase_retention.sql reads that the local stub does
-- not have (run by supabase/tests/run.sh BEFORE the migration: SQL function
-- bodies are checked against the tables when they are created).

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz DEFAULT now();
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- supabase_xp_leaderboard_schema.sql
CREATE TABLE IF NOT EXISTS public.xp_events (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      integer     NOT NULL CHECK (amount > 0),
  source_type text        NOT NULL,
  source_id   text,
  earned_at   timestamptz NOT NULL DEFAULT now()
);

-- supabase_trainer_highscores.sql + supabase_preflop_trainer_xp.sql
CREATE TABLE IF NOT EXISTS public.trainer_highscores (
  user_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_key   text    NOT NULL,
  hands_played  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, trainer_key)
);

CREATE TABLE IF NOT EXISTS public.trainer_hand_log (
  id         bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hand_ref   text,
  verdict    text         NOT NULL CHECK (verdict IN ('correct', 'mixed', 'wrong')),
  played_at  timestamptz  NOT NULL DEFAULT now()
);
