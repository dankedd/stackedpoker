-- ============================================================
-- Flop Equity Trainer — precomputed flop data (Phase 1)
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- Filled offline by backend/app/flop_equity (precompute + load). Spots,
-- ranges and bucket definitions come from Modern Poker Theory (data/mpt).
--
--   flop_spots         one row per spot (positions, stack, preflop action)
--   flop_equity        one row per spot and canonical flop (1,755 per spot):
--                      equities, Equity Bucket shares, nut advantage, hand
--                      classes, texture labels — public read (the trainer)
--   flop_equity_hands  per starting hand equity for the 13x13 heatmap
--                      (Explorer, Pro). No read policy yet: Phase 3 adds a
--                      Pro-checked function, so the paywall can't be skipped.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.flop_spots (
  spot_id        text         PRIMARY KEY,
  spot_type      text         NOT NULL CHECK (spot_type IN ('srp', 'cold_call', '3bet')),
  ip             text         NOT NULL,
  oop            text         NOT NULL,
  stack_bb       integer      NOT NULL CHECK (stack_bb > 0),
  action         text         NOT NULL,              -- e.g. 'BN opens 2.3x, folds to BB, BB calls'
  ip_range_pct   numeric(5,2),
  oop_range_pct  numeric(5,2),
  source_pages   integer[]    NOT NULL DEFAULT '{}', -- 1-based PDF pages of the ranges
  enabled        boolean      NOT NULL DEFAULT true,
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flop_equity (
  spot_id       text          NOT NULL REFERENCES public.flop_spots(spot_id) ON DELETE CASCADE,
  flop          text          NOT NULL,              -- canonical, e.g. 'AcQd3h'
  flop_weight   smallint      NOT NULL CHECK (flop_weight BETWEEN 1 AND 24), -- specific flops it stands for
  equity_ip     numeric(5,2)  NOT NULL,
  equity_oop    numeric(5,2)  NOT NULL,
  buckets_ip    jsonb         NOT NULL,              -- {"strong":..,"good":..,"weak":..,"trash":..} in %
  buckets_oop   jsonb         NOT NULL,
  nut_adv       jsonb         NOT NULL,              -- {"metric":"strong_share","ip":..,"oop":..,"diff":..,"leader":"IP|OOP|EQUAL"}
  hand_classes  jsonb         NOT NULL,              -- {"ip":{"Top Pair":[share%, equity%],..},"oop":{..}}
  texture       text[]        NOT NULL,
  PRIMARY KEY (spot_id, flop)
);

CREATE INDEX IF NOT EXISTS flop_equity_texture_idx ON public.flop_equity USING gin (texture);

CREATE TABLE IF NOT EXISTS public.flop_equity_hands (
  spot_id  text   NOT NULL,
  flop     text   NOT NULL,
  hands    jsonb  NOT NULL,                          -- {"ip":{"AKs":[freq, equity%],..},"oop":{..}}
  PRIMARY KEY (spot_id, flop),
  FOREIGN KEY (spot_id, flop) REFERENCES public.flop_equity(spot_id, flop) ON DELETE CASCADE
);

ALTER TABLE public.flop_spots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flop_equity       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flop_equity_hands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flop_spots_public_read" ON public.flop_spots;
CREATE POLICY "flop_spots_public_read" ON public.flop_spots
  FOR SELECT TO anon, authenticated USING (enabled);

DROP POLICY IF EXISTS "flop_equity_public_read" ON public.flop_equity;
CREATE POLICY "flop_equity_public_read" ON public.flop_equity
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.flop_spots s WHERE s.spot_id = flop_equity.spot_id AND s.enabled));

GRANT SELECT ON public.flop_spots, public.flop_equity TO anon, authenticated;
-- flop_equity_hands: no policy and no grant — service role only until Phase 3.
