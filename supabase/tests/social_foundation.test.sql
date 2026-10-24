-- Tests for supabase/migrations/20261024_01_profile_privileged_columns.sql and
-- 20261024_02_social_foundation.sql (run by supabase/tests/run.sh).
\set ON_ERROR_STOP on
\set QUIET on

-- Runs p_sql and checks it fails with a message matching p_pattern.
CREATE OR REPLACE FUNCTION test.raises(p_sql text, p_pattern text, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_msg text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ p_pattern THEN
      RAISE EXCEPTION 'FAIL %: expected error ~ %, got %', p_label, p_pattern, v_msg;
    END IF;
    RAISE NOTICE 'ok   %', p_label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL %: expected an error ~ %', p_label, p_pattern;
END $$;
GRANT EXECUTE ON FUNCTION test.raises(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION test.as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
$$;
GRANT EXECUTE ON FUNCTION test.as_user(uuid) TO anon, authenticated;

-- The real profiles has full_name and created_at; the stub does not.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
-- Production's own-row update policy (supabase_schema.sql): the guard is what stops privileged columns.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- s1 alice, s2 bob, s3 carol (no handle yet), s4 mia (moderator), s5 pro user.
-- '…00d' is the admin-tier account from run.sh → role admin by the migration.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000c51', 'alice@test', '{}'),
  ('00000000-0000-0000-0000-000000000c52', 'bob.smith@test', '{}'),
  ('00000000-0000-0000-0000-000000000c53', 'carol@test', '{"full_name": "Carol Ann"}'),
  ('00000000-0000-0000-0000-000000000c54', 'mia@test', '{}'),
  ('00000000-0000-0000-0000-000000000c55', 'pro@test', '{}');
INSERT INTO public.profiles (id, username, subscription_tier) VALUES
  ('00000000-0000-0000-0000-000000000c51', 'alice', 'free'),
  ('00000000-0000-0000-0000-000000000c52', 'bob.smith', 'free'),
  ('00000000-0000-0000-0000-000000000c53', 'carol', 'free'),
  ('00000000-0000-0000-0000-000000000c54', 'mia', 'free'),
  ('00000000-0000-0000-0000-000000000c55', 'pro', 'free');
-- New profiles get a reverse trial; these fixtures are plain free accounts…
UPDATE public.subscriptions SET trial_ends_at = NULL WHERE user_id::text LIKE '00000000-0000-0000-0000-000000000c5%';
-- …except the paying one.
UPDATE public.subscriptions SET status = 'active' WHERE user_id = '00000000-0000-0000-0000-000000000c55';
-- Set up as the owner (bypasses the client guard).
UPDATE public.profiles SET handle = 'alice_ace', profile_visibility = 'public' WHERE id = '00000000-0000-0000-0000-000000000c51';
UPDATE public.profiles SET handle = 'bobby',     profile_visibility = 'friends', bio = 'river rat' WHERE id = '00000000-0000-0000-0000-000000000c52';
UPDATE public.profiles SET handle = 'mia_mod',   role = 'moderator' WHERE id = '00000000-0000-0000-0000-000000000c54';
UPDATE public.profiles SET handle = 'pro_player' WHERE id = '00000000-0000-0000-0000-000000000c55';
UPDATE public.profiles SET full_name = 'Carol Ann' WHERE id = '00000000-0000-0000-0000-000000000c53';

\echo '── privileged profile columns'
DO $$ BEGIN
  PERFORM test.eq((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000000d'), 'admin', 'admin tier became social admin');
  PERFORM test.eq((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000000a'), 'user', 'everyone else is a user');
END $$;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c51');
SELECT test.raises($$UPDATE public.profiles SET subscription_tier = 'admin' WHERE id = auth.uid()$$, 'subscription_tier may not be changed', 'client cannot raise its own tier');
SELECT test.raises($$UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()$$, 'role may not be changed', 'client cannot make itself admin');
SELECT test.raises($$UPDATE public.profiles SET banned_until = NULL, handle = 'x_y_z' WHERE id = auth.uid()$$, 'handle may not be changed', 'handle only via set_my_handle');
DO $$ BEGIN
  UPDATE public.profiles SET bio = 'grinding', profile_visibility = 'public' WHERE id = auth.uid();
  PERFORM test.eq((SELECT bio FROM public.profiles WHERE id = auth.uid()), 'grinding', 'ordinary columns stay editable');
END $$;
RESET ROLE;

\echo '── handle'
DO $$ BEGIN
  PERFORM test.eq(public.handle_problem('good_name1'), NULL::text, 'valid handle');
  PERFORM test.eq(public.handle_problem('ab'), 'length', 'too short');
  PERFORM test.eq(public.handle_problem(repeat('a', 21)), 'length', 'too long');
  PERFORM test.eq(public.handle_problem('has.dot'), 'characters', 'dots not allowed');
  PERFORM test.eq(public.handle_problem('Upper'), 'characters', 'lowercase only');
  PERFORM test.eq(public.handle_problem('_lead'), 'characters', 'starts with a letter or digit');
  PERFORM test.eq(public.handle_problem('the_admin'), 'reserved', 'reserved word');
  PERFORM test.eq(public.handle_problem('sh1t_hand'), 'profanity', 'profanity');
END $$;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c52');
DO $$ BEGIN
  PERFORM test.eq(public.set_my_handle('bob_smith') ->> 'error', 'email', 'handle may not reveal the email (bob.smith)');
  PERFORM test.eq(public.set_my_handle('bobsmith') ->> 'error', 'email', 'handle may not reveal the email (bobsmith)');
  PERFORM test.eq(public.set_my_handle('alice_ace') ->> 'error', 'taken', 'taken handle');
  PERFORM test.eq(public.set_my_handle('Bad Name') ->> 'error', 'characters', 'spaces refused');
  PERFORM test.eq(public.set_my_handle('@Bobby') ->> 'ok', 'true', 'same handle (with @, any case) is a no-op');
END $$;
RESET ROLE;
UPDATE public.profiles SET handle_changed_at = now() - interval '31 days' WHERE id = '00000000-0000-0000-0000-000000000c52';
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c52');
DO $$ BEGIN
  PERFORM test.eq(public.set_my_handle('river_bob') ->> 'handle', 'river_bob', 'change after 30 days');
  PERFORM test.eq(public.set_my_handle('river_bob2') ->> 'error', 'too_soon', 'second change within 30 days refused');
  PERFORM test.eq((public.my_social_profile() ->> 'next_handle_change_at') IS NOT NULL, true, 'profile tells when the next change is allowed');
END $$;

SELECT test.as_user('00000000-0000-0000-0000-000000000c53');
DO $$
DECLARE v text;
BEGIN
  v := public.suggest_my_handle();
  PERFORM test.eq(v ~ '^carol_ann', true, 'suggestion from the full name');
  PERFORM test.eq(v ~ '^[a-z0-9_]{3,20}$', true, 'suggestion is valid');
  PERFORM test.eq(public.set_my_handle(v) ->> 'ok', 'true', 'first pick');
  PERFORM test.eq(public.set_my_handle('carol_two') ->> 'error', 'too_soon', 'first pick also starts the 30 days');
END $$;
RESET ROLE;

\echo '── text filter'
DO $$ BEGIN
  PERFORM test.eq(public.social_text_problem('Nice hand, I would call', 2000), NULL::text, 'clean text');
  PERFORM test.eq(public.social_text_problem('   ', 2000), 'empty', 'blank');
  PERFORM test.eq(public.social_text_problem(repeat('x', 11), 10), 'length', 'over max');
  PERFORM test.eq(public.social_text_problem('see http://a.x http://b.x www.c.x https://d.x', 2000), 'links', 'too many links');
  PERFORM test.eq(public.social_text_problem('nooooooooooooooo', 2000), 'repeat', 'char flood');
  PERFORM test.eq(public.social_text_problem('what a r3tard play', 2000), 'hate', 'hate word (leetspeak)');
  PERFORM test.eq(public.social_text_problem('classic spot, fold the ace', 2000), NULL::text, 'no Scunthorpe');
  PERFORM test.eq(public.social_clean_text('This is Sh1t, total bullshit'), 'This is ****, total ********', 'mild swearing masked');
  PERFORM test.eq(public.social_clean_text('pass the class'), 'pass the class', 'ass only as a whole word');
  PERFORM test.eq(public.social_check_text('  well played  ', 100), 'well played', 'check trims');
  PERFORM test.raises($q$SELECT public.social_check_text('nazi', 100)$q$, 'social:text_hate', 'check raises');
END $$;

\echo '── rate limits'
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..10 LOOP PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c51', 'message'); END LOOP;
  PERFORM test.raises($q$SELECT public.social_rate_hit('00000000-0000-0000-0000-000000000c51', 'message')$q$,
                      'social:rate_limited:message', '11th message in a minute refused');
  PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c51', 'message', now() + interval '61 seconds');
  PERFORM test.eq(true, true, 'window rolls over');

  FOR i IN 1..20 LOOP PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c51', 'share'); END LOOP;
  PERFORM test.raises($q$SELECT public.social_rate_hit('00000000-0000-0000-0000-000000000c51', 'share')$q$,
                      'social:rate_limited:share', 'free: 21st share of the day refused');
  FOR i IN 1..25 LOOP PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c55', 'share'); END LOOP;
  PERFORM test.eq(true, true, 'pro: shares unlimited');

  FOR i IN 1..3 LOOP PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c55', 'thread'); END LOOP;
  PERFORM test.raises($q$SELECT public.social_rate_hit('00000000-0000-0000-0000-000000000c55', 'thread')$q$,
                      'rate_limited:thread', 'new accounts: 3 threads in the first day');
  PERFORM public.social_rate_hit('00000000-0000-0000-0000-000000000c55', 'thread', now() + interval '2 days');
  PERFORM test.eq(true, true, 'after a day the account is no longer new');
END $$;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c51');
DO $$ BEGIN
  PERFORM test.eq((public.my_social_limits() -> 'share' ->> 'used')::int, 20, 'my_social_limits shows usage');
  PERFORM test.eq((public.my_social_limits() -> 'share' ->> 'max')::int, 20, 'my_social_limits shows the free limit');
  PERFORM test.eq((SELECT count(*) FROM public.social_rate_events)::int, 0, 'rate events are not readable');
  PERFORM test.raises($q$SELECT public.social_rate_hit(auth.uid(), 'message')$q$, 'permission denied', 'clients cannot call social_rate_hit');
END $$;
RESET ROLE;

\echo '── visibility, friendships, blocks'
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES
  ('00000000-0000-0000-0000-000000000c52', '00000000-0000-0000-0000-000000000c53', 'accepted'),
  ('00000000-0000-0000-0000-000000000c51', '00000000-0000-0000-0000-000000000c52', 'pending');
DO $$ BEGIN
  -- alice: public; bob: friends-only (friend: carol); pro_player: default friends.
  PERFORM test.eq(public.can_view_profile(NULL, '00000000-0000-0000-0000-000000000c51'), true, 'public profile: signed out sees it');
  PERFORM test.eq(public.can_view_profile(NULL, '00000000-0000-0000-0000-000000000c52'), false, 'friends profile: signed out does not');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c51', '00000000-0000-0000-0000-000000000c52'), false, 'pending request is not a friendship');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c53', '00000000-0000-0000-0000-000000000c52'), true, 'friend sees friends profile');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c52', '00000000-0000-0000-0000-000000000c52'), true, 'owner sees own');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c54', '00000000-0000-0000-0000-000000000c52'), true, 'moderator sees everything');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c51', '00000000-0000-0000-0000-00000000000a'), false, 'no handle = no profile');
  PERFORM test.eq(public.can_view('00000000-0000-0000-0000-000000000c53', '00000000-0000-0000-0000-000000000c52', 'private'), false, 'private: not even friends');
END $$;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c51');
DO $$ BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.friendships)::int, 1, 'alice sees only her own friendship rows');
  PERFORM test.eq((SELECT count(*) FROM public.profiles)::int, 1, 'profiles: own row only');
  PERFORM test.raises($q$INSERT INTO public.blocks VALUES (auth.uid(), '00000000-0000-0000-0000-000000000c52')$q$, 'row-level security', 'no direct block inserts');
END $$;

SELECT test.as_user('00000000-0000-0000-0000-000000000c53');
DO $$ BEGIN
  PERFORM test.eq(public.block_user('00000000-0000-0000-0000-000000000c52') ->> 'ok', 'true', 'carol blocks bob');
  PERFORM test.eq(public.block_user(auth.uid()) ->> 'error', 'invalid', 'cannot block yourself');
  PERFORM test.eq((SELECT count(*) FROM public.my_blocked_users())::int, 1, 'carol sees her block');
  PERFORM test.eq((SELECT count(*) FROM public.friendships)::int, 0, 'blocking ended the friendship');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000c52');
DO $$ BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.blocks)::int, 0, 'bob cannot see that he is blocked');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c52', '00000000-0000-0000-0000-000000000c53'), false, 'blocked user sees nothing of the blocker');
  UPDATE public.profiles SET profile_visibility = 'public' WHERE id = '00000000-0000-0000-0000-000000000c53';
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c52', '00000000-0000-0000-0000-000000000c53'), false, 'not even a public profile');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c53', '00000000-0000-0000-0000-000000000c52'), false, 'and the blocker does not see them either');
  PERFORM test.eq(public.social_notify('00000000-0000-0000-0000-000000000c53', 'friend_request',
                  jsonb_build_object('actor_id', '00000000-0000-0000-0000-000000000c52')), NULL::uuid, 'no notifications across a block');
END $$;

\echo '── reports + moderation'
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c51');
DO $$ BEGIN
  PERFORM test.eq(public.report_content('profile', '00000000-0000-0000-0000-000000000c52', 'spam', 'bio is an ad') ->> 'ok', 'true', 'report a profile');
  PERFORM test.eq(public.report_content('profile', '00000000-0000-0000-0000-000000000c52', 'spam') ->> 'error', 'duplicate', 'one open report per target');
  PERFORM test.eq(public.report_content('profile', auth.uid()::text, 'spam') ->> 'error', 'invalid', 'cannot report yourself');
  PERFORM test.eq(public.report_content('profile', '00000000-0000-0000-0000-000000000c99', 'spam') ->> 'error', 'not_found', 'unknown target');
  PERFORM test.eq(public.report_content('profile', 'not-a-uuid', 'spam') ->> 'error', 'not_found', 'malformed target id');
  PERFORM test.eq(public.report_content('profile', '00000000-0000-0000-0000-000000000c52', 'because') ->> 'error', 'invalid', 'unknown reason');
  PERFORM test.eq(public.am_i_moderator(), false, 'alice is no moderator');
  PERFORM test.raises($q$SELECT * FROM public.mod_list_reports()$q$, 'social:forbidden', 'users cannot list reports');
  PERFORM test.raises($q$SELECT public.mod_ban_user('00000000-0000-0000-0000-000000000c52')$q$, 'social:forbidden', 'users cannot ban');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000c52');
DO $$ BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.reports)::int, 0, 'the reported user cannot see the report');
END $$;

SELECT test.as_user('00000000-0000-0000-0000-000000000c54');
DO $$
DECLARE r record;
BEGIN
  PERFORM test.eq(public.am_i_moderator(), true, 'mia is a moderator');
  SELECT * INTO r FROM public.mod_list_reports() LIMIT 1;
  PERFORM test.eq(r.target ->> 'bio', 'river rat', 'moderator sees the reported content');
  PERFORM test.eq(r.owner ->> 'handle', 'river_bob', 'and its owner');
  PERFORM test.eq(r.reporter ->> 'handle', 'alice_ace', 'and the reporter');
  PERFORM test.eq(r.open_reports, 1, 'open report count');
  PERFORM test.eq((r.owner ? 'email'), false, 'no email in the card');

  PERFORM test.eq(public.mod_set_hidden('profile', '00000000-0000-0000-0000-000000000c52', true, 'ad') ->> 'ok', 'true', 'hide the bio');
  PERFORM test.eq((SELECT count(*) FROM public.mod_list_reports('open'))::int, 0, 'hiding actioned the report');
  PERFORM test.eq(public.mod_set_hidden('user', '00000000-0000-0000-0000-000000000c52', true) ->> 'error', 'invalid', 'users are banned, not hidden');

  PERFORM test.eq(public.mod_ban_user('00000000-0000-0000-0000-00000000000d') ->> 'error', 'forbidden', 'moderators cannot ban admins');
  PERFORM test.eq(public.mod_ban_user(auth.uid()) ->> 'error', 'invalid', 'nor themselves');
  PERFORM test.eq(public.mod_ban_user('00000000-0000-0000-0000-000000000c52', now() + interval '1 day', 'spam') ->> 'ok', 'true', 'temporary ban');
  PERFORM test.raises($q$SELECT public.mod_set_role('00000000-0000-0000-0000-000000000c51', 'moderator')$q$, 'social:forbidden', 'only admins set roles');
  PERFORM test.eq((SELECT count(*) FROM public.mod_find_users('@river_b'))::int, 1, 'find users by handle');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM test.eq((SELECT bio_hidden_at IS NOT NULL FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000c52'), true, 'bio_hidden_at set');
  PERFORM test.raises($q$SELECT public.social_rate_hit('00000000-0000-0000-0000-000000000c52', 'message')$q$, 'social:banned', 'banned users cannot post');
  PERFORM test.eq((SELECT count(*) FROM public.moderation_actions)::int, 2, 'actions are logged');
  PERFORM test.eq(public.can_view_profile('00000000-0000-0000-0000-000000000c51', '00000000-0000-0000-0000-000000000c52'), false, 'temp-banned friends-only profile still follows visibility');
END $$;

\echo '── notifications + export'
SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-000000000c52');
DO $$ BEGIN
  PERFORM test.eq((SELECT type FROM public.notifications LIMIT 1), 'moderation', 'the banned user is told');
  UPDATE public.notifications SET payload = '{"x": 1}';
  PERFORM test.eq((SELECT payload ? 'x' FROM public.notifications LIMIT 1), false, 'no direct updates');
  PERFORM test.eq(public.mark_notifications_read(), 1, 'mark all read');
  PERFORM test.eq((SELECT count(*) FROM public.notifications WHERE read_at IS NULL)::int, 0, 'nothing unread');
  PERFORM test.eq(jsonb_typeof(public.export_my_social_data() -> 'notifications'), 'array', 'export has notifications');
  PERFORM test.eq(public.export_my_social_data() -> 'profile' ->> 'handle', 'river_bob', 'export has the profile');
END $$;
SELECT test.as_user('00000000-0000-0000-0000-000000000c51');
DO $$ BEGIN
  PERFORM test.eq((SELECT count(*) FROM public.notifications)::int, 0, 'others cannot read them');
  PERFORM test.eq(jsonb_array_length(public.export_my_social_data() -> 'reports_made'), 1, 'export has my reports');
END $$;
RESET ROLE;

SET ROLE anon;
SELECT test.as_user(NULL);
DO $$ BEGIN
  PERFORM test.raises($q$SELECT public.set_my_handle('anon_x')$q$, 'permission denied', 'anon cannot call user RPCs');
  PERFORM test.eq((SELECT count(*) FROM public.reports)::int, 0, 'anon reads no reports');
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT test.as_user('00000000-0000-0000-0000-00000000000d');
DO $$ BEGIN
  PERFORM test.eq(public.mod_unban_user('00000000-0000-0000-0000-000000000c52') ->> 'ok', 'true', 'admin unbans');
  PERFORM test.eq(public.mod_set_role('00000000-0000-0000-0000-000000000c51', 'moderator') ->> 'ok', 'true', 'admin appoints a moderator');
END $$;
RESET ROLE;

\echo '── account deletion'
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000c51';
DO $$ BEGIN
  PERFORM test.eq((SELECT reporter_id FROM public.reports LIMIT 1), NULL::uuid, 'report kept, reporter anonymised');
  PERFORM test.eq(public.social_card(NULL) ->> 'name', '[deleted user]', 'deleted users render as [deleted user]');
  PERFORM test.eq((SELECT count(*) FROM public.friendships WHERE '00000000-0000-0000-0000-000000000c51' IN (requester_id, addressee_id))::int, 0, 'friendships removed');
END $$;
\echo 'social foundation: all tests passed'
