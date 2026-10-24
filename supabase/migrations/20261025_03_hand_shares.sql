-- ============================================================
-- Social Phase 1: sharing hands (hand_shares, hand_guesses)
-- Run in the Supabase SQL Editor AFTER 20261024_02_social_foundation.sql
-- and supabase_hand_history.sql. Idempotent: safe to re-run.
--
-- A share is a frozen, anonymised snapshot of one of the owner's hands
-- (hand jsonb): every player is named by position ("CO", "BB"), Hero is
-- "Hero", and hand id, table, tournament and raw text are gone. The owner's
-- browser builds it (frontend/lib/social/share/anonymize.ts); the trigger
-- below refuses any snapshot whose names are not position labels and strips
-- identifying keys again, so no screen name can be published.
--
-- Everything public goes through get_shared_hand(), which applies the
-- share's options server-side: hero cards hidden, result hidden, and guess
-- mode — the hand is cut off before Hero's decision until the viewer has
-- voted, so neither the page nor the OG image can spoil the answer.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hand_shares (
  id               text         PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{7}$'),
  hand_id          uuid         NOT NULL REFERENCES public.hh_hands(id) ON DELETE CASCADE,
  owner_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility       text         NOT NULL DEFAULT 'link' CHECK (visibility IN ('link', 'friends', 'public')),
  show_hero_cards  boolean      NOT NULL DEFAULT true,
  show_result      boolean      NOT NULL DEFAULT true,
  guess_mode       boolean      NOT NULL DEFAULT false,
  question         text         CHECK (question IS NULL OR char_length(question) <= 140),
  hand             jsonb        NOT NULL,
  -- Guess mode: index into hand->'events' of Hero's decision, the choices
  -- the viewer gets, and what Hero actually did.
  decision_index   integer      CHECK (decision_index IS NULL OR decision_index >= 0),
  decision_options text[],
  actual_choice    text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  view_count       integer      NOT NULL DEFAULT 0,
  revoked_at       timestamptz,
  hidden_at        timestamptz,
  CHECK (NOT guess_mode OR (decision_index IS NOT NULL AND cardinality(decision_options) >= 2 AND actual_choice = ANY (decision_options)))
);
CREATE INDEX IF NOT EXISTS hand_shares_owner_idx ON public.hand_shares (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hand_shares_hand_idx ON public.hand_shares (hand_id);
CREATE INDEX IF NOT EXISTS hand_shares_public_idx ON public.hand_shares (created_at DESC)
  WHERE visibility = 'public' AND revoked_at IS NULL AND hidden_at IS NULL;

ALTER TABLE public.hand_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hand_shares_select_own ON public.hand_shares;
CREATE POLICY hand_shares_select_own ON public.hand_shares FOR SELECT USING (auth.uid() = owner_id);
-- Writes only through create_hand_share()/update_hand_share()/revoke_hand_share().

CREATE TABLE IF NOT EXISTS public.hand_guesses (
  id          bigserial    PRIMARY KEY,
  share_id    text         NOT NULL REFERENCES public.hand_shares(id) ON DELETE CASCADE,
  -- A deleted account's vote still counts, anonymously.
  user_id     uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Signed-out viewers: a random id the browser keeps (not a fingerprint).
  anon_id     text         CHECK (anon_id IS NULL OR anon_id ~ '^[0-9a-f-]{36}$'),
  choice      text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS hand_guesses_user_once ON public.hand_guesses (share_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hand_guesses_anon_once ON public.hand_guesses (share_id, anon_id) WHERE anon_id IS NOT NULL AND user_id IS NULL;
CREATE INDEX IF NOT EXISTS hand_guesses_user_idx ON public.hand_guesses (user_id);

ALTER TABLE public.hand_guesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hand_guesses_select_own ON public.hand_guesses;
CREATE POLICY hand_guesses_select_own ON public.hand_guesses FOR SELECT USING (auth.uid() = user_id);
-- Writes only through submit_hand_guess().

-- ── Snapshot guard ─────────────────────────────────────────────────────────

-- Every label a player may carry in a snapshot (lib/replay/positions.ts,
-- plus the 10-max seat and the dead-button fallback "S<seat>").
CREATE OR REPLACE FUNCTION public.share_name_allowed(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_name IN ('Hero', 'BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO')
      OR p_name ~ '^S[0-9]{1,2}$';
$$;

-- Raises social:share_invalid unless the snapshot is anonymous; returns it
-- with identifying keys removed.
CREATE OR REPLACE FUNCTION public.share_clean_snapshot(p_hand jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v jsonb := p_hand;
  v_names text[];
  n text;
BEGIN
  IF jsonb_typeof(v) <> 'object' OR jsonb_typeof(v -> 'players') <> 'array' OR jsonb_typeof(v -> 'events') <> 'array'
     OR octet_length(v::text) > 65536 THEN
    RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(p ->> 'name') INTO v_names FROM jsonb_array_elements(v -> 'players') p;
  IF v_names IS NULL OR (SELECT count(DISTINCT x) FROM unnest(v_names) x) <> cardinality(v_names) THEN
    RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation';
  END IF;
  FOREACH n IN ARRAY v_names LOOP
    IF NOT public.share_name_allowed(n) THEN RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(v -> 'players') p WHERE (p ->> 'isHero')::boolean AND p ->> 'name' = 'Hero') <> 1
     OR coalesce(v ->> 'heroName', '') <> 'Hero' THEN
    RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation';
  END IF;
  -- Every name used anywhere must be a seat in the snapshot.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v -> 'events') e WHERE e ? 'player' AND NOT (e ->> 'player' = ANY (v_names)))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(v -> 'winners', '[]')) w WHERE NOT (w ->> 'player' = ANY (v_names)))
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(v -> 'shown', '{}')) k WHERE NOT (k = ANY (v_names))) THEN
    RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation';
  END IF;

  v := v - 'handId' - 'tableName' - 'tournamentId' - 'tournamentName' - 'warnings';
  v := jsonb_set(v, '{playedAt}', to_jsonb(left(coalesce(v ->> 'playedAt', ''), 10)));
  IF v ? 'manual' AND jsonb_typeof(v -> 'manual') = 'object' THEN
    v := jsonb_set(v, '{manual}', (v -> 'manual') - 'entry' - 'venue' - 'buyIn');
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.hand_shares_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.hand IS DISTINCT FROM OLD.hand THEN
    NEW.hand := public.share_clean_snapshot(NEW.hand);
  END IF;
  IF NEW.guess_mode AND NEW.decision_index >= jsonb_array_length(NEW.hand -> 'events') THEN
    RAISE EXCEPTION 'social:share_invalid' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hand_shares_guard ON public.hand_shares;
CREATE TRIGGER hand_shares_guard BEFORE INSERT OR UPDATE ON public.hand_shares
  FOR EACH ROW EXECUTE FUNCTION public.hand_shares_guard();

-- ── Slugs ───────────────────────────────────────────────────────────────────
-- 7 base62 characters from gen_random_uuid()'s random bits (~41 bits).
CREATE OR REPLACE FUNCTION public.share_new_slug()
RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  b bytea;
  v text;
  i int;
BEGIN
  LOOP
    b := uuid_send(gen_random_uuid());
    v := '';
    -- Bytes 0-5 are fully random in a v4 uuid; 9-15 as well.
    FOR i IN 0..6 LOOP
      v := v || substr(alphabet, (get_byte(b, CASE WHEN i < 6 THEN i ELSE 9 END) % 62) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.hand_shares WHERE id = v);
  END LOOP;
  RETURN v;
END;
$$;

-- ── Owner RPCs ──────────────────────────────────────────────────────────────

-- {"ok": true, "slug": "…"} or {"ok": false, "error": not_found | invalid}.
-- Rate limits and text problems raise social:* errors.
CREATE OR REPLACE FUNCTION public.create_hand_share(
  p_hand_id uuid, p_snapshot jsonb, p_visibility text DEFAULT 'link',
  p_show_hero_cards boolean DEFAULT true, p_show_result boolean DEFAULT true,
  p_guess_mode boolean DEFAULT false, p_question text DEFAULT NULL,
  p_decision_index integer DEFAULT NULL, p_decision_options text[] DEFAULT NULL, p_actual_choice text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_slug text;
  v_q    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hh_hands WHERE id = p_hand_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF p_visibility NOT IN ('link', 'friends', 'public') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF nullif(btrim(p_question), '') IS NOT NULL THEN v_q := public.social_check_text(p_question, 140); END IF;

  PERFORM public.social_rate_hit(v_uid, 'share');
  v_slug := public.share_new_slug();
  INSERT INTO public.hand_shares (id, hand_id, owner_id, visibility, show_hero_cards, show_result, guess_mode, question,
                                  hand, decision_index, decision_options, actual_choice)
  VALUES (v_slug, p_hand_id, v_uid, p_visibility, coalesce(p_show_hero_cards, true), coalesce(p_show_result, true),
          coalesce(p_guess_mode, false), v_q, p_snapshot,
          CASE WHEN p_guess_mode THEN p_decision_index END,
          CASE WHEN p_guess_mode THEN p_decision_options END,
          CASE WHEN p_guess_mode THEN p_actual_choice END);
  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
END;
$$;

-- Options only; the snapshot and the guess spot are fixed once votes exist.
CREATE OR REPLACE FUNCTION public.update_hand_share(
  p_slug text, p_visibility text, p_show_hero_cards boolean, p_show_result boolean, p_question text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  IF p_visibility NOT IN ('link', 'friends', 'public') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid'); END IF;
  IF nullif(btrim(p_question), '') IS NOT NULL THEN v_q := public.social_check_text(p_question, 140); END IF;
  UPDATE public.hand_shares
     SET visibility = p_visibility, show_hero_cards = coalesce(p_show_hero_cards, show_hero_cards),
         show_result = coalesce(p_show_result, show_result), question = v_q
   WHERE id = p_slug AND owner_id = auth.uid() AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_hand_share(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'social:not_signed_in' USING ERRCODE = '42501'; END IF;
  UPDATE public.hand_shares SET revoked_at = now()
   WHERE id = p_slug AND owner_id = auth.uid() AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Public read ─────────────────────────────────────────────────────────────

-- The hand as the viewer may see it. Cut = only events before p_cut, and the
-- result fields dropped.
CREATE OR REPLACE FUNCTION public.share_view_hand(p_hand jsonb, p_show_cards boolean, p_show_result boolean, p_cut integer)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v jsonb := p_hand;
  v_drop text[] := ARRAY[]::text[];
BEGIN
  IF NOT p_show_result OR p_cut IS NOT NULL THEN v_drop := v_drop || ARRAY['show', 'collect']; END IF;
  IF NOT p_show_cards THEN
    v := jsonb_set(v, '{heroCards}', 'null');
    -- Hero's own showdown would reveal the cards too.
    v := jsonb_set(v, '{shown}', coalesce(v -> 'shown', '{}') - 'Hero');
  END IF;

  v := jsonb_set(v, '{events}', coalesce((
    SELECT jsonb_agg(e ORDER BY i)
      FROM jsonb_array_elements(v -> 'events') WITH ORDINALITY AS t(e, i)
     WHERE (p_cut IS NULL OR i <= p_cut)
       AND NOT (e ->> 'kind' = ANY (v_drop))
       AND NOT (NOT p_show_cards AND e ->> 'kind' = 'show' AND e ->> 'player' = 'Hero')
  ), '[]'));

  IF NOT p_show_result OR p_cut IS NOT NULL THEN
    v := v || jsonb_build_object('winners', '[]'::jsonb, 'shown', '{}'::jsonb, 'resultHidden', true);
  END IF;
  IF p_cut IS NOT NULL THEN
    -- The board as dealt so far; the pot total would reveal later action.
    v := v || jsonb_build_object(
      'board', jsonb_build_object(
        'flop',  coalesce((SELECT e -> 'cards' FROM jsonb_array_elements(v -> 'events') e WHERE e ->> 'kind' = 'deal' AND e ->> 'street' = 'flop' LIMIT 1), '[]'),
        'turn',  (SELECT e -> 'cards' -> 0 FROM jsonb_array_elements(v -> 'events') e WHERE e ->> 'kind' = 'deal' AND e ->> 'street' = 'turn' LIMIT 1),
        'river', (SELECT e -> 'cards' -> 0 FROM jsonb_array_elements(v -> 'events') e WHERE e ->> 'kind' = 'deal' AND e ->> 'street' = 'river' LIMIT 1)),
      'totalPot', 0, 'rake', 0, 'truncated', true);
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.share_viewer_guess(p_slug text, p_anon text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT choice FROM public.hand_guesses
   WHERE share_id = p_slug
     AND ((auth.uid() IS NOT NULL AND user_id = auth.uid())
          OR (p_anon IS NOT NULL AND anon_id = p_anon AND user_id IS NULL))
   ORDER BY user_id IS NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.share_distribution(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(choice, n), '{}') FROM (
    SELECT choice, count(*)::int AS n FROM public.hand_guesses WHERE share_id = p_slug GROUP BY choice
  ) x;
$$;

-- NULL when the share does not exist, is revoked/hidden, or the viewer may
-- not see it. p_anon: the signed-out viewer's browser id (guess mode).
CREATE OR REPLACE FUNCTION public.get_shared_hand(p_slug text, p_anon text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s       record;
  v_uid   uuid := auth.uid();
  v_owner boolean;
  v_mod   boolean;
  v_guess text;
  v_open  boolean;
BEGIN
  SELECT * INTO s FROM public.hand_shares WHERE id = p_slug;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_owner := v_uid IS NOT NULL AND v_uid = s.owner_id;
  v_mod := v_uid IS NOT NULL AND public.is_moderator(v_uid);

  IF NOT v_owner AND NOT v_mod THEN
    IF s.revoked_at IS NOT NULL OR s.hidden_at IS NOT NULL THEN RETURN NULL; END IF;
    IF public.is_banned(s.owner_id) AND (SELECT banned_until FROM public.profiles WHERE id = s.owner_id) = 'infinity' THEN RETURN NULL; END IF;
    -- 'link' behaves as public for who may see it; blocks always apply.
    IF NOT public.can_view(v_uid, s.owner_id, CASE s.visibility WHEN 'friends' THEN 'friends' ELSE 'public' END) THEN
      RETURN NULL;
    END IF;
  END IF;

  v_guess := CASE WHEN s.guess_mode THEN public.share_viewer_guess(p_slug, CASE WHEN p_anon ~ '^[0-9a-f-]{36}$' THEN p_anon END) END;
  -- The full hand: no guess mode, already voted, or the owner.
  v_open := NOT s.guess_mode OR v_guess IS NOT NULL OR v_owner;

  RETURN jsonb_build_object(
    'slug', s.id,
    'visibility', s.visibility,
    'question', s.question,
    'created_at', s.created_at,
    'owner', public.social_card(s.owner_id) - 'id',
    'is_owner', v_owner,
    'revoked', s.revoked_at IS NOT NULL,
    'hidden', s.hidden_at IS NOT NULL,
    'show_hero_cards', s.show_hero_cards,
    'show_result', s.show_result,
    'guess_mode', s.guess_mode,
    'decision_options', to_jsonb(s.decision_options),
    'decision_index', s.decision_index,
    'my_guess', v_guess,
    'actual_choice', CASE WHEN s.guess_mode AND v_open THEN s.actual_choice END,
    'distribution', CASE WHEN s.guess_mode AND v_open THEN public.share_distribution(s.id) END,
    'view_count', CASE WHEN v_owner THEN s.view_count END,
    'hand', public.share_view_hand(s.hand, s.show_hero_cards OR v_owner, s.show_result OR v_owner,
                                   CASE WHEN v_open THEN NULL ELSE s.decision_index END)
  );
END;
$$;

-- Counted from the page itself (not the OG crawler); the owner's views don't count.
CREATE OR REPLACE FUNCTION public.record_share_view(p_slug text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hand_shares SET view_count = view_count + 1
   WHERE id = p_slug AND revoked_at IS NULL AND owner_id IS DISTINCT FROM auth.uid();
$$;

-- Records the viewer's vote (the first one counts) and returns the full share.
CREATE OR REPLACE FUNCTION public.submit_hand_guess(p_slug text, p_choice text, p_anon text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s     record;
  v_uid uuid := auth.uid();
BEGIN
  IF public.get_shared_hand(p_slug, p_anon) IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.hand_shares WHERE id = p_slug;
  IF NOT s.guess_mode OR NOT (p_choice = ANY (s.decision_options)) THEN
    RAISE EXCEPTION 'social:invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF v_uid IS NULL AND (p_anon IS NULL OR p_anon !~ '^[0-9a-f-]{36}$') THEN
    RAISE EXCEPTION 'social:invalid' USING ERRCODE = 'check_violation';
  END IF;
  IF v_uid IS NOT NULL AND public.is_banned(v_uid) THEN
    RAISE EXCEPTION 'social:banned' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS DISTINCT FROM s.owner_id AND public.share_viewer_guess(p_slug, p_anon) IS NULL THEN
    INSERT INTO public.hand_guesses (share_id, user_id, anon_id, choice)
    VALUES (p_slug, v_uid, CASE WHEN v_uid IS NULL THEN p_anon END, p_choice)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN public.get_shared_hand(p_slug, p_anon);
END;
$$;

-- The caller's shares, optionally for one hand (share modal).
CREATE OR REPLACE FUNCTION public.my_hand_shares(p_hand_id uuid DEFAULT NULL)
RETURNS TABLE (slug text, hand_id uuid, visibility text, show_hero_cards boolean, show_result boolean, guess_mode boolean,
               question text, created_at timestamptz, view_count integer, guesses integer, revoked_at timestamptz, hidden_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.hand_id, s.visibility, s.show_hero_cards, s.show_result, s.guess_mode, s.question, s.created_at,
         s.view_count, (SELECT count(*)::int FROM public.hand_guesses g WHERE g.share_id = s.id), s.revoked_at, s.hidden_at
    FROM public.hand_shares s
   WHERE s.owner_id = auth.uid() AND (p_hand_id IS NULL OR s.hand_id = p_hand_id)
   ORDER BY s.created_at DESC
   LIMIT 100;
$$;

-- ── Moderation + export ────────────────────────────────────────────────────
INSERT INTO public.moderation_targets (target_type, table_name, id_column, owner_column, hidden_column, preview_columns) VALUES
  ('hand_share', 'hand_shares', 'id', 'owner_id', 'hidden_at', ARRAY['id', 'question', 'visibility'])
ON CONFLICT (target_type) DO UPDATE
  SET table_name = EXCLUDED.table_name, id_column = EXCLUDED.id_column, owner_column = EXCLUDED.owner_column,
      hidden_column = EXCLUDED.hidden_column, preview_columns = EXCLUDED.preview_columns;

CREATE OR REPLACE FUNCTION public.export_my_social_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'profile', public.my_social_profile(),
    'friendships', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'other', public.social_card(CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END),
        'direction', CASE WHEN f.requester_id = auth.uid() THEN 'sent' ELSE 'received' END,
        'status', f.status, 'created_at', f.created_at, 'responded_at', f.responded_at) ORDER BY f.created_at)
      FROM public.friendships f WHERE auth.uid() IN (f.requester_id, f.addressee_id)), '[]'),
    'blocks', coalesce((SELECT jsonb_agg(b ORDER BY (b ->> 'blocked_at')) FROM public.my_blocked_users() b), '[]'),
    'reports_made', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason,
        'details', r.details, 'status', r.status, 'created_at', r.created_at) ORDER BY r.created_at)
      FROM public.reports r WHERE r.reporter_id = auth.uid()), '[]'),
    'notifications', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'type', n.type, 'payload', n.payload, 'read_at', n.read_at, 'created_at', n.created_at) ORDER BY n.created_at)
      FROM public.notifications n WHERE n.user_id = auth.uid()), '[]'),
    'hand_shares', coalesce((SELECT jsonb_agg(to_jsonb(s) - 'owner_id' ORDER BY s.created_at)
      FROM public.hand_shares s WHERE s.owner_id = auth.uid()), '[]'),
    'hand_guesses', coalesce((SELECT jsonb_agg(jsonb_build_object('share_id', g.share_id, 'choice', g.choice, 'created_at', g.created_at) ORDER BY g.created_at)
      FROM public.hand_guesses g WHERE g.user_id = auth.uid()), '[]')
  )
  WHERE auth.uid() IS NOT NULL;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.share_name_allowed(text)                       FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_clean_snapshot(jsonb)                    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.hand_shares_guard()                            FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_new_slug()                               FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_view_hand(jsonb, boolean, boolean, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_viewer_guess(text, text)                 FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_distribution(text)                       FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_hand_share(uuid, jsonb, text, boolean, boolean, boolean, text, integer, text[], text) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_hand_share(text, text, boolean, boolean, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.revoke_hand_share(text)                        FROM public, anon;
REVOKE ALL ON FUNCTION public.my_hand_shares(uuid)                           FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_hand_share(uuid, jsonb, text, boolean, boolean, boolean, text, integer, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_hand_share(text, text, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_hand_share(text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_hand_shares(uuid)                        TO authenticated;

-- Public: signed-out viewers too.
REVOKE ALL ON FUNCTION public.get_shared_hand(text, text)                    FROM public;
REVOKE ALL ON FUNCTION public.record_share_view(text)                        FROM public;
REVOKE ALL ON FUNCTION public.submit_hand_guess(text, text, text)            FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_hand(text, text)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_share_view(text)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_hand_guess(text, text, text)         TO anon, authenticated;
