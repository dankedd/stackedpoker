-- ============================================================
-- Hand history — replayer analysis for the AI coach
-- Run this in the Supabase SQL Editor AFTER the other supabase_hand_history_*.sql
-- files. Idempotent: safe to re-run.
--
-- analysis          what the replayer computed for this hand: villain, the
--                   trainer range used (+ approximation warning), Hero's
--                   equity per street, and pot odds at every decision
--                   (shape: HandAnalysis in frontend/lib/handHistory/analysis.ts).
--                   The coach reads it from here, so it quotes exactly the
--                   numbers shown on screen.
-- analysis_version  version of that computation; the replayer rewrites the
--                   analysis when it changes.
--
-- Written by the replayer through hh_set_analysis(), for the caller's own
-- hands only (hh_hands has no UPDATE policy). Coach conversations need no
-- schema change: they are training_sessions rows with session_type
-- 'hand_review' and context {"hand_ref": <hand id>}.
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS analysis         jsonb,
  ADD COLUMN IF NOT EXISTS analysis_version text;

CREATE OR REPLACE FUNCTION public.hh_set_analysis(p_id uuid, p_analysis jsonb, p_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_analysis IS NOT NULL AND pg_column_size(p_analysis) > 65536 THEN
    RAISE EXCEPTION 'analysis too large' USING ERRCODE = '22023';
  END IF;
  UPDATE public.hh_hands h
     SET analysis = p_analysis,
         analysis_version = p_version
   WHERE h.id = p_id
     AND h.user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hand not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_set_analysis(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_set_analysis(uuid, jsonb, text) TO authenticated;

-- Finding the open hand-review conversation per user per hand.
CREATE INDEX IF NOT EXISTS training_sessions_hand_review_idx
  ON public.training_sessions (user_id, (context->>'hand_ref'), started_at DESC)
  WHERE session_type = 'hand_review';
