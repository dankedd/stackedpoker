-- ============================================================
-- Hand history — English preflop_check values
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history_preflop.sql,
-- and BEFORE deploying the app version that writes the English values.
-- Idempotent: safe to re-run.
--
--   te_los           → too_loose
--   te_strak         → too_tight
--   verkeerde_actie  → wrong_action
--   gemengd          → mixed
--   niet_beoordeeld  → not_evaluated
--   correct          (unchanged)
--
-- preflop_detail.reason also changes from Dutch text to a code; the app
-- handles that by itself: its check version went up, so every hand is
-- re-checked (and its detail rewritten) on the next visit to /hands.
-- ============================================================

ALTER TABLE public.hh_hands DROP CONSTRAINT IF EXISTS hh_hands_preflop_check_valid;

UPDATE public.hh_hands
   SET preflop_check = CASE preflop_check
         WHEN 'te_los'          THEN 'too_loose'
         WHEN 'te_strak'        THEN 'too_tight'
         WHEN 'verkeerde_actie' THEN 'wrong_action'
         WHEN 'gemengd'         THEN 'mixed'
         WHEN 'niet_beoordeeld' THEN 'not_evaluated'
       END
 WHERE preflop_check IN ('te_los', 'te_strak', 'verkeerde_actie', 'gemengd', 'niet_beoordeeld');

ALTER TABLE public.hh_hands ADD CONSTRAINT hh_hands_preflop_check_valid CHECK (
  preflop_check IS NULL
  OR preflop_check IN ('correct', 'too_loose', 'too_tight', 'wrong_action', 'mixed', 'not_evaluated')
);

-- Check: should return no rows.
-- SELECT preflop_check, count(*) FROM public.hh_hands
--  WHERE preflop_check NOT IN ('correct', 'too_loose', 'too_tight', 'wrong_action', 'mixed', 'not_evaluated')
--  GROUP BY 1;
