#!/usr/bin/env bash
# Einmalig je Rechner: PostgreSQL per apt installieren und Nutzer + Datenbank für die
# lokale Entwicklung anlegen (braucht sudo). Werte passen zu .env.example.
# Anderer Name/Passwort: DB_USER=… DB_PASS=… DB_NAME=… scripts/setup-postgres.sh
set -euo pipefail
DB_USER="${DB_USER:-kreiswerts}"
DB_PASS="${DB_PASS:-kreiswerts}"
DB_NAME="${DB_NAME:-kreiswerts}"

if ! command -v psql >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y postgresql
fi
sudo systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi
echo "✅ PostgreSQL bereit: postgres://${DB_USER}:***@localhost:5432/${DB_NAME}"
