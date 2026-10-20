-- ============================================================
-- Manual hands — hands the user enters themselves (live tournaments,
-- remembered hands). Run this in the Supabase SQL Editor. Idempotent.
-- Depends on: supabase_hand_history*.sql, supabase_subscriptions.sql.
--
-- A manual hand is an ordinary hh_hands row (same replayer, same analysis)
-- with site = 'manual' and source = 'manual'. Differences from imports:
--   * free for everyone, no limit; never counts as a tournament upload;
--   * always visible, also on Free (the "latest tournament only" rule is
--     about uploads);
--   * can be edited (hh_update_manual_hand) and deleted; imports cannot be
--     edited.
-- ============================================================

-- ── Source ─────────────────────────────────────────────────────────────────

ALTER TABLE public.hh_hands
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'import';

ALTER TABLE public.hh_hands DROP CONSTRAINT IF EXISTS hh_hands_source_check;
ALTER TABLE public.hh_hands ADD CONSTRAINT hh_hands_source_check
  CHECK (source IN ('import', 'manual') AND (source = 'manual') = (site = 'manual'));

CREATE INDEX IF NOT EXISTS hh_hands_user_manual_idx
  ON public.hh_hands (user_id, played_at DESC, id DESC) WHERE source = 'manual';

-- ── Visibility: manual hands and manual tournaments are always shown ───────
-- (Replaces the policies from supabase_subscriptions.sql; same rules plus the
-- manual exception. The "latest tournament" ignores manual tournaments so a
-- manual entry never hides the user's latest upload.)

CREATE OR REPLACE FUNCTION public.hh_latest_tournament()
RETURNS public.hh_tournaments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.* FROM public.hh_tournaments t
   WHERE t.user_id = auth.uid() AND t.site <> 'manual'
   ORDER BY t.created_at DESC, t.last_hand_at DESC NULLS LAST, t.id DESC
   LIMIT 1;
$$;

DROP POLICY IF EXISTS "hh_tournaments_select_own" ON public.hh_tournaments;
CREATE POLICY "hh_tournaments_select_own" ON public.hh_tournaments
  FOR SELECT USING (
    auth.uid() = user_id
    AND (
      site = 'manual'
      OR (SELECT public.hh_full_history())
      OR (SELECT (public.hh_latest_tournament()).id) IS NULL
      OR id = (SELECT (public.hh_latest_tournament()).id)
      OR created_at > (SELECT (public.hh_latest_tournament()).created_at)
    )
  );

DROP POLICY IF EXISTS "hh_hands_select_own" ON public.hh_hands;
CREATE POLICY "hh_hands_select_own" ON public.hh_hands
  FOR SELECT USING (
    auth.uid() = user_id
    AND (
      source = 'manual'
      OR (SELECT public.hh_full_history())
      OR (site = (SELECT (public.hh_latest_tournament()).site)
          AND tournament_id = (SELECT (public.hh_latest_tournament()).tournament_id))
    )
  );

-- ── Upload limit: a manual tournament is not an upload ─────────────────────

CREATE OR REPLACE FUNCTION public.hh_tournaments_upload_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit  integer;
  v_used   integer;
  v_oldest timestamptz;
BEGIN
  IF NEW.site = 'manual' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('tournament_upload:' || NEW.user_id::text));

  IF EXISTS (
    SELECT 1 FROM public.hh_tournaments t
     WHERE t.user_id = NEW.user_id AND t.site = NEW.site AND t.tournament_id = NEW.tournament_id
  ) THEN
    RETURN NEW;
  END IF;

  v_limit := public.usage_limit(public.effective_plan(NEW.user_id), 'tournament_upload');
  IF v_limit IS NOT NULL THEN
    SELECT count(*), min(e.created_at) INTO v_used, v_oldest
      FROM public.usage_events e
     WHERE e.user_id = NEW.user_id AND e.metric = 'tournament_upload'
       AND e.created_at > now() - interval '7 days';
    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'UPLOAD_LIMIT_REACHED'
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object('limit', v_limit, 'used', v_used,
                                          'next_available_at', v_oldest + interval '7 days')::text,
              HINT    = 'Free includes 1 tournament per week.';
    END IF;
  END IF;

  INSERT INTO public.usage_events (user_id, metric, ref)
  VALUES (NEW.user_id, 'tournament_upload', NEW.site || ':' || NEW.tournament_id);
  RETURN NEW;
END;
$$;

-- "N older tournaments hidden" counts uploads only.
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid, p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          text := public.effective_plan(p_user_id, p_now);
  v_sub           public.subscriptions;
  v_day           date := public.amsterdam_day(p_now);
  v_hands         integer;
  v_ai            integer;
  v_uploads       integer;
  v_oldest_upload timestamptz;
  v_upload_limit  integer := public.usage_limit(v_plan, 'tournament_upload');
  v_hidden        integer := 0;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;

  SELECT COALESCE(sum(count) FILTER (WHERE metric = 'trainer_hand'), 0),
         COALESCE(sum(count) FILTER (WHERE metric = 'ai_question'), 0)
    INTO v_hands, v_ai
    FROM public.usage_daily
   WHERE user_id = p_user_id AND usage_date = v_day;

  SELECT count(*), min(created_at) INTO v_uploads, v_oldest_upload
    FROM public.usage_events
   WHERE user_id = p_user_id AND metric = 'tournament_upload'
     AND created_at > p_now - interval '7 days';

  IF v_plan = 'free' THEN
    SELECT GREATEST(count(*) - 1, 0) INTO v_hidden
      FROM public.hh_tournaments WHERE user_id = p_user_id AND site <> 'manual';
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_ended', v_plan = 'free' AND v_sub.trial_ends_at IS NOT NULL AND v_sub.trial_ends_at <= p_now,
    'trial_ended_seen', v_sub.trial_ended_seen_at IS NOT NULL,
    'subscription', jsonb_build_object(
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'cancel_at_period_end', COALESCE(v_sub.cancel_at_period_end, false),
      'has_customer', v_sub.stripe_customer_id IS NOT NULL
    ),
    'limits', jsonb_build_object(
      'trainer_hands_per_day', public.usage_limit(v_plan, 'trainer_hand'),
      'tournaments_per_week',  v_upload_limit,
      'ai_questions_per_day',  CASE WHEN v_plan = 'free' THEN public.usage_limit(v_plan, 'ai_question') END
    ),
    'usage', jsonb_build_object(
      'trainer_hands_today',   v_hands,
      'ai_questions_today',    v_ai,
      'tournaments_this_week', v_uploads
    ),
    'daily_reset_at', public.next_amsterdam_midnight(p_now),
    'next_upload_at', CASE WHEN v_upload_limit IS NOT NULL AND v_uploads >= v_upload_limit
                           THEN v_oldest_upload + interval '7 days' END,
    'hidden_tournaments', v_hidden
  );
END;
$$;

-- ── Editing a manual hand ──────────────────────────────────────────────────
--
-- Replaces the hand's content (not its id, star or notes) with a newly built
-- row. Only the caller's own manual hands; imports stay immutable. Keeps the
-- tournament hand counts right when the hand moves to another tournament.
CREATE OR REPLACE FUNCTION public.hh_update_manual_hand(p_id uuid, p_row jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.hh_hands;
  v_new public.hh_hands := jsonb_populate_record(NULL::public.hh_hands, p_row);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF pg_column_size(p_row) > 262144 THEN
    RAISE EXCEPTION 'hand too large' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.hh_hands
   WHERE id = p_id AND user_id = auth.uid() AND source = 'manual'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'manual hand not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_new.tournament_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.hh_tournaments t
     WHERE t.user_id = auth.uid() AND t.site = 'manual' AND t.tournament_id = v_new.tournament_id
  ) THEN
    RAISE EXCEPTION 'unknown manual tournament' USING ERRCODE = '23503';
  END IF;

  UPDATE public.hh_hands SET
    hand_id          = v_new.hand_id,
    tournament_id    = v_new.tournament_id,
    played_at        = v_new.played_at,
    level            = v_new.level,
    small_blind      = v_new.small_blind,
    big_blind        = v_new.big_blind,
    ante             = v_new.ante,
    table_name       = v_new.table_name,
    max_seats        = v_new.max_seats,
    button_seat      = v_new.button_seat,
    player_count     = v_new.player_count,
    hero_position    = v_new.hero_position,
    hero_cards       = v_new.hero_cards,
    board            = v_new.board,
    last_street      = v_new.last_street,
    pot_chips        = v_new.pot_chips,
    pot_bb           = v_new.pot_bb,
    hero_net_chips   = v_new.hero_net_chips,
    hero_net_bb      = v_new.hero_net_bb,
    hero_won         = v_new.hero_won,
    went_to_showdown = v_new.went_to_showdown,
    hero_all_in      = v_new.hero_all_in,
    hero_involved    = v_new.hero_involved,
    hero_invested_bb = v_new.hero_invested_bb,
    preflop_check    = v_new.preflop_check,
    preflop_position = v_new.preflop_position,
    preflop_detail   = v_new.preflop_detail,
    preflop_version  = v_new.preflop_version,
    data             = v_new.data,
    raw_text         = v_new.raw_text,
    parser           = v_new.parser,
    parser_version   = v_new.parser_version,
    -- The stored analysis belongs to the old content; the replayer rebuilds it.
    analysis         = NULL,
    analysis_version = NULL
  WHERE id = p_id;

  IF v_old.tournament_id IS DISTINCT FROM v_new.tournament_id THEN
    UPDATE public.hh_tournaments SET hand_count = GREATEST(hand_count - 1, 0)
     WHERE user_id = v_old.user_id AND site = 'manual' AND tournament_id = v_old.tournament_id;
  END IF;
  IF v_new.tournament_id IS NOT NULL THEN
    UPDATE public.hh_tournaments t SET
      hand_count    = CASE WHEN v_old.tournament_id IS DISTINCT FROM v_new.tournament_id THEN t.hand_count + 1 ELSE t.hand_count END,
      first_hand_at = LEAST(COALESCE(t.first_hand_at, v_new.played_at), v_new.played_at),
      last_hand_at  = GREATEST(COALESCE(t.last_hand_at, v_new.played_at), v_new.played_at)
     WHERE t.user_id = v_old.user_id AND t.site = 'manual' AND t.tournament_id = v_new.tournament_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hh_update_manual_hand(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hh_update_manual_hand(uuid, jsonb) TO authenticated;

-- ── Usage tracking (manual entry vs uploads) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.hh_manual_events (
  id               bigserial    PRIMARY KEY,
  user_id          uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind             text         NOT NULL CHECK (kind IN ('started', 'saved', 'edited')),
  game_type        text         CHECK (game_type IN ('tournament', 'cash')),
  streets_entered  smallint     CHECK (streets_entered BETWEEN 0 AND 4),
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hh_manual_events_user_idx ON public.hh_manual_events (user_id, created_at DESC);

ALTER TABLE public.hh_manual_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hh_manual_events_select_own" ON public.hh_manual_events;
CREATE POLICY "hh_manual_events_select_own" ON public.hh_manual_events
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "hh_manual_events_insert_own" ON public.hh_manual_events;
CREATE POLICY "hh_manual_events_insert_own" ON public.hh_manual_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
