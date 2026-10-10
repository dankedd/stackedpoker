-- ============================================================
-- Hand history — imported tournament hands, notes, import log
-- Run this in the Supabase SQL Editor. Depends only on auth.users.
-- Then run supabase_hand_history_involved.sql (hero_involved, hero_invested_bb).
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS,
-- so this file is safe to re-run.
--
-- Tables
--   hh_imports       one row per upload: counts + hands that failed to parse
--   hh_tournaments   one row per (user, site, tournament); counts kept by trigger
--   hh_hands         one row per hand. Filterable values are real columns;
--                    the full parsed hand is in `data` (jsonb) and the
--                    original text in `raw_text`, so hands can be re-parsed
--                    when the parser improves (`parser_version`).
--   hh_hand_notes    notes per hand. `street` = 'hand' for the whole-hand
--                    note; 'preflop'..'river' and `tags` are there for later.
--
-- Deduplication: UNIQUE (user_id, site, hand_id). The importer inserts with
-- ON CONFLICT DO NOTHING, so uploading the same export twice adds nothing.
-- ============================================================

-- ── Imports ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hh_imports (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  file_names         text[]       NOT NULL DEFAULT '{}',
  tournaments_count  integer      NOT NULL DEFAULT 0,
  hands_imported     integer      NOT NULL DEFAULT 0,
  hands_skipped      integer      NOT NULL DEFAULT 0,
  hands_failed       integer      NOT NULL DEFAULT 0,
  -- [{ handId, error, fileName, rawText }] — rawText truncated client-side
  failures           jsonb        NOT NULL DEFAULT '[]'::jsonb,
  finished_at        timestamptz
);

CREATE INDEX IF NOT EXISTS hh_imports_user_created_idx ON public.hh_imports (user_id, created_at DESC);

ALTER TABLE public.hh_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hh_imports_select_own" ON public.hh_imports;
CREATE POLICY "hh_imports_select_own" ON public.hh_imports
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_imports_insert_own" ON public.hh_imports;
CREATE POLICY "hh_imports_insert_own" ON public.hh_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_imports_update_own" ON public.hh_imports;
CREATE POLICY "hh_imports_update_own" ON public.hh_imports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_imports_delete_own" ON public.hh_imports;
CREATE POLICY "hh_imports_delete_own" ON public.hh_imports
  FOR DELETE USING (auth.uid() = user_id);

-- ── Tournaments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hh_tournaments (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site           text         NOT NULL,
  tournament_id  text         NOT NULL,
  name           text,
  -- Maintained by hh_hands_tournament_stats() — never written by the client.
  hand_count     integer      NOT NULL DEFAULT 0,
  first_hand_at  timestamp,
  last_hand_at   timestamp,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, site, tournament_id)
);

CREATE INDEX IF NOT EXISTS hh_tournaments_user_last_idx ON public.hh_tournaments (user_id, last_hand_at DESC);

ALTER TABLE public.hh_tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hh_tournaments_select_own" ON public.hh_tournaments;
CREATE POLICY "hh_tournaments_select_own" ON public.hh_tournaments
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_tournaments_insert_own" ON public.hh_tournaments;
CREATE POLICY "hh_tournaments_insert_own" ON public.hh_tournaments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_tournaments_delete_own" ON public.hh_tournaments;
CREATE POLICY "hh_tournaments_delete_own" ON public.hh_tournaments
  FOR DELETE USING (auth.uid() = user_id);

-- ── Hands ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hh_hands (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site              text          NOT NULL,
  hand_id           text          NOT NULL,
  tournament_id     text,
  import_id         uuid          REFERENCES public.hh_imports(id) ON DELETE SET NULL,

  played_at         timestamp     NOT NULL,   -- local time as printed by the site
  level             integer,
  small_blind       numeric(14,2) NOT NULL,
  big_blind         numeric(14,2) NOT NULL CHECK (big_blind > 0),
  ante              numeric(14,2) NOT NULL DEFAULT 0,
  table_name        text,
  max_seats         smallint,
  button_seat       smallint,
  player_count      smallint      NOT NULL,

  hero_position     text,
  hero_cards        text[],
  board             text[]        NOT NULL DEFAULT '{}',
  last_street       text          NOT NULL CHECK (last_street IN ('preflop','flop','turn','river')),

  pot_chips         numeric(16,2) NOT NULL,
  pot_bb            numeric(10,2) NOT NULL,
  hero_net_chips    numeric(16,2) NOT NULL,
  hero_net_bb       numeric(10,2) NOT NULL,
  hero_won          boolean       NOT NULL,
  went_to_showdown  boolean       NOT NULL,
  hero_all_in       boolean       NOT NULL,

  -- Maintained by hh_notes_sync_has_note() — never written by the client.
  has_note          boolean       NOT NULL DEFAULT false,

  data              jsonb         NOT NULL,  -- full ParsedHand (lib/handHistory/types.ts)
  raw_text          text          NOT NULL,
  parser            text          NOT NULL,
  parser_version    integer       NOT NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (user_id, site, hand_id),
  FOREIGN KEY (user_id, site, tournament_id)
    REFERENCES public.hh_tournaments (user_id, site, tournament_id) ON DELETE CASCADE
);

-- One index per sort order; each ends in the same tie-breakers the app uses
-- (played_at DESC, id DESC) so a page is a single index range scan.
CREATE INDEX IF NOT EXISTS hh_hands_user_pot_idx
  ON public.hh_hands (user_id, pot_bb DESC, played_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hh_hands_user_played_idx
  ON public.hh_hands (user_id, played_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hh_hands_user_result_idx
  ON public.hh_hands (user_id, hero_net_bb DESC, played_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hh_hands_user_tournament_idx
  ON public.hh_hands (user_id, tournament_id, pot_bb DESC);
CREATE INDEX IF NOT EXISTS hh_hands_user_noted_idx
  ON public.hh_hands (user_id, pot_bb DESC) WHERE has_note;

ALTER TABLE public.hh_hands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hh_hands_select_own" ON public.hh_hands;
CREATE POLICY "hh_hands_select_own" ON public.hh_hands
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_hands_insert_own" ON public.hh_hands;
CREATE POLICY "hh_hands_insert_own" ON public.hh_hands
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_note = false);
DROP POLICY IF EXISTS "hh_hands_delete_own" ON public.hh_hands;
CREATE POLICY "hh_hands_delete_own" ON public.hh_hands
  FOR DELETE USING (auth.uid() = user_id);
-- No UPDATE policy: hands are immutable from the client. A future re-parse
-- job runs server-side with the service role.

-- Tournament counters follow the hands table.
CREATE OR REPLACE FUNCTION public.hh_hands_tournament_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.tournament_id IS NOT NULL THEN
    UPDATE public.hh_tournaments t
       SET hand_count    = t.hand_count + 1,
           first_hand_at = LEAST(COALESCE(t.first_hand_at, NEW.played_at), NEW.played_at),
           last_hand_at  = GREATEST(COALESCE(t.last_hand_at, NEW.played_at), NEW.played_at)
     WHERE t.user_id = NEW.user_id AND t.site = NEW.site AND t.tournament_id = NEW.tournament_id;
  ELSIF TG_OP = 'DELETE' AND OLD.tournament_id IS NOT NULL THEN
    UPDATE public.hh_tournaments t
       SET hand_count = GREATEST(t.hand_count - 1, 0)
     WHERE t.user_id = OLD.user_id AND t.site = OLD.site AND t.tournament_id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hh_hands_tournament_stats ON public.hh_hands;
CREATE TRIGGER hh_hands_tournament_stats
  AFTER INSERT OR DELETE ON public.hh_hands
  FOR EACH ROW EXECUTE FUNCTION public.hh_hands_tournament_stats();

-- ── Notes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hh_hand_notes (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hand_ref    uuid         NOT NULL REFERENCES public.hh_hands(id) ON DELETE CASCADE,
  street      text         NOT NULL DEFAULT 'hand'
                           CHECK (street IN ('hand','preflop','flop','turn','river')),
  body        text         NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  tags        text[]       NOT NULL DEFAULT '{}',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (hand_ref, street)
);

CREATE INDEX IF NOT EXISTS hh_hand_notes_user_idx ON public.hh_hand_notes (user_id, updated_at DESC);

ALTER TABLE public.hh_hand_notes ENABLE ROW LEVEL SECURITY;

-- A note may only point at one of the user's own hands.
DROP POLICY IF EXISTS "hh_hand_notes_select_own" ON public.hh_hand_notes;
CREATE POLICY "hh_hand_notes_select_own" ON public.hh_hand_notes
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_hand_notes_insert_own" ON public.hh_hand_notes;
CREATE POLICY "hh_hand_notes_insert_own" ON public.hh_hand_notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.hh_hands h WHERE h.id = hand_ref AND h.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "hh_hand_notes_update_own" ON public.hh_hand_notes;
CREATE POLICY "hh_hand_notes_update_own" ON public.hh_hand_notes
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.hh_hands h WHERE h.id = hand_ref AND h.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "hh_hand_notes_delete_own" ON public.hh_hand_notes;
CREATE POLICY "hh_hand_notes_delete_own" ON public.hh_hand_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.hh_notes_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hh_notes_touch ON public.hh_hand_notes;
CREATE TRIGGER hh_notes_touch
  BEFORE UPDATE ON public.hh_hand_notes
  FOR EACH ROW EXECUTE FUNCTION public.hh_notes_touch();

-- hh_hands.has_note = "this hand has at least one non-empty note". Kept as a
-- column (not a join) so the overview can filter and index on it.
CREATE OR REPLACE FUNCTION public.hh_notes_sync_has_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref uuid := COALESCE(NEW.hand_ref, OLD.hand_ref);
BEGIN
  UPDATE public.hh_hands h
     SET has_note = EXISTS (
       SELECT 1 FROM public.hh_hand_notes n
        WHERE n.hand_ref = ref AND btrim(n.body) <> ''
     )
   WHERE h.id = ref;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hh_notes_sync_has_note ON public.hh_hand_notes;
CREATE TRIGGER hh_notes_sync_has_note
  AFTER INSERT OR UPDATE OR DELETE ON public.hh_hand_notes
  FOR EACH ROW EXECUTE FUNCTION public.hh_notes_sync_has_note();

-- Trigger functions are not meant to be called directly.
REVOKE EXECUTE ON FUNCTION public.hh_hands_tournament_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hh_notes_sync_has_note() FROM PUBLIC, anon, authenticated;
