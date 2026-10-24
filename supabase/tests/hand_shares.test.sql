-- Tests for supabase/migrations/20261025_03_hand_shares.sql (run by supabase/tests/run.sh,
-- after social_foundation.test.sql, whose users and helpers it reuses:
-- c52 = bob (river_bob), c53 = carol (blocked bob), c54 = mia (moderator), c55 = pro).
\set ON_ERROR_STOP on
\set QUIET on

-- d1 = dan (owner), d2 = eve (dan's friend), d3 = finn (stranger), d4 = gus (blocked by dan)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000dd1', 'dan@test'),
  ('00000000-0000-0000-0000-000000000dd2', 'eve@test'),
  ('00000000-0000-0000-0000-000000000dd3', 'finn@test'),
  ('00000000-0000-0000-0000-000000000dd4', 'gus@test');
INSERT INTO public.profiles (id, username) VALUES
  ('00000000-0000-0000-0000-000000000dd1', 'dan'),
  ('00000000-0000-0000-0000-000000000dd2', 'eve'),
  ('00000000-0000-0000-0000-000000000dd3', 'finn'),
  ('00000000-0000-0000-0000-000000000dd4', 'gus');
UPDATE public.subscriptions SET trial_ends_at = NULL WHERE user_id::text LIKE '00000000-0000-0000-0000-000000000dd%';
UPDATE public.profiles SET handle = 'dan_the_man' WHERE id = '00000000-0000-0000-0000-000000000dd1';
UPDATE public.profiles SET handle = 'eve_e' WHERE id = '00000000-0000-0000-0000-000000000dd2';
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES
  ('00000000-0000-0000-0000-000000000dd1', '00000000-0000-0000-0000-000000000dd2', 'accepted');
INSERT INTO public.blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-000000000dd1', '00000000-0000-0000-0000-000000000dd4');

-- A BTN-vs-BB hand: BTN opens, BB calls, flop c-bet, BB raises, BTN (Hero) decides (event 7), calls;
-- turn checks through; BB shows and wins.
CREATE OR REPLACE FUNCTION test.share_snapshot() RETURNS jsonb LANGUAGE sql AS $$
  SELECT '{
    "site": "ggpoker", "game": "Hold''em No Limit", "level": 5, "smallBlind": 100, "bigBlind": 200, "ante": 0,
    "playedAt": "2026-10-08T21:40:24", "maxSeats": 6, "buttonSeat": 1,
    "players": [
      {"seat": 1, "name": "Hero", "stack": 5000, "isHero": true,  "position": "BTN"},
      {"seat": 2, "name": "BB",   "stack": 6000, "isHero": false, "position": "BB"}
    ],
    "heroName": "Hero", "heroCards": ["Ah", "Kd"],
    "events": [
      {"kind": "post", "street": "preflop", "player": "Hero", "post": "small_blind", "amount": 100, "allIn": false},
      {"kind": "post", "street": "preflop", "player": "BB", "post": "big_blind", "amount": 200, "allIn": false},
      {"kind": "action", "street": "preflop", "player": "Hero", "action": "raise", "amount": 400, "toAmount": 500, "allIn": false},
      {"kind": "action", "street": "preflop", "player": "BB", "action": "call", "amount": 300, "allIn": false},
      {"kind": "deal", "street": "flop", "cards": ["Kh", "7c", "2d"]},
      {"kind": "action", "street": "flop", "player": "BB", "action": "check", "amount": 0, "allIn": false},
      {"kind": "action", "street": "flop", "player": "Hero", "action": "bet", "amount": 300, "allIn": false},
      {"kind": "action", "street": "flop", "player": "BB", "action": "raise", "amount": 900, "toAmount": 900, "allIn": false},
      {"kind": "action", "street": "flop", "player": "Hero", "action": "call", "amount": 600, "allIn": false},
      {"kind": "deal", "street": "turn", "cards": ["Qs"]},
      {"kind": "action", "street": "turn", "player": "BB", "action": "check", "amount": 0, "allIn": false},
      {"kind": "action", "street": "turn", "player": "Hero", "action": "check", "amount": 0, "allIn": false},
      {"kind": "deal", "street": "river", "cards": ["3s"]},
      {"kind": "show", "street": "river", "player": "BB", "cards": ["7h", "7d"]},
      {"kind": "show", "street": "river", "player": "Hero", "cards": ["Ah", "Kd"]},
      {"kind": "collect", "street": "river", "player": "BB", "amount": 2800}
    ],
    "board": {"flop": ["Kh", "7c", "2d"], "turn": "Qs", "river": "3s"},
    "shown": {"BB": ["7h", "7d"], "Hero": ["Ah", "Kd"]},
    "winners": [{"player": "BB", "amount": 2800}],
    "totalPot": 2800, "rake": 0,
    "handId": "SHOULD-BE-REMOVED", "tableName": "Daily Special 10 #4", "tournamentId": "T-77",
    "tournamentName": "Daily Special", "warnings": []
  }'::jsonb;
$$;
GRANT EXECUTE ON FUNCTION test.share_snapshot() TO anon, authenticated;

INSERT INTO public.hh_hands (id, user_id, site, hand_id, played_at, small_blind, big_blind, player_count, last_street,
                             pot_chips, pot_bb, hero_net_chips, hero_net_bb, hero_won, went_to_showdown, hero_all_in,
                             data, raw_text, parser, parser_version)
VALUES ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-000000000dd1', 'ggpoker', 'HD1', '2026-10-08 21:40',
        100, 200, 2, 'river', 2800, 14, -1400, -7, false, true, false, test.share_snapshot(), 'raw', 'ggpoker', 1),
       ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-000000000dd3', 'ggpoker', 'HD2', '2026-10-08 21:41',
        100, 200, 2, 'river', 2800, 14, -1400, -7, false, true, false, test.share_snapshot(), 'raw', 'ggpoker', 1);

\echo '── hand shares: creating'
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$
DECLARE r jsonb;
BEGIN
  -- Real screen names never get in.
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001',
      jsonb_set(test.share_snapshot(), '{players,1,name}', '"xX_Shark_Xx"'))$q$, 'social:share_invalid', 'screen name refused');
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001',
      jsonb_set(test.share_snapshot(), '{heroName}', '"dankedd"'))$q$, 'social:share_invalid', 'hero site name refused');
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001',
      jsonb_set(test.share_snapshot(), '{events,3,player}', '"villain123"'))$q$, 'social:share_invalid', 'unknown name in events refused');
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001',
      jsonb_set(test.share_snapshot(), '{shown}', '{"Fishy": ["7h","7d"]}'))$q$, 'social:share_invalid', 'unknown name in shown refused');
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(),
      'link', true, true, false, 'what a nazi play')$q$, 'social:text_hate', 'question passes the text filter');

  r := public.create_hand_share('00000000-0000-0000-0000-0000000d0002', test.share_snapshot());
  PERFORM test.eq(r ->> 'error', 'not_found', 'cannot share someone else''s hand');

  r := public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(), 'link', true, true, false, 'Call or fold?');
  PERFORM test.eq(r ->> 'slug' ~ '^[A-Za-z0-9]{7}$', true, 'link share created with a 7-char slug');
  PERFORM set_config('test.link', r ->> 'slug', false);

  r := public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(), 'friends', false, false, true,
                                'Hero to act on the flop', 7, ARRAY['fold', 'call', 'raise'], 'call');
  PERFORM set_config('test.guess', r ->> 'slug', false);
  r := public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(), 'public');
  PERFORM set_config('test.public', r ->> 'slug', false);

  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(),
      'link', true, true, true, NULL, 7, ARRAY['fold', 'call'], 'raise')$q$, 'check', 'actual choice must be an option');
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(),
      'link', true, true, true, NULL, 99, ARRAY['fold', 'call'], 'call')$q$, 'social:share_invalid', 'decision must be inside the hand');

  PERFORM test.eq((SELECT count(*) FROM public.my_hand_shares('00000000-0000-0000-0000-0000000d0001'))::int, 3, 'owner lists the shares');
  PERFORM test.eq((SELECT count(*) FROM public.hand_shares)::int, 3, 'owner reads own rows');
END $$;
RESET ROLE;

DO $$ BEGIN
  PERFORM test.eq((SELECT bool_and(NOT (hand ? 'handId') AND NOT (hand ? 'tableName') AND NOT (hand ? 'tournamentName') AND NOT (hand ? 'tournamentId'))
                     FROM public.hand_shares), true, 'identifying keys stripped');
  PERFORM test.eq((SELECT hand ->> 'playedAt' FROM public.hand_shares LIMIT 1), '2026-10-08', 'only the date is kept');
END $$;

\echo '── hand shares: who sees what'
SET ROLE anon;
SELECT test.as_user(NULL);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_shared_hand(current_setting('test.link'));
  PERFORM test.eq(r ->> 'question', 'Call or fold?', 'signed out: link share visible');
  PERFORM test.eq(r -> 'owner' ->> 'handle', 'dan_the_man', 'owner shown by handle');
  PERFORM test.eq(r -> 'owner' ? 'id', false, 'no owner id');
  PERFORM test.eq(r ->> 'view_count', NULL, 'view count is owner-only');
  PERFORM test.eq(jsonb_array_length(r -> 'hand' -> 'events'), 16, 'full hand');
  PERFORM test.eq(public.get_shared_hand(current_setting('test.guess')), NULL::jsonb, 'signed out: friends share hidden');
  PERFORM test.eq(public.get_shared_hand('zzzzzzz'), NULL::jsonb, 'unknown slug');
  PERFORM public.record_share_view(current_setting('test.link'));
  PERFORM test.raises($q$SELECT public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot())$q$, 'permission denied', 'anon cannot create');
  PERFORM test.eq((SELECT count(*) FROM public.hand_shares)::int, 0, 'anon reads no rows');
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$ BEGIN
  PERFORM test.eq(public.get_shared_hand(current_setting('test.guess')), NULL::jsonb, 'stranger: friends share hidden');
  PERFORM test.eq(public.get_shared_hand(current_setting('test.public')) IS NOT NULL, true, 'stranger: public share visible');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd4');
DO $$ BEGIN
  PERFORM test.eq(public.get_shared_hand(current_setting('test.link')), NULL::jsonb, 'blocked: not even the link share');
  PERFORM test.eq(public.get_shared_hand(current_setting('test.public')), NULL::jsonb, 'blocked: not even the public share');
END $$;

\echo '── hand shares: guess mode'
SELECT test.as_user('00000000-0000-0000-0000-000000000dd2');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_shared_hand(current_setting('test.guess'));
  PERFORM test.eq(r IS NOT NULL, true, 'friend sees the friends share');
  PERFORM test.eq(jsonb_array_length(r -> 'hand' -> 'events'), 7, 'cut before Hero''s decision');
  PERFORM test.eq(r -> 'hand' ->> 'truncated', 'true', 'marked truncated');
  PERFORM test.eq(r -> 'hand' -> 'board' -> 'turn', 'null'::jsonb, 'no turn card yet');
  PERFORM test.eq(r -> 'hand' -> 'board' -> 'flop', '["Kh", "7c", "2d"]'::jsonb, 'flop dealt');
  PERFORM test.eq(r -> 'hand' -> 'heroCards', 'null'::jsonb, 'hero cards hidden');
  PERFORM test.eq(r ->> 'actual_choice', NULL, 'answer not given away');
  PERFORM test.eq(r -> 'distribution', 'null'::jsonb, 'distribution only after voting');
  PERFORM test.eq((r -> 'hand' -> 'winners'), '[]'::jsonb, 'no winners');

  PERFORM test.raises($q$SELECT public.submit_hand_guess(current_setting('test.guess'), 'check')$q$, 'social:invalid', 'only the real options');
  r := public.submit_hand_guess(current_setting('test.guess'), 'raise');
  PERFORM test.eq(r ->> 'my_guess', 'raise', 'vote stored');
  PERFORM test.eq(r ->> 'actual_choice', 'call', 'answer after voting');
  PERFORM test.eq(r -> 'distribution', '{"raise": 1}'::jsonb, 'distribution after voting');
  PERFORM test.eq(jsonb_array_length(r -> 'hand' -> 'events'), 13, 'rest of the hand, result still hidden (no show/collect)');
  PERFORM test.eq(r -> 'hand' -> 'heroCards', 'null'::jsonb, 'hero cards stay hidden');
  r := public.submit_hand_guess(current_setting('test.guess'), 'fold');
  PERFORM test.eq(r ->> 'my_guess', 'raise', 'first vote counts');
END $$;
RESET ROLE;

SET ROLE anon;
SELECT test.as_user(NULL);
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM test.eq(public.submit_hand_guess(current_setting('test.guess'), 'fold', 'aaaaaaaa-0000-4000-8000-000000000001'),
                  NULL::jsonb, 'signed out cannot vote on a friends share');
END $$;
RESET ROLE;
-- A guess-mode link share for signed-out voting.
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
SELECT set_config('test.guess_link', (public.create_hand_share('00000000-0000-0000-0000-0000000d0001', test.share_snapshot(), 'link',
  true, true, true, NULL, 7, ARRAY['fold', 'call', 'raise'], 'call')) ->> 'slug', false) \gset
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_shared_hand(current_setting('test.guess_link'));
  PERFORM test.eq(jsonb_array_length(r -> 'hand' -> 'events'), 16, 'owner always sees the whole hand');
  PERFORM test.eq(r ->> 'is_owner', 'true', 'is_owner');
END $$;
RESET ROLE;
SET ROLE anon;
SELECT test.as_user(NULL);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.submit_hand_guess(current_setting('test.guess_link'), 'fold', 'aaaaaaaa-0000-4000-8000-000000000001');
  PERFORM test.eq(r ->> 'my_guess', 'fold', 'signed-out vote with browser id');
  PERFORM test.eq(jsonb_array_length(r -> 'hand' -> 'events'), 16, 'full hand with result');
  r := public.get_shared_hand(current_setting('test.guess_link'), 'aaaaaaaa-0000-4000-8000-000000000001');
  PERFORM test.eq(r ->> 'my_guess', 'fold', 'remembered by browser id');
  r := public.get_shared_hand(current_setting('test.guess_link'), 'bbbbbbbb-0000-4000-8000-000000000002');
  PERFORM test.eq(r ->> 'my_guess', NULL, 'another browser has not voted');
  PERFORM test.raises($q$SELECT public.submit_hand_guess(current_setting('test.guess_link'), 'fold', 'not-an-id')$q$, 'social:invalid', 'browser id required');
END $$;
RESET ROLE;

\echo '── hand shares: options, revoke, moderation'
DO $$ BEGIN
  PERFORM test.eq((SELECT view_count FROM public.hand_shares WHERE id = current_setting('test.link')), 1, 'view counted');
END $$;
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd1');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM test.eq(public.update_hand_share(current_setting('test.link'), 'link', true, false, 'Fold?') ->> 'ok', 'true', 'owner updates options');
  PERFORM test.eq(public.revoke_hand_share(current_setting('test.public')) ->> 'ok', 'true', 'owner revokes');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM test.eq(public.update_hand_share(current_setting('test.link'), 'public', true, true, NULL) ->> 'error', 'not_found', 'others cannot update');
  PERFORM test.eq(public.revoke_hand_share(current_setting('test.link')) ->> 'error', 'not_found', 'others cannot revoke');
  r := public.get_shared_hand(current_setting('test.link'));
  PERFORM test.eq(r ->> 'question', 'Fold?', 'updated question');
  PERFORM test.eq(r -> 'hand' -> 'winners', '[]'::jsonb, 'result hidden after update');
  PERFORM test.eq(public.get_shared_hand(current_setting('test.public')), NULL::jsonb, 'revoked share is gone');
  PERFORM test.eq(public.report_content('hand_share', current_setting('test.link'), 'spam') ->> 'ok', 'true', 'shares can be reported');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000c54');
DO $$ BEGIN
  PERFORM test.eq(public.mod_set_hidden('hand_share', current_setting('test.link'), true, 'spam') ->> 'ok', 'true', 'moderator hides a share');
  PERFORM test.eq(public.get_shared_hand(current_setting('test.link')) ->> 'hidden', 'true', 'moderator still sees it, flagged hidden');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd3');
DO $$ BEGIN
  PERFORM test.eq(public.get_shared_hand(current_setting('test.link')), NULL::jsonb, 'hidden share is gone for others');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000dd2');
DO $$ BEGIN
  PERFORM test.eq(jsonb_array_length(public.export_my_social_data() -> 'hand_guesses'), 1, 'export has my votes');
END $$;
RESET ROLE;

\echo '── hand shares: rate limit + deletion'
DO $$
DECLARE i int;
BEGIN
  -- dan already made 4 shares today (+ 4 rejected attempts that never reached the limit check… the 2 option errors did).
  PERFORM test.eq((SELECT count(*) FROM public.social_rate_events WHERE user_id = '00000000-0000-0000-0000-000000000dd1' AND action = 'share')::int >= 4, true, 'shares count toward the limit');
  DELETE FROM public.hh_hands WHERE id = '00000000-0000-0000-0000-0000000d0001';
  PERFORM test.eq((SELECT count(*) FROM public.hand_shares WHERE owner_id = '00000000-0000-0000-0000-000000000dd1')::int, 0, 'deleting the hand deletes its shares');
  PERFORM test.eq((SELECT count(*) FROM public.hand_guesses)::int, 0, 'and their votes');
END $$;
\echo 'hand shares: all tests passed'
