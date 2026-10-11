-- ============================================================
-- Public site stats — for the homepage (social proof + live top 5)
-- Run this in the Supabase SQL Editor AFTER supabase_xp_leaderboard_schema.sql
-- and supabase_hand_history.sql. Idempotent: safe to re-run.
--
-- public_site_stats() returns ONLY aggregates plus the top 5 of the all-time
-- XP leaderboard (username + XP, as the logged-in /leaderboard already shows):
--   { "players": <registered accounts>,
--     "hands":   <hand histories imported>,
--     "top":     [{ "rank": 1, "username": "…", "total_xp": 1234 }, …] }
-- No user ids, emails or per-user data beyond those leaderboard rows.
-- Callable without signing in (the homepage is public); the homepage caches
-- the result for an hour.
-- ============================================================

CREATE OR REPLACE FUNCTION public.public_site_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'players', (SELECT count(*) FROM public.profiles),
    'hands',   (SELECT count(*) FROM public.hh_hands),
    'top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('rank', t.rank, 'username', COALESCE(t.username, 'Player'), 'total_xp', t.total_xp) ORDER BY t.rank, t.username)
        FROM (
          SELECT p.username,
                 usp.total_xp,
                 RANK() OVER (ORDER BY usp.total_xp DESC)::integer AS rank
            FROM public.user_skill_progress usp
            JOIN public.profiles p ON p.id = usp.user_id
           WHERE usp.total_xp > 0
           ORDER BY usp.total_xp DESC, p.username ASC NULLS LAST, usp.user_id ASC
           LIMIT 5
        ) t
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.public_site_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_site_stats() TO anon, authenticated;

-- Check:
-- SELECT public.public_site_stats();
