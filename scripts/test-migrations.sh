#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with a minimal
# Supabase stub) and runs the SQL assertions in supabase/tests/.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:55432/postgres scripts/test-migrations.sh
#
# It creates and drops its own database, and refuses any host but localhost —
# this must never point at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:?set TEST_DATABASE_URL to a local Postgres}"
case "$TEST_DATABASE_URL" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|*host=/*|*%2F*) ;;
  *) echo "refusing: TEST_DATABASE_URL must point at localhost" >&2; exit 1 ;;
esac

db="trailhead_migration_test_$$"
psql "$TEST_DATABASE_URL" -qc "create database $db"
trap 'psql "$TEST_DATABASE_URL" -qc "drop database if exists $db with (force)"' EXIT
url="${TEST_DATABASE_URL%/*}/$db"
case "$TEST_DATABASE_URL" in *\?*) url="${TEST_DATABASE_URL%%/postgres\?*}/$db?${TEST_DATABASE_URL#*\?}";; esac

run() { psql "$url" -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }
run supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
for t in supabase/tests/*.test.sql; do psql "$url" -q -v ON_ERROR_STOP=1 -f "$t"; done
