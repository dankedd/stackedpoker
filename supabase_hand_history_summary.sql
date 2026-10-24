-- ============================================================
-- Hand history — tournament summary (Stacked score)
-- Run this in the Supabase SQL Editor AFTER supabase_subscriptions.sql
-- (it relies on its hh_tournaments visibility rules), BEFORE deploying the
-- app that shows /hands/summary. Idempotent: safe to re-run.
--
-- score            0–100 "Stacked score" of the tournament, NULL when too
--                  few hands could be graded. A model on chart frequencies,
--                  not EV (frontend/lib/handHistory/summary/config.ts).
-- summary          counts, mistake split and the hand lists per filter
--                  (TournamentSummary in summary/compute.ts)
-- summary_version  version of the computation. The app recomputes when it
--                  differs, or when the tournament's hand count changed.
-- summary_at       when it was computed
--
-- Like the preflop and flop checks, the summary is computed in the app; the
-- database only stores it. hh_set_tournament_summary() is the one way to
-- write it, and only for the caller's own tournament.
-- ============================================================

ALTER TABLE public.hh_tournaments
  ADD COLUMN IF NOT EXISTS score           smallint,
  ADD COLUMN IF NOT EXISTS summary         jsonb,
  ADD COLUMN IF NOT EXISTS summary_version text,
  ADD COLUMN IF NOT EXISTS summary_at      timestamptz;

ALTER TABLE public.hh_tournaments DROP CONSTRAINT IF EXISTS hh_tournaments_score_valid;
ALTER TABLE public.hh_tournaments ADD CONSTRAINT hh_tournaments_score_valid CHECK (
  score IS NULL OR score BETWEEN 0 AND 100
);

-- Score history (Pro) and "previous tournament" lookups.
CREATE INDEX IF NOT EXISTS hh_tournaments_user_scored_idx
  ON public.hh_tournaments (user_id, last_hand_at DESC)
  WHERE score IS NOT NULL;

-- ── Write ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.hh_set_tournament_summary(
  p_id uuid,
  p_score smallint,
  p_summary jsonb,
  p_version text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.hh_tournaments t
     SET score           = p_score,
         summary         = p_summary,
         summary_version = p_version,
         summary_at      = now()
   WHERE t.id = p_id
     AND t.user_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_set_tournament_summary(uuid, smallint, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_set_tournament_summary(uuid, smallint, jsonb, text) TO authenticated;

-- ── Previous score (every plan) ────────────────────────────────────────────
--
-- The Free plan only sees its latest tournament (hh_tournaments_select_own),
-- so the comparison goes through this function. It returns one number and
-- the tournament's name — never hands, and never the full history (Pro sees
-- that through the normal SELECT policy).
--
-- "Previous" = the caller's scored tournament whose last hand came before
-- this one's last hand.

CREATE OR REPLACE FUNCTION public.hh_previous_tournament_score(p_id uuid)
RETURNS TABLE (score smallint, name text, last_hand_at timestamp)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.score, p.name, p.last_hand_at
    FROM public.hh_tournaments cur
    JOIN public.hh_tournaments p
      ON p.user_id = cur.user_id
     AND p.id <> cur.id
     AND p.score IS NOT NULL
     AND p.last_hand_at < cur.last_hand_at
   WHERE cur.id = p_id
     AND cur.user_id = auth.uid()
   ORDER BY p.last_hand_at DESC, p.id DESC
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_previous_tournament_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_previous_tournament_score(uuid) TO authenticated;
