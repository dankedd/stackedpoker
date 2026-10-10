-- ============================================================
-- Hand history — favourite hands (star)
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history.sql,
-- supabase_hand_history_involved.sql and supabase_hand_history_preflop.sql.
-- Idempotent: safe to re-run.
--
-- favorited_at  when Hero starred the hand; NULL = not a favourite.
-- is_favorite   generated from favorited_at, so the two can never disagree.
--
-- hh_hands already holds one row per (user, site, hand), so the star lives on
-- that row rather than in a separate table. Re-importing the same export does
-- not touch it: the importer inserts with ON CONFLICT DO NOTHING and never
-- sends these columns.
--
-- hh_hands has no UPDATE policy (hands are immutable from the client), so
-- hh_set_favorite() is the one way to change the star, and only on the
-- caller's own hands.
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS favorited_at timestamptz;

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS is_favorite boolean GENERATED ALWAYS AS (favorited_at IS NOT NULL) STORED;

-- "Alleen favorieten" + "Recent als favoriet gemarkeerd"; with the favourites
-- filter on, the other sorts read this (small) slice of the index and sort it.
CREATE INDEX IF NOT EXISTS hh_hands_user_favorite_idx
  ON public.hh_hands (user_id, favorited_at DESC, played_at DESC, id DESC)
  WHERE is_favorite;

-- A new hand is never imported as a favourite.
DROP POLICY IF EXISTS "hh_hands_insert_own" ON public.hh_hands;
CREATE POLICY "hh_hands_insert_own" ON public.hh_hands
  FOR INSERT WITH CHECK (auth.uid() = user_id AND has_note = false AND favorited_at IS NULL);

-- Star or unstar one of the caller's hands. Starring an already starred hand
-- keeps its original date. Returns the new favorited_at (NULL when unstarred).
CREATE OR REPLACE FUNCTION public.hh_set_favorite(p_id uuid, p_favorite boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.hh_hands h
     SET favorited_at = CASE WHEN p_favorite THEN COALESCE(h.favorited_at, now()) ELSE NULL END
   WHERE h.id = p_id
     AND h.user_id = auth.uid()
  RETURNING h.favorited_at INTO result;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hand not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_set_favorite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_set_favorite(uuid, boolean) TO authenticated;
