-- ============================================================
-- Hand history — preflop check, defense spots
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history_preflop.sql,
-- and BEFORE deploying the app that filters on spot type. Idempotent: safe to re-run.
--
-- The preflop check now also grades Hero facing an open, a shove, a limp, a
-- 4-bet or a limp-raise (frontend/lib/handHistory/preflop). The kind of the
-- graded decision is already inside preflop_detail (spot.kind); this file
-- only makes it queryable:
--
-- preflop_spot   rfi | vs_open | vs_push | vs_limp | vs_4bet | vs_limp_raise |
--                other — generated from preflop_detail, so the app never
--                writes it and it can't drift from the stored check.
--
-- Existing hands need no backfill here: the app's PREFLOP_CHECK_VERSION
-- changed, so every stored hand is re-checked (and gets its defense verdict)
-- on the user's next visit to /hands — the same mechanism as every range
-- update (refreshPreflopChecks → hh_set_preflop_checks).
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS preflop_spot text GENERATED ALWAYS AS (preflop_detail #>> '{spot,kind}') STORED;

CREATE INDEX IF NOT EXISTS hh_hands_user_preflop_spot_idx
  ON public.hh_hands (user_id, preflop_spot, preflop_check)
  WHERE preflop_spot IS NOT NULL;

-- Counts per verdict, chart position and spot kind for the overview's summary.
-- The return type gains a column, so the old function has to go first.
DROP FUNCTION IF EXISTS public.hh_preflop_summary();
CREATE FUNCTION public.hh_preflop_summary()
RETURNS TABLE (preflop_check text, preflop_position text, preflop_spot text, n bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT h.preflop_check, h.preflop_position, h.preflop_spot, count(*)
    FROM public.hh_hands h
   WHERE h.user_id = auth.uid() AND h.preflop_check IS NOT NULL
   GROUP BY 1, 2, 3;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_preflop_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_preflop_summary() TO authenticated;
