-- ============================================================
-- Hand history — preflop check against the Preflop Trainer's ranges
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history.sql and
-- supabase_hand_history_involved.sql. Idempotent: safe to re-run.
--
-- preflop_check     correct | te_los | te_strak | verkeerde_actie | gemengd |
--                   niet_beoordeeld; NULL when Hero's spot is not one the
--                   trainer has ranges for (now: only raise first in).
-- preflop_position  the trainer's chart position ("UTG+1", "BN", …)
-- preflop_detail    spot, chart reference, frequencies and expected action
--                   (PreflopDetail in frontend/lib/handHistory/preflop/types.ts)
-- preflop_version   version of the check + hash of the range data. The app
--                   re-checks every hand whose version differs — so existing
--                   hands are checked on the next visit to /hands, and again
--                   whenever the trainer's ranges change.
--
-- The check runs in the app (it reads the trainer's own range files); the
-- database only stores the result. hh_set_preflop_checks() is the one way to
-- write it afterwards, and only for the caller's own hands.
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS preflop_check    text,
  ADD COLUMN IF NOT EXISTS preflop_position text,
  ADD COLUMN IF NOT EXISTS preflop_detail   jsonb,
  ADD COLUMN IF NOT EXISTS preflop_version  text;

ALTER TABLE public.hh_hands DROP CONSTRAINT IF EXISTS hh_hands_preflop_check_valid;
ALTER TABLE public.hh_hands ADD CONSTRAINT hh_hands_preflop_check_valid CHECK (
  preflop_check IS NULL
  OR preflop_check IN ('correct', 'te_los', 'te_strak', 'verkeerde_actie', 'gemengd', 'niet_beoordeeld')
);

CREATE INDEX IF NOT EXISTS hh_hands_user_preflop_idx
  ON public.hh_hands (user_id, preflop_check, pot_bb DESC, played_at DESC, id DESC)
  WHERE preflop_check IS NOT NULL;
CREATE INDEX IF NOT EXISTS hh_hands_user_preflop_version_idx
  ON public.hh_hands (user_id, preflop_version);

-- Write check results for the caller's own hands.
-- p_rows: [{ id, preflop_check, preflop_position, preflop_detail, preflop_version }]
CREATE OR REPLACE FUNCTION public.hh_set_preflop_checks(p_rows jsonb)
RETURNS integer
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
  UPDATE public.hh_hands h
     SET preflop_check    = r.preflop_check,
         preflop_position = r.preflop_position,
         preflop_detail   = r.preflop_detail,
         preflop_version  = r.preflop_version
    FROM jsonb_to_recordset(p_rows) AS r(
           id uuid, preflop_check text, preflop_position text, preflop_detail jsonb, preflop_version text)
   WHERE h.id = r.id
     AND h.user_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_set_preflop_checks(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_set_preflop_checks(jsonb) TO authenticated;

-- Counts per verdict and chart position for the overview's summary.
CREATE OR REPLACE FUNCTION public.hh_preflop_summary()
RETURNS TABLE (preflop_check text, preflop_position text, n bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT h.preflop_check, h.preflop_position, count(*)
    FROM public.hh_hands h
   WHERE h.user_id = auth.uid() AND h.preflop_check IS NOT NULL
   GROUP BY 1, 2;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_preflop_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_preflop_summary() TO authenticated;
