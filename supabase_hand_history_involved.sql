-- ============================================================
-- Hand history — "Hero involved" + Hero's investment in BB
-- Run this in the Supabase SQL Editor AFTER supabase_hand_history.sql.
-- Idempotent: safe to re-run.
--
-- hero_involved     Hero called, bet or raised on any street (all-ins
--                   included), or showed down. Posting ante/blinds and then
--                   folding, a walk in the BB, or BB check → fold on the flop
--                   is NOT involved. Same rule as isHeroInvolved() in
--                   frontend/lib/handHistory/derive.ts.
-- hero_invested_bb  Everything Hero put in (antes and blinds included), minus
--                   uncalled bets returned, divided by the big blind.
--
-- Backfill: computed from `data`, the parsed form of `raw_text` stored by the
-- same parser version (1) the app runs now — so the result is identical to
-- re-parsing the raw text, without porting the parser to SQL.
-- ============================================================

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS hero_involved    boolean,
  ADD COLUMN IF NOT EXISTS hero_invested_bb numeric(10,2);

UPDATE public.hh_hands h
   SET hero_involved =
         EXISTS (
           SELECT 1
             FROM jsonb_array_elements(h.data->'events') e
            WHERE e->>'kind' = 'action'
              AND e->>'player' = h.data->>'heroName'
              AND e->>'action' IN ('call', 'bet', 'raise')
         )
         OR COALESCE((h.data->'shown') ? (h.data->>'heroName'), false),
       hero_invested_bb = round(
         COALESCE((
           SELECT sum(CASE
                        WHEN e->>'kind' IN ('post', 'action') THEN (e->>'amount')::numeric
                        WHEN e->>'kind' = 'uncalled'         THEN -(e->>'amount')::numeric
                        ELSE 0
                      END)
             FROM jsonb_array_elements(h.data->'events') e
            WHERE e->>'player' = h.data->>'heroName'
         ), 0) / h.big_blind,
         2)
 WHERE h.hero_involved IS NULL OR h.hero_invested_bb IS NULL;

ALTER TABLE public.hh_hands
  ALTER COLUMN hero_involved    SET DEFAULT false,
  ALTER COLUMN hero_involved    SET NOT NULL,
  ALTER COLUMN hero_invested_bb SET DEFAULT 0,
  ALTER COLUMN hero_invested_bb SET NOT NULL;

-- Default overview: involved hands, biggest pot first.
CREATE INDEX IF NOT EXISTS hh_hands_user_involved_pot_idx
  ON public.hh_hands (user_id, pot_bb DESC, played_at DESC, id DESC) WHERE hero_involved;
-- "Mijn inzet (BB)" sort.
CREATE INDEX IF NOT EXISTS hh_hands_user_invested_idx
  ON public.hh_hands (user_id, hero_invested_bb DESC, played_at DESC, id DESC);

-- Check: for the Daily Special $10 of 2026-10-08 this returns 107 / 15 / 5.
-- SELECT count(*), count(*) FILTER (WHERE hero_involved),
--        count(*) FILTER (WHERE hero_involved AND pot_bb >= 20)
--   FROM public.hh_hands WHERE tournament_id = '316999261';
