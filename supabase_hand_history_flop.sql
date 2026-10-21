-- ============================================================
-- Hand history — flop decision check
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history_preflop.sql
-- and supabase_flop_equity.sql, BEFORE deploying the app that reads it.
-- Idempotent: safe to re-run.
--
-- flop_check    good | ok | questionable | not_evaluated; NULL when the hand
--               has no flop spot with book ranges (multiway, limped, …)
-- flop_detail   spot, flop, Hero's line, the guideline used, Hero's hand
--               position and the explanation (FlopCheck in
--               frontend/lib/handHistory/flopCheck.ts); for unmatched hands
--               only the reason
-- flop_version  version of the check. The app re-checks hands whose version
--               differs — and hands whose spot wasn't analysed yet, so newly
--               loaded flop spots are picked up on the next visit to /hands.
--
-- Like the preflop check, the grading runs in the app (it needs the
-- precomputed flop data and the signed-in hand-position endpoint); the
-- database only stores the result. hh_set_flop_checks() is the one way to
-- write it, and only for the caller's own hands.
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS flop_check   text,
  ADD COLUMN IF NOT EXISTS flop_detail  jsonb,
  ADD COLUMN IF NOT EXISTS flop_version text;

ALTER TABLE public.hh_hands DROP CONSTRAINT IF EXISTS hh_hands_flop_check_valid;
ALTER TABLE public.hh_hands ADD CONSTRAINT hh_hands_flop_check_valid CHECK (
  flop_check IS NULL OR flop_check IN ('good', 'ok', 'questionable', 'not_evaluated')
);

CREATE INDEX IF NOT EXISTS hh_hands_user_flop_idx
  ON public.hh_hands (user_id, flop_check, pot_bb DESC, played_at DESC, id DESC)
  WHERE flop_check IS NOT NULL;
CREATE INDEX IF NOT EXISTS hh_hands_user_flop_version_idx
  ON public.hh_hands (user_id, flop_version);

-- Write flop check results for the caller's own hands.
-- p_rows: [{ id, flop_check, flop_detail, flop_version }]
CREATE OR REPLACE FUNCTION public.hh_set_flop_checks(p_rows jsonb)
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
     SET flop_check   = r.flop_check,
         flop_detail  = r.flop_detail,
         flop_version = r.flop_version
    FROM jsonb_to_recordset(p_rows) AS r(id uuid, flop_check text, flop_detail jsonb, flop_version text)
   WHERE h.id = r.id
     AND h.user_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_set_flop_checks(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_set_flop_checks(jsonb) TO authenticated;
