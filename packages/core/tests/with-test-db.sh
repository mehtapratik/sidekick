#!/usr/bin/env bash
# Runs a command against a throwaway Postgres built from our migrations:
#   test/with-test-db.sh <command...>
# Starts a temporary cluster, applies the Supabase stand-ins and all
# migrations, enables app_runtime login, exports connection URLs, runs the
# command, then deletes the cluster — even if the command fails.
# Requires initdb, pg_ctl and psql on PATH (e.g. Homebrew postgresql@15).
set -euo pipefail

export LC_ALL="${LC_ALL:-en_US.UTF-8}"   # macOS Postgres refuses to start without a locale
PORT="${TEST_DB_PORT:-54329}"            # avoids a local Postgres on 5432
HERE="$(cd "$(dirname "$0")" && pwd)"
CORE="$(cd "$HERE/.." && pwd)"
DATA="$(mktemp -d)"

cleanup() {
  pg_ctl -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

url() { echo "postgresql://$1@127.0.0.1:$PORT/postgres"; }

# Local-only cluster: trust auth, TCP on 127.0.0.1, no Unix socket
initdb -D "$DATA" -U admin --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" \
  -l "$DATA/server.log" -w start >/dev/null

psql "$(url admin)" -v ON_ERROR_STOP=1 -q -f "$HERE/supabase-stub.sql"
(cd "$CORE" && DATABASE_DIRECT_URL="$(url postgres)" drizzle-kit migrate >/dev/null)

# The out-of-band step from the app_runtime decision note
psql "$(url admin)" -v ON_ERROR_STOP=1 -q \
  -c "ALTER ROLE app_runtime WITH LOGIN PASSWORD 'test-only'"

export DATABASE_URL="postgresql://app_runtime:test-only@127.0.0.1:$PORT/postgres"
export TEST_AUTH_DATABASE_URL="$(url supabase_auth_admin)"

"$@"
