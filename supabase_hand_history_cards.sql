-- ============================================================
-- Hand history — card search
-- Run this in the Supabase SQL Editor AFTER the other supabase_hand_history_*.sql
-- files. Idempotent: safe to re-run.
--
-- hero_hand  Hero's hand class ("AQo", "T9s", "55"), generated from
--            hero_cards — filled for every existing hand when the column is
--            added and kept right on every insert, with no app change.
--
-- The hand list's card search (frontend/lib/handHistory/cardSearch.ts)
-- filters on it: "AQ" → hero_hand IN (AQs, AQo), "55" → hero_hand = 55;
-- exact cards ("AhQd", "Ah") use hero_cards directly.
-- ============================================================

-- ["Qd","Ah"] → "AQo"; ["Js","Jd"] → "JJ"; same rules as handClass() in
-- frontend/lib/handHistory/preflop/spots.ts. IMMUTABLE so it can back a
-- generated column.
CREATE OR REPLACE FUNCTION public.hh_hand_class(cards text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN cards IS NULL OR array_length(cards, 1) IS DISTINCT FROM 2 THEN NULL
    WHEN position(upper(substr(cards[1], 1, 1)) IN 'AKQJT98765432') = 0
      OR position(upper(substr(cards[2], 1, 1)) IN 'AKQJT98765432') = 0 THEN NULL
    WHEN upper(substr(cards[1], 1, 1)) = upper(substr(cards[2], 1, 1))
      THEN upper(substr(cards[1], 1, 1)) || upper(substr(cards[2], 1, 1))
    ELSE
      CASE WHEN position(upper(substr(cards[1], 1, 1)) IN 'AKQJT98765432')
              < position(upper(substr(cards[2], 1, 1)) IN 'AKQJT98765432')
           THEN upper(substr(cards[1], 1, 1)) || upper(substr(cards[2], 1, 1))
           ELSE upper(substr(cards[2], 1, 1)) || upper(substr(cards[1], 1, 1))
      END
      || CASE WHEN lower(substr(cards[1], 2, 1)) = lower(substr(cards[2], 2, 1)) THEN 's' ELSE 'o' END
  END
$$;

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS hero_hand text GENERATED ALWAYS AS (public.hh_hand_class(hero_cards)) STORED;

CREATE INDEX IF NOT EXISTS hh_hands_user_hero_hand_idx ON public.hh_hands (user_id, hero_hand);
CREATE INDEX IF NOT EXISTS hh_hands_hero_cards_gin_idx ON public.hh_hands USING gin (hero_cards);

-- Check: should list hand classes like AQo, JJ, T9s.
-- SELECT hero_cards, hero_hand FROM public.hh_hands LIMIT 10;
