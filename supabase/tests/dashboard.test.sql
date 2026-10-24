-- Tests for supabase/migrations/20261025_05_dashboard.sql (run by supabase/tests/run.sh,
-- after hand_shares.test.sql, whose users and shares it reuses:
-- dd1 = dan (shared a 'friends' guess hand and a 'public' hand), dd2 = eve (dan's friend),
-- dd3 = finn (stranger)).
\set ON_ERROR_STOP on
\set QUIET on

-- The flop trainer's answer log (supabase_flop_trainer.sql), the columns read here.
CREATE TABLE IF NOT EXISTS public.flop_trainer_answers (
  id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text         NOT NULL,
  verdict     text         NOT NULL CHECK (verdict IN ('perfect', 'good', 'miss')),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ee1 = free player with two imported tournaments and a manual hand; ee2 = nobody yet.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ee1', 'ivy@test'),
  ('00000000-0000-0000-0000-000000000ee2', 'new@test');
INSERT INTO public.profiles (id, username) VALUES
  ('00000000-0000-0000-0000-000000000ee1', 'ivy'),
  ('00000000-0000-0000-0000-000000000ee2', 'new');
UPDATE public.subscriptions SET trial_ends_at = NULL WHERE user_id::text LIKE '00000000-0000-0000-0000-000000000ee%';

-- Fixture rows straight in: the Free upload limit (a trigger) is not under test here.
SET session_replication_role = replica;
INSERT INTO public.hh_tournaments (id, user_id, site, tournament_id, name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-000000000ee1', 'ggpoker', 'OLD', 'Old Daily', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-000000000ee1', 'ggpoker', 'NEW', 'Bounty Hunter', now() - interval '1 hour');

CREATE OR REPLACE FUNCTION test.ivy_hand(p_n int, p_tour text, p_at timestamp, p_pre text, p_flop text, p_site text DEFAULT 'ggpoker')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.hh_hands (id, user_id, site, hand_id, tournament_id, played_at, small_blind, big_blind, player_count, last_street,
                               pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown, hero_all_in,
                               data, raw_text, parser, parser_version, source, preflop_check, preflop_position, preflop_detail, flop_check)
  VALUES (('00000000-0000-0000-0000-0000000e1' || lpad(p_n::text, 3, '0'))::uuid, '00000000-0000-0000-0000-000000000ee1',
          p_site, 'IVY' || p_n, p_tour, p_at, 100, 200, 6, 'flop', 2000, 10, -500, -2.5, false, false, false,
          '{}'::jsonb, 'raw', p_site, 1, CASE WHEN p_site = 'manual' THEN 'manual' ELSE 'import' END, p_pre, 'LJ',
          CASE WHEN p_pre IS NOT NULL THEN '{"range": {"kind": "open", "chart": "open_mtt_lj_25"}}'::jsonb END, p_flop);
$$;

SELECT test.ivy_hand(1, 'OLD', '2026-10-01 20:00', 'too_tight', NULL);
SELECT test.ivy_hand(2, 'OLD', '2026-10-01 20:05', 'correct', 'questionable');
SELECT test.ivy_hand(3, 'NEW', '2026-10-20 20:00', 'correct', 'good');
SELECT test.ivy_hand(4, 'NEW', '2026-10-20 20:10', 'too_loose', NULL);
SELECT test.ivy_hand(5, 'NEW', '2026-10-20 20:20', 'correct', 'questionable');
SELECT test.ivy_hand(6, NULL, '2026-10-21 20:00', 'wrong_action', NULL, 'manual');
SET session_replication_role = origin;

-- Trainer history: opens 10 (8 good), defense 4 (1 good, all in one chart), 2 old hands outside the window.
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at)
SELECT '00000000-0000-0000-0000-000000000ee1', 'open:open_mtt_bn_25:25:A' || k, CASE WHEN k <= 8 THEN 'correct' ELSE 'wrong' END, now() - interval '1 day'
  FROM generate_series(1, 10) k;
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at)
SELECT '00000000-0000-0000-0000-000000000ee1', 'defense:def_mtt_bb_vs_bn_open_25:25:K' || k, CASE WHEN k = 1 THEN 'mixed' ELSE 'wrong' END, now() - interval '9 days'
  FROM generate_series(1, 4) k;
INSERT INTO public.trainer_hand_log (user_id, hand_ref, verdict, played_at) VALUES
  ('00000000-0000-0000-0000-000000000ee1', 'pushfold:push_sb:8:72o', 'wrong', now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000ee1', 'pushfold:push_sb:8:72o', 'wrong', now() - interval '60 days');
INSERT INTO public.flop_trainer_answers (user_id, category, verdict, created_at) VALUES
  ('00000000-0000-0000-0000-000000000ee1', 'paired', 'miss', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000ee1', 'paired', 'good', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000ee1', 'ace_high', 'perfect', now() - interval '2 days');

\echo '── dashboard: hands, last tournament, leaks'
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000ee1');
DO $$
DECLARE d jsonb := public.my_dashboard(30);
BEGIN
  PERFORM test.eq((d #>> '{hands,imported}')::int, 5, 'hands imported: manual hands do not count');
  PERFORM test.eq((d #>> '{hands,tournaments}')::int, 2, 'two tournaments');
  PERFORM test.eq(d #>> '{last_tournament,name}', 'Bounty Hunter', 'last tournament = latest import');
  PERFORM test.eq((d #>> '{last_tournament,mistakes}')::int, 2, 'preflop + flop mistakes in the last tournament');
  PERFORM test.eq((d #>> '{last_tournament,reviewed}')::boolean, false, 'not reviewed yet');
  -- Free: only the latest tournament's hands, like the hh_hands RLS rule.
  PERFORM test.eq(jsonb_array_length(d -> 'leaks'), 2, 'free: leaks only from the visible tournament');
  PERFORM test.eq(d #>> '{leaks,0,street}', 'flop', 'newest mistake first (flop questionable)');
  PERFORM test.eq(d #>> '{leaks,1,verdict}', 'too_loose', 'then the preflop mistake');
  PERFORM test.eq(d #>> '{leaks,1,chart}', 'open:open_mtt_lj_25', 'preflop leak carries its chart for "Train this spot"');
  PERFORM test.eq(d #>> '{leaks,1,tournament_id}', '00000000-0000-0000-0000-0000000e0002', 'leak links its tournament');
END $$;

\echo '── dashboard: skill'
DO $$
DECLARE d jsonb := public.my_dashboard(30);
BEGIN
  PERFORM test.eq(d #> '{skill,preflop,open}', '[10, 8]'::jsonb, 'opens: 10 hands, 8 good');
  PERFORM test.eq(d #> '{skill,preflop,defense}', '[4, 1]'::jsonb, 'defense: a mixed answer counts as good');
  PERFORM test.eq(d #> '{skill,preflop,pushfold}', NULL::jsonb, 'push/fold outside the 30-day window');
  PERFORM test.eq(d #> '{skill,preflop_spots,0}', '["defense:def_mtt_bb_vs_bn_open_25", 4, 3]'::jsonb, 'weakest chart first');
  PERFORM test.eq(d #> '{skill,flop,categories,paired}', '[2, 1]'::jsonb, 'flop by texture');
  PERFORM test.eq((d #>> '{skill,flop,good}')::int, 2, 'perfect and good both count');
  PERFORM test.eq(d #> '{skill,week}', '[[13, 10], [4, 1]]'::jsonb, 'this week vs last week, both trainers');
  PERFORM test.eq((public.my_dashboard(90) #> '{skill,preflop,pushfold}'), '[2, 0]'::jsonb, 'window is a parameter');
END $$;

\echo '── dashboard: reviewed'
DO $$ BEGIN
  PERFORM test.eq(public.hh_mark_reviewed(p_hand := '00000000-0000-0000-0000-0000000e1004'), true, 'opening a hand reviews its tournament');
  PERFORM test.eq(public.hh_mark_reviewed(p_tournament := '00000000-0000-0000-0000-0000000e0002'), false, 'only the first time counts');
  PERFORM test.eq((public.my_dashboard() #>> '{last_tournament,reviewed}')::boolean, true, 'dashboard sees it');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000ee2');
DO $$
DECLARE d jsonb := public.my_dashboard();
BEGIN
  PERFORM test.eq(public.hh_mark_reviewed(p_tournament := '00000000-0000-0000-0000-0000000e0001'), false, 'cannot mark someone else''s tournament');
  PERFORM test.eq((d #>> '{hands,imported}')::int, 0, 'new user: no hands');
  PERFORM test.eq(d -> 'last_tournament', 'null'::jsonb, 'new user: no tournament');
  PERFORM test.eq(d -> 'leaks', '[]'::jsonb, 'new user: no leaks');
  PERFORM test.eq(d #> '{skill,preflop}', '{}'::jsonb, 'new user: no trainer hands');
  PERFORM test.eq(d #> '{social,friends}', '0'::jsonb, 'new user: no friends');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM test.eq((SELECT reviewed_at IS NULL FROM public.hh_tournaments WHERE id = '00000000-0000-0000-0000-0000000e0001'), true,
                  'the other user''s call changed nothing');
END $$;

\echo '── dashboard: social'
-- hand_shares.test.sql ends by deleting dan's hand (and with it his shares): three new ones.
INSERT INTO public.hh_hands (id, user_id, site, hand_id, played_at, small_blind, big_blind, player_count, last_street,
                             pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown, hero_all_in,
                             data, raw_text, parser, parser_version)
VALUES ('00000000-0000-0000-0000-0000000d0101', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'HDASH', '2026-10-08 21:40',
        100, 200, 2, 'river', 2800, 14, -1400, -7, false, true, false, test.share_snapshot(), 'raw', 'ggpoker', 1);
INSERT INTO public.hand_shares (id, hand_id, owner_id, visibility, guess_mode, question, hand, decision_index, decision_options, actual_choice) VALUES
  ('DashFr1', '00000000-0000-0000-0000-0000000d0101', '00000000-0000-0000-0000-000000000dd1', 'friends', true, 'Call or raise?',
   test.share_snapshot(), 7, ARRAY['fold', 'call', 'raise'], 'call'),
  ('DashPu1', '00000000-0000-0000-0000-0000000d0101', '00000000-0000-0000-0000-000000000dd1', 'public', false, NULL, test.share_snapshot(), NULL, NULL, NULL),
  ('DashLi1', '00000000-0000-0000-0000-0000000d0101', '00000000-0000-0000-0000-000000000dd1', 'link', false, NULL, test.share_snapshot(), NULL, NULL, NULL);
INSERT INTO public.hand_guesses (share_id, user_id, choice) VALUES
  ('DashFr1', '00000000-0000-0000-0000-000000000dd3', 'raise');

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd2');
DO $$
DECLARE d jsonb := public.my_dashboard();
BEGIN
  PERFORM test.eq((d #>> '{social,friends}')::int, 1, 'eve has one friend');
  PERFORM test.eq((SELECT count(*) FROM jsonb_array_elements(d #> '{social,feed}') e WHERE e ->> 'kind' = 'share')::int, 2,
                  'eve sees dan''s friends and public shares, not the link-only one');
  PERFORM test.eq((SELECT bool_and(e #>> '{actor,handle}' = 'dan_the_man') FROM jsonb_array_elements(d #> '{social,feed}') e), true,
                  'feed items name the friend');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$ BEGIN
  PERFORM test.eq(public.my_dashboard() #> '{social,feed}', '[]'::jsonb, 'a stranger sees nothing in the feed');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$
DECLARE d jsonb := public.my_dashboard();
BEGIN
  PERFORM test.eq(jsonb_array_length(d #> '{social,shares}'), 3, 'dan''s own shares, every visibility');
  PERFORM test.eq((SELECT e -> 'top' FROM jsonb_array_elements(d #> '{social,shares}') e WHERE e ->> 'slug' = 'DashFr1'), '["raise", 1]'::jsonb,
                  'the top choice with its vote count');
  PERFORM test.eq((SELECT bool_and(e ? 'views' AND e ? 'votes') FROM jsonb_array_elements(d #> '{social,shares}') e), true,
                  'shares carry views and votes');
END $$;
RESET ROLE;
SET ROLE anon;
SELECT test.as_user(NULL);
DO $$ BEGIN
  PERFORM public.my_dashboard();
  RAISE EXCEPTION 'anon called my_dashboard';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
\echo 'dashboard: all tests passed'
