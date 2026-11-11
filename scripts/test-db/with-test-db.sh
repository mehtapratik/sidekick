#!/usr/bin/env bash
# Runs a command against a throwaway Postgres built from every package's migrations:
#   scripts/test-db/with-test-db.sh <command...>
# Starts a temporary cluster, applies the Supabase stand-ins and every package's 
# migrations in dependency order (the same path as pnpm db:migrate), enables 
# app_runtime login, exports connection URLs, runs the command, then deletes the 
# cluster — even if the command fails. Requires initdb, pg_ctl and psql of 
# the PostgreSQL major version in PG_MAJOR.
set -euo pipefail

# macOS Postgres refuses to start without a locale; Linux (CI) has a usable default
if [[ "$(uname)" == "Darwin" ]]; then
  export LC_ALL="${LC_ALL:-en_US.UTF-8}"
fi

# PostgreSQL major version must match production (Supabase). Bump in one place
# here — and in .github/workflows/ci.yml — when Supabase upgrades.
PG_MAJOR=17

# Use that version's tools from the usual install locations if present
# (Homebrew on Apple Silicon or Intel, Debian/Ubuntu packages), else PATH.
for dir in "/opt/homebrew/opt/postgresql@$PG_MAJOR/bin" \
           "/usr/local/opt/postgresql@$PG_MAJOR/bin" \
           "/usr/lib/postgresql/$PG_MAJOR/bin"; do
  if [[ -x "$dir/initdb" ]]; then
    PATH="$dir:$PATH"
    break
  fi
done

found="$(initdb --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
if [[ "$found" != "$PG_MAJOR" ]]; then
  echo "with-test-db.sh: PostgreSQL $PG_MAJOR tools required (found: ${found:-none})." >&2
  echo "  macOS: brew install postgresql@$PG_MAJOR" >&2
  exit 1
fi

PORT="${TEST_DB_PORT:-54329}"            # avoids a local Postgres on 5432
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
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
# Every package's migrations, in dependency order. turbo.json passes
# DATABASE_DIRECT_URL through to db:migrate, and no package reads .env.local,
# so this can only reach the throwaway database.
(cd "$ROOT" && DATABASE_DIRECT_URL="$(url postgres)" \
  pnpm turbo run db:migrate --output-logs=errors-only)
  
# The out-of-band step from the app_runtime decision note
psql "$(url admin)" -v ON_ERROR_STOP=1 -q \
  -c "ALTER ROLE app_runtime WITH LOGIN PASSWORD 'test-only'"

export DATABASE_URL="postgresql://app_runtime:test-only@127.0.0.1:$PORT/postgres"
export TEST_AUTH_DATABASE_URL="$(url supabase_auth_admin)"
# postgres: the privileged migration/seed role, the only one that writes entitlements
export TEST_ADMIN_DATABASE_URL="$(url postgres)"

"$@"
