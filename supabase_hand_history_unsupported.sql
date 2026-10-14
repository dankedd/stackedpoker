-- ============================================================
-- Hand Review — log files we could not import
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Every uploaded file that is not imported (a recognised but unsupported
-- site, a cash game, a translated PokerStars client, an unrecognised file or
-- an unsupported file type) adds one row, so we can see which sites and game
-- types players ask for. Only what the browser recognised is stored: site,
-- game type, reason and the file extension. Never the file name or contents.
--
-- Written by frontend/lib/handHistory/importer.ts (logUnsupportedFiles),
-- best effort: an import never fails because of this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hh_unsupported_files (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'ggpoker' | 'pokerstars' | '888poker' | 'ipoker' | NULL (not recognised)
  site        text        CHECK (site IS NULL OR char_length(site) <= 20),
  game_type   text        NOT NULL CHECK (game_type IN ('tournament', 'cash', 'unknown')),
  reason      text        NOT NULL CHECK (reason IN ('unsupported_site', 'cash', 'language', 'unrecognised', 'file_type')),
  extension   text        CHECK (extension IS NULL OR char_length(extension) <= 10),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hh_unsupported_files_created_idx
  ON public.hh_unsupported_files (created_at DESC);

ALTER TABLE public.hh_unsupported_files ENABLE ROW LEVEL SECURITY;

-- Players may only add rows for themselves. There is no SELECT, UPDATE or
-- DELETE policy: the log is read in the SQL editor (README), not by the app.
DROP POLICY IF EXISTS "hh_unsupported_files_insert_own" ON public.hh_unsupported_files;
CREATE POLICY "hh_unsupported_files_insert_own" ON public.hh_unsupported_files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.hh_unsupported_files TO authenticated;
