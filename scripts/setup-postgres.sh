#!/usr/bin/env bash
# Once per machine (Linux or macOS): install and start PostgreSQL and create user + database
# for local development. Windows: scripts/setup-postgres.ps1
#   Linux: apt + systemd (braucht sudo) · macOS: Homebrew (postgresql@17, Dienst per brew services)
# Anderer Name/Passwort: DB_USER=… DB_PASS=… DB_NAME=… scripts/setup-postgres.sh
# Without DB_PASS a new user gets a random password; the finished DATABASE_URL line for .env is printed at the end.
set -euo pipefail
DB_USER="${DB_USER:-kreiswerts}"
DB_NAME="${DB_NAME:-kreiswerts}"
GENERATED=""
if [ -z "${DB_PASS:-}" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  GENERATED=1
fi
# \set reads one line → a line break in the password would run the rest as a separate command
case "$DB_PASS" in *$'\n'* | *$'\r'*) echo "❌ DB_PASS darf keinen Zeilenumbruch enthalten" >&2; exit 1 ;; esac
PG_FORMULA="postgresql@17"

case "$(uname -s)" in
  Darwin)
    command -v brew >/dev/null || { echo "❌ Homebrew fehlt → https://brew.sh" >&2; exit 1; }
    brew list "$PG_FORMULA" >/dev/null 2>&1 || brew install "$PG_FORMULA"
    export PATH="$(brew --prefix "$PG_FORMULA")/bin:$PATH"
    brew services start "$PG_FORMULA" >/dev/null
    # Homebrew creates your own macOS user as superuser (no sudo, no user 'postgres')
    as_admin() { "$@" -d postgres; }
    ;;
  Linux)
    if ! command -v psql >/dev/null; then
      sudo apt-get update
      sudo apt-get install -y postgresql
    fi
    sudo systemctl enable --now postgresql
    as_admin() { sudo -u postgres "$@"; }
    ;;
  *)
    echo "❌ Not supported: $(uname -s) – on Windows run scripts/setup-postgres.ps1 in PowerShell" >&2
    exit 1
    ;;
esac

# Wait until the service accepts connections (takes a few seconds right after start)
for _ in $(seq 1 20); do
  as_admin psql -X -tAc "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done

# Name and password go in as psql variables (:'name' = text, :"name" = identifier), never into the SQL text:
# so a special character in them cannot inject SQL. psql substitutes variables only in SQL from stdin, not with -c.
# The password comes as a \set line via stdin, never as an argument: arguments show up in the process list and, on
# Linux, permanently in the sudo log (/var/log/auth.log).
# Inside single quotes psql interprets \ and ' → double both. With sed instead of ${…//…}: shell substitution
# treats \ and ' differently per bash version (macOS ships bash 3.2) and stored a different password.
psql_escape() { printf '%s' "$1" | LC_ALL=C sed -e 's/\\/\\\\/g' -e "s/'/''/g"; }
run_sql() {
  { printf '\\set db_pass %s\n' "'$(psql_escape "$DB_PASS")'"; cat; } |
    as_admin psql -X -qtA -v ON_ERROR_STOP=1 -v db_user="$DB_USER" -v db_name="$DB_NAME"
}

ROLE_EXISTS="$(run_sql <<<"SELECT 1 FROM pg_roles WHERE rolname = :'db_user'")"
if [ "$ROLE_EXISTS" != "1" ]; then
  # The three SET lines apply to this session only: if CREATE ROLE fails (e.g. reserved name) or the server logs
  # all statements, the statement including the password would otherwise end up in the PostgreSQL log.
  run_sql <<'SQL'
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
SET log_min_duration_statement = -1;
CREATE ROLE :"db_user" LOGIN PASSWORD :'db_pass';
SQL
fi
if [ "$(run_sql <<<"SELECT 1 FROM pg_database WHERE datname = :'db_name'")" != "1" ]; then
  run_sql <<'SQL'
CREATE DATABASE :"db_name" OWNER :"db_user";
SQL
fi

if [ "$ROLE_EXISTS" = "1" ]; then
  echo "✅ PostgreSQL ready: postgres://${DB_USER}:***@localhost:5432/${DB_NAME} (user already existed, password unchanged)"
  echo "   Set up before 2026-11-26? Then the old, publicly known default password still applies → change it: README, section “Run locally”"
elif [ -n "$GENERATED" ]; then
  echo "✅ PostgreSQL ready. Put this line into .env – the password is shown only now:"
  echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
else
  echo "✅ PostgreSQL bereit: postgres://${DB_USER}:***@localhost:5432/${DB_NAME}"
fi
