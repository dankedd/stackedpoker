-- Social layer adoption, one block per phase. Run in the Supabase SQL Editor.
-- "Active" = at least one xp_event in the last 30 days.

-- ── Phase 0: usernames, blocks, reports ────────────────────────────────────
WITH active AS (
  SELECT DISTINCT user_id FROM public.xp_events WHERE created_at > now() - interval '30 days'
)
SELECT
  (SELECT count(*) FROM active)                                                      AS active_users_30d,
  (SELECT count(*) FROM active a JOIN public.profiles p ON p.id = a.user_id
    WHERE p.handle IS NOT NULL)                                                      AS active_with_username,
  round(100.0 * (SELECT count(*) FROM active a JOIN public.profiles p ON p.id = a.user_id WHERE p.handle IS NOT NULL)
        / nullif((SELECT count(*) FROM active), 0), 1)                               AS pct_active_with_username,
  (SELECT count(*) FROM public.profiles WHERE handle IS NOT NULL)                    AS usernames_total,
  (SELECT count(*) FROM public.blocks)                                               AS blocks_total,
  (SELECT count(*) FROM public.reports WHERE status = 'open')                        AS reports_open,
  (SELECT count(*) FROM public.reports WHERE created_at > now() - interval '7 days') AS reports_7d;

-- ── Phase 1: sharing hands ─────────────────────────────────────────────────
WITH active AS (
  SELECT DISTINCT user_id FROM public.xp_events WHERE created_at > now() - interval '30 days'
)
SELECT
  round(100.0 * (SELECT count(DISTINCT s.owner_id) FROM public.hand_shares s JOIN active a ON a.user_id = s.owner_id)
        / nullif((SELECT count(*) FROM active), 0), 1)                                  AS pct_active_shared_1plus,
  (SELECT count(*) FROM public.hand_shares WHERE created_at > now() - interval '7 days') AS shares_7d,
  (SELECT count(*) FROM public.hand_shares WHERE guess_mode)                              AS guess_mode_shares,
  (SELECT coalesce(sum(view_count), 0) FROM public.hand_shares)                           AS views_total,
  (SELECT count(*) FROM public.hand_guesses WHERE created_at > now() - interval '7 days') AS votes_7d,
  (SELECT count(*) FROM public.hand_guesses WHERE user_id IS NULL)                        AS votes_signed_out,
  (SELECT count(*) FROM auth.users WHERE raw_user_meta_data -> 'signup_utm' ? 'referred_by_share') AS signups_from_shares;

-- ── Phase 2: profiles, skill stats, badges ─────────────────────────────────
SELECT
  (SELECT count(*) FROM public.profiles WHERE handle IS NOT NULL AND (bio IS NOT NULL OR avatar_path IS NOT NULL OR cardinality(sites) > 0)) AS profiles_filled_in,
  (SELECT count(*) FROM public.profiles WHERE avatar_path IS NOT NULL)                                AS with_photo,
  (SELECT count(*) FILTER (WHERE profile_visibility = 'public')  FROM public.profiles WHERE handle IS NOT NULL) AS profile_public,
  (SELECT count(*) FILTER (WHERE profile_visibility = 'friends') FROM public.profiles WHERE handle IS NOT NULL) AS profile_friends,
  (SELECT count(*) FILTER (WHERE profile_visibility = 'private') FROM public.profiles WHERE handle IS NOT NULL) AS profile_private,
  (SELECT count(*) FROM public.user_skill_stats WHERE refreshed_at > now() - interval '7 days')      AS stats_fresh_7d,
  (SELECT jsonb_object_agg(achievement_id, n) FROM (SELECT achievement_id, count(*) AS n FROM public.user_achievements GROUP BY 1) b) AS badges_awarded;
