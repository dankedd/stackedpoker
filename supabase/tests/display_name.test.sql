-- Tests for supabase_display_name.sql (run by supabase/tests/run.sh).
\set ON_ERROR_STOP on
\set QUIET on

-- b1: Google signup (no username in the form) → no name, falls back.
-- b2: email signup with a good username → becomes the display name.
-- b3: email signup whose username is the email local part → not used.
-- b4: email signup with a reserved username → not used, signup still works.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000006b1', 'jane.doe@gmail.test', '{"full_name": "Jane Doe"}'),
  ('00000000-0000-0000-0000-0000000006b2', 'rob@test',            '{"username": "RiverRat"}'),
  ('00000000-0000-0000-0000-0000000006b3', 'sharky@test',         '{"username": "sharky"}'),
  ('00000000-0000-0000-0000-0000000006b4', 'x@test',              '{"username": "Admin"}');
INSERT INTO public.profiles (id, username) VALUES
  ('00000000-0000-0000-0000-0000000006b1', 'jane.doe'),
  ('00000000-0000-0000-0000-0000000006b2', 'RiverRat'),
  ('00000000-0000-0000-0000-0000000006b3', 'sharky'),
  ('00000000-0000-0000-0000-0000000006b4', 'Admin');
INSERT INTO public.user_skill_progress (user_id, total_xp) VALUES
  ('00000000-0000-0000-0000-0000000006b1', 900),
  ('00000000-0000-0000-0000-0000000006b2', 500),
  ('00000000-0000-0000-0000-0000000006b3', 100);
INSERT INTO public.xp_events (user_id, amount, source_type) VALUES
  ('00000000-0000-0000-0000-0000000006b1', 40, 'lesson');

DO $$
DECLARE
  fallback text := 'Player ' || left(md5('00000000-0000-0000-0000-0000000006b1'), 4);
BEGIN
  -- Rules
  PERFORM test.eq(public.display_name_problem('Ok_Name-1.x'), NULL::text, 'valid name');
  PERFORM test.eq(public.display_name_problem('ab'), 'length', 'too short');
  PERFORM test.eq(public.display_name_problem(repeat('a', 21)), 'length', 'too long');
  PERFORM test.eq(public.display_name_problem('jane@doe'), 'characters', '@ is not allowed');
  PERFORM test.eq(public.display_name_problem('two words'), 'characters', 'spaces are not allowed');
  PERFORM test.eq(public.display_name_problem('_lead'), 'characters', 'must start with a letter or digit');
  PERFORM test.eq(public.display_name_problem('SuperAdmin'), 'reserved', 'admin anywhere');
  PERFORM test.eq(public.display_name_problem('St4cked_P0ker'), 'reserved', 'leetspeak brand');
  PERFORM test.eq(public.display_name_problem('support'), 'reserved', 'support');
  PERFORM test.eq(public.display_name_problem('Player_3f9a'), 'reserved', 'fallback lookalike');
  PERFORM test.eq(public.display_name_problem('PlayerOne'), NULL::text, 'player + word is fine');
  PERFORM test.eq(public.display_name_problem('modern'), NULL::text, 'mod only blocked as a whole name');
  PERFORM test.eq(public.display_name_problem('Sh1tHead'), 'profanity', 'leetspeak profanity');
  PERFORM test.eq(public.display_name_problem('Catering'), NULL::text, 'no Scunthorpe on short Dutch words');
  PERFORM test.eq(public.display_name_problem('Classic'), NULL::text, 'ass only blocked as a whole name');

  -- Signup seeding
  PERFORM test.eq((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000006b1'), NULL::text, 'google signup: no name');
  PERFORM test.eq((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000006b2'), 'RiverRat', 'signup username seeds the name');
  PERFORM test.eq((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000006b3'), NULL::text, 'email local part is not seeded');
  PERFORM test.eq((SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000006b4'), NULL::text, 'reserved signup username is not seeded');

  -- Public functions never show profiles.username
  PERFORM test.eq((SELECT username FROM public.leaderboard_all_time(10, 0) WHERE rank = 1), fallback, 'all-time: fallback name, not jane.doe');
  PERFORM test.eq((SELECT username FROM public.leaderboard_all_time(10, 0) WHERE rank = 2), 'RiverRat', 'all-time: display name');
  PERFORM test.eq((SELECT username FROM public.leaderboard_24h(10, 0) WHERE rank = 1), fallback, '24h: fallback name');
  PERFORM test.eq((SELECT username FROM public.leaderboard_my_rank_all_time('00000000-0000-0000-0000-0000000006b1')), fallback, 'my rank: fallback name');
  PERFORM test.eq((SELECT username FROM public.leaderboard_my_rank_24h('00000000-0000-0000-0000-0000000006b1')), fallback, 'my rank 24h: fallback name');
  PERFORM test.eq(public.public_site_stats() -> 'top' -> 0 ->> 'username', fallback, 'homepage top 5: fallback name');
  PERFORM test.eq(position('jane' IN public.public_site_stats()::text), 0, 'homepage stats contain no email part');
  PERFORM test.eq(position('sharky' IN public.public_site_stats()::text), 0, 'homepage stats contain no username');
END $$;

-- Settings: set_my_display_name as the user
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000006b1', false) \gset
DO $$
BEGIN
  PERFORM test.eq(public.set_my_display_name('jane.doe') ->> 'error', 'email', 'own email local part is refused');
  PERFORM test.eq(public.set_my_display_name('riverrat') ->> 'error', 'taken', 'taken, ignoring case');
  PERFORM test.eq(public.set_my_display_name('xx') ->> 'error', 'length', 'length error code');
  PERFORM test.eq(public.set_my_display_name('StackedPokerFan') ->> 'error', 'reserved', 'reserved error code');
  PERFORM test.eq(public.set_my_display_name('fuckface') ->> 'error', 'profanity', 'profanity error code');
  PERFORM test.eq(public.set_my_display_name('  NutFlush  ') ->> 'display_name', 'NutFlush', 'trimmed and saved');
  PERFORM test.eq((SELECT username FROM public.leaderboard_all_time(10, 0) WHERE rank = 1), 'NutFlush', 'leaderboard shows the new name');
  PERFORM test.eq(public.set_my_display_name('') ->> 'ok', 'true', 'empty clears the name');
  PERFORM test.eq((SELECT username FROM public.leaderboard_all_time(10, 0) WHERE rank = 1) LIKE 'Player %', true, 'cleared → fallback again');
END $$;
RESET ROLE;

DO $$
BEGIN
  -- A direct UPDATE (not through the RPC) is held to the same rules.
  BEGIN
    UPDATE public.profiles SET display_name = 'admin' WHERE id = '00000000-0000-0000-0000-0000000006b3';
    RAISE EXCEPTION 'direct update of a reserved name should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Anonymous visitors cannot call it.
  PERFORM test.eq(has_function_privilege('anon', 'public.set_my_display_name(text)', 'EXECUTE'), false, 'anon cannot set names');
  PERFORM test.eq(has_function_privilege('anon', 'public.public_site_stats()', 'EXECUTE'), true, 'homepage stats stay public');
END $$;

\echo 'display_name: all tests passed'
