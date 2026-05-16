-- ── Player Profile rollback ────────────────────────────────────────────────
-- Run in Supabase SQL editor to undo the profile schema additions.

DROP TABLE IF EXISTS puzzle_completions;
DROP TABLE IF EXISTS profile_cache;

ALTER TABLE hand_analyses DROP COLUMN IF EXISTS analysis_type;

DROP FUNCTION IF EXISTS get_puzzle_stats(uuid);
