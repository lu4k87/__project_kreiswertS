#!/usr/bin/env bash
# Einmalig je Rechner (Linux oder macOS): PostgreSQL installieren, starten und Nutzer + Datenbank
# für die lokale Entwicklung anlegen. Werte passen zu .env.example. Windows: scripts/setup-postgres.ps1
#   Linux: apt + systemd (braucht sudo) · macOS: Homebrew (postgresql@17, Dienst per brew services)
# Anderer Name/Passwort: DB_USER=… DB_PASS=… DB_NAME=… scripts/setup-postgres.sh
set -euo pipefail
DB_USER="${DB_USER:-kreiswerts}"
DB_PASS="${DB_PASS:-kreiswerts}"
DB_NAME="${DB_NAME:-kreiswerts}"
PG_FORMULA="postgresql@17"

case "$(uname -s)" in
  Darwin)
    command -v brew >/dev/null || { echo "❌ Homebrew fehlt → https://brew.sh" >&2; exit 1; }
    brew list "$PG_FORMULA" >/dev/null 2>&1 || brew install "$PG_FORMULA"
    export PATH="$(brew --prefix "$PG_FORMULA")/bin:$PATH"
    brew services start "$PG_FORMULA" >/dev/null
    # Homebrew legt den eigenen macOS-Nutzer als Superuser an (kein sudo, kein Nutzer „postgres“)
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
    echo "❌ Nicht unterstützt: $(uname -s) – unter Windows scripts/setup-postgres.ps1 in PowerShell ausführen" >&2
    exit 1
    ;;
esac

# Warten, bis der Dienst Verbindungen annimmt (frisch gestartet dauert es ein paar Sekunden)
for _ in $(seq 1 20); do
  as_admin psql -tAc "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done

if ! as_admin psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  as_admin psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}'"
fi
if ! as_admin psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  as_admin psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\""
fi
echo "✅ PostgreSQL bereit: postgres://${DB_USER}:***@localhost:5432/${DB_NAME}"
