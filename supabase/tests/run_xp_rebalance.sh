#!/usr/bin/env bash
# Runs the XP rebalance SQL tests against a throwaway Postgres in Docker:
#   stub of Supabase → Learn/XP/trainer schema as in production → a "before"
#   fixture → supabase_xp_levels_data.sql + supabase_xp_rebalance.sql (twice)
#   → tests. Never touches a real Supabase project.
#
#   bash supabase/tests/run_xp_rebalance.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="xp-sql-test-$$"

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

until docker exec "$NAME" pg_isready -U postgres -q; do sleep 1; done
sleep 1

psql_file() {
  docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X "$@"
}

psql_file < "$ROOT/supabase/tests/_local_supabase_stub.sql"
psql_file < "$ROOT/supabase/tests/xp_rebalance.fixture.sql"
psql_file < "$ROOT/supabase_achievements_schema.sql"
psql_file < "$ROOT/supabase_xp_atomic_increment.sql"
psql_file < "$ROOT/supabase_xp_leaderboard_schema.sql"
psql_file < "$ROOT/supabase_trainer_highscores.sql"
psql_file < "$ROOT/supabase_preflop_trainer_xp.sql"
psql_file < "$ROOT/supabase_flop_equity.sql"
psql_file < "$ROOT/supabase_flop_trainer.sql"
psql_file < "$ROOT/supabase_flop_trainer_phase3.sql"
psql_file < "$ROOT/supabase_hand_history.sql"
psql_file < "$ROOT/supabase_subscriptions.sql"
psql_file < "$ROOT/supabase/tests/retention.fixture.sql"
psql_file < "$ROOT/supabase_retention.sql"
psql_file < "$ROOT/supabase/tests/xp_rebalance.before.sql"

psql_file < "$ROOT/supabase_xp_levels_data.sql"
psql_file < "$ROOT/supabase_xp_rebalance.sql"
# Re-running must be safe and must not touch the backups or the log.
psql_file < "$ROOT/supabase_xp_levels_data.sql"
psql_file < "$ROOT/supabase_xp_rebalance.sql"

psql_file -v levels="$(cat "$ROOT/shared/levels.json")" < "$ROOT/supabase/tests/xp_rebalance.test.sql"
echo "xp rebalance SQL tests passed"
