#!/usr/bin/env bash
# Runs the Flop Equity Trainer SQL tests against a throwaway Postgres in Docker:
#   stub of Supabase's auth/roles → XP ledger → trainer tables → flop migrations → tests.
# Never touches a real Supabase project.
#
#   bash supabase/tests/run_flop_trainer.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME="flop-sql-test-$$"

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

until docker exec "$NAME" pg_isready -U postgres -q; do sleep 1; done
sleep 1

psql_file() {
  docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X "$@"
}

psql_file < "$ROOT/supabase/tests/_local_supabase_stub.sql"
# Learn's progress table, only the columns the XP functions touch.
psql_file <<'SQL'
CREATE TABLE public.user_skill_progress (user_id uuid PRIMARY KEY, total_xp integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now());
SQL
# xp_events + increment_user_xp; the file's Learn backfill at the end needs
# tables this test does not create, so it may stop there.
psql_file < "$ROOT/supabase_xp_leaderboard_schema.sql" 2>/dev/null || true
psql_file -c "SELECT 'public.increment_user_xp(uuid,integer,text,text)'::regprocedure" >/dev/null

psql_file < "$ROOT/supabase_trainer_highscores.sql"
psql_file < "$ROOT/supabase_preflop_trainer_xp.sql"
psql_file < "$ROOT/supabase_flop_equity.sql"
psql_file < "$ROOT/supabase_flop_trainer.sql"
psql_file < "$ROOT/supabase_flop_trainer_phase3.sql"
psql_file < "$ROOT/supabase/tests/flop_trainer.test.sql"
echo "flop trainer SQL tests passed"
