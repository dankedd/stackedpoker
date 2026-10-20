-- Tests for supabase_manual_hands.sql (run by supabase/tests/run.sh).
\set ON_ERROR_STOP on
\set QUIET on

-- M: a Free user (trial already over). O: someone else.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'm@test'),
  ('00000000-0000-0000-0000-0000000000f2', 'o@test');
INSERT INTO public.profiles (id) VALUES ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2');
UPDATE public.subscriptions SET trial_ends_at = now() - interval '1 day'
 WHERE user_id IN ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');

-- A minimal hand row (the app fills every column through toInsertRow).
CREATE FUNCTION test.hand(p_user uuid, p_site text, p_source text, p_hand text, p_tournament text, p_pot numeric DEFAULT 30)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'user_id', p_user, 'site', p_site, 'source', p_source, 'hand_id', p_hand, 'tournament_id', p_tournament,
    'played_at', '2026-10-19T20:00:00', 'small_blind', 500, 'big_blind', 1000, 'ante', 0, 'board', '[]'::jsonb, 'player_count', 9,
    'last_street', 'river', 'pot_chips', p_pot * 1000, 'pot_bb', p_pot, 'hero_net_chips', 0, 'hero_net_bb', 0,
    'hero_won', false, 'went_to_showdown', true, 'hero_all_in', false, 'hero_involved', true,
    'hero_invested_bb', 10, 'table_name', '1', 'max_seats', 9, 'button_seat', 9, 'hero_position', 'BTN',
    'hero_cards', '["As","Kd"]'::jsonb,
    'data', '{}'::jsonb, 'raw_text', '', 'parser', p_site, 'parser_version', 1)
$$;
GRANT EXECUTE ON FUNCTION test.hand(uuid, text, text, text, text, numeric) TO authenticated;

-- Inserts as the calling user (RLS applies), naming the columns like the app does.
CREATE FUNCTION test.insert_hand(p jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.hh_hands (id, user_id, site, source, hand_id, tournament_id, played_at, small_blind, big_blind,
                               player_count, last_street, pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won,
                               went_to_showdown, hero_all_in, hero_involved, data, raw_text, parser, parser_version)
  SELECT COALESCE(r.id, gen_random_uuid()), r.user_id, r.site, r.source, r.hand_id, r.tournament_id, r.played_at, r.small_blind,
         r.big_blind, r.player_count, r.last_street, r.pot_chips, r.pot_bb, r.hero_net_chips, r.hero_net_bb, r.hero_won,
         r.went_to_showdown, r.hero_all_in, r.hero_involved, r.data, r.raw_text, r.parser, r.parser_version
    FROM jsonb_populate_record(NULL::public.hh_hands, p) r
$$;
GRANT EXECUTE ON FUNCTION test.insert_hand(jsonb) TO authenticated;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false) \gset

\echo '── manual hands: free, unlimited, never an upload'
-- This week's one upload…
INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'ggpoker', 'G1', 'Online');
SELECT test.insert_hand(test.hand('00000000-0000-0000-0000-0000000000f1', 'ggpoker', 'import', 'TM1', 'G1') || '{"id":"10000000-0000-0000-0000-000000000001"}');

-- …then a live tournament and three manual hands (two in it, one loose).
INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'manual', 'holland-casino-main', 'Holland Casino Main Event');
SELECT test.insert_hand(test.hand('00000000-0000-0000-0000-0000000000f1', 'manual', 'manual', 'M1', 'holland-casino-main') || '{"id":"20000000-0000-0000-0000-000000000001"}');
SELECT test.insert_hand(test.hand('00000000-0000-0000-0000-0000000000f1', 'manual', 'manual', 'M2', 'holland-casino-main', 4) || '{"id":"20000000-0000-0000-0000-000000000002"}');
SELECT test.insert_hand(test.hand('00000000-0000-0000-0000-0000000000f1', 'manual', 'manual', 'M3', NULL) || '{"id":"20000000-0000-0000-0000-000000000003"}');

DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.usage_events WHERE metric = 'tournament_upload'), 1::bigint, 'manual tournament is not an upload');
  PERFORM test.eq((public.my_entitlements() -> 'usage' ->> 'tournaments_this_week')::int, 1, 'entitlements still say 1/1 upload');
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands WHERE source = 'manual'), 3::bigint, 'all manual hands visible on Free');
  PERFORM test.eq((SELECT tournament_count FROM (SELECT count(*) AS tournament_count FROM public.hh_tournaments WHERE site = 'manual') x), 1::bigint, 'manual tournament visible on Free');
END $$;

-- The manual tournament must not become "the latest upload": a second
-- online tournament is still refused, and the first one stays visible.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.hh_tournaments (user_id, site, tournament_id, name)
    VALUES ('00000000-0000-0000-0000-0000000000f1', 'ggpoker', 'G2', 'Online 2');
    RAISE EXCEPTION 'FAIL second upload accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'UPLOAD_LIMIT_REACHED' THEN RAISE; END IF;
    RAISE NOTICE 'ok   weekly upload limit unchanged by manual hands';
  END;
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands WHERE source = 'import'), 1::bigint, 'latest upload still visible next to manual hands');
  PERFORM test.eq((public.my_entitlements() ->> 'hidden_tournaments')::int, 0, 'manual tournaments not counted as hidden');
END $$;

\echo '── source and site must agree'
DO $$
BEGIN
  BEGIN
    SELECT test.insert_hand(test.hand('00000000-0000-0000-0000-0000000000f1', 'ggpoker', 'manual', 'X1', NULL));
    RAISE EXCEPTION 'FAIL manual source on an imported site accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok   source=manual requires site=manual';
  END;
END $$;

\echo '── editing'
DO $$
BEGIN
  PERFORM public.hh_update_manual_hand('20000000-0000-0000-0000-000000000003',
    test.hand('00000000-0000-0000-0000-0000000000f1', 'manual', 'manual', 'M3', 'holland-casino-main', 55));
  PERFORM test.eq((SELECT pot_bb FROM public.hh_hands WHERE id = '20000000-0000-0000-0000-000000000003'), 55::numeric, 'manual hand edited');
  PERFORM test.eq((SELECT tournament_id FROM public.hh_hands WHERE id = '20000000-0000-0000-0000-000000000003'), 'holland-casino-main', 'moved into the tournament');

  BEGIN
    PERFORM public.hh_update_manual_hand('10000000-0000-0000-0000-000000000001',
      test.hand('00000000-0000-0000-0000-0000000000f1', 'ggpoker', 'import', 'TM1', 'G1', 99));
    RAISE EXCEPTION 'FAIL edited an imported hand';
  EXCEPTION WHEN no_data_found THEN
    RAISE NOTICE 'ok   imported hands cannot be edited';
  END;

  BEGIN
    PERFORM public.hh_update_manual_hand('20000000-0000-0000-0000-000000000001',
      test.hand('00000000-0000-0000-0000-0000000000f1', 'manual', 'manual', 'M1', 'not-mine', 30));
    RAISE EXCEPTION 'FAIL moved a hand into an unknown tournament';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'ok   unknown tournament rejected';
  END;

  -- Plain UPDATE stays impossible: no policy for it.
  UPDATE public.hh_hands SET pot_bb = 1 WHERE id = '20000000-0000-0000-0000-000000000001';
  PERFORM test.eq((SELECT pot_bb FROM public.hh_hands WHERE id = '20000000-0000-0000-0000-000000000001'), 30::numeric, 'direct UPDATE still blocked');

  DELETE FROM public.hh_hands WHERE id = '20000000-0000-0000-0000-000000000002';
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands WHERE source = 'manual'), 2::bigint, 'manual hand deleted');
END $$;

RESET ROLE;
DO $$
BEGIN
  PERFORM test.eq((SELECT hand_count FROM public.hh_tournaments WHERE site = 'manual' AND tournament_id = 'holland-casino-main'), 2,
                  'tournament hand count follows inserts, the move and the delete');
END $$;
SET ROLE authenticated;

\echo '── someone else''s manual hand'
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false) \gset
DO $$
BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.hh_hands), 0::bigint, 'other users'' manual hands invisible');
  BEGIN
    PERFORM public.hh_update_manual_hand('20000000-0000-0000-0000-000000000001',
      test.hand('00000000-0000-0000-0000-0000000000f2', 'manual', 'manual', 'M1', NULL, 1));
    RAISE EXCEPTION 'FAIL edited someone else''s hand';
  EXCEPTION WHEN no_data_found THEN
    RAISE NOTICE 'ok   cannot edit someone else''s manual hand';
  END;
END $$;

\echo '── usage events'
INSERT INTO public.hh_manual_events (user_id, kind, game_type, streets_entered)
VALUES ('00000000-0000-0000-0000-0000000000f2', 'saved', 'tournament', 4);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.hh_manual_events (user_id, kind) VALUES ('00000000-0000-0000-0000-0000000000f1', 'started');
    RAISE EXCEPTION 'FAIL logged an event for someone else';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   events only for yourself';
  END;
  PERFORM test.eq((SELECT count(*) FROM public.hh_manual_events), 1::bigint, 'own events readable');
END $$;
RESET ROLE;

\echo 'ALL MANUAL HAND SQL TESTS PASSED'
