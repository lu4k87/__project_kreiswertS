#!/usr/bin/env bash
# Einmalig je Rechner (Linux oder macOS): PostgreSQL installieren, starten und Nutzer + Datenbank
# für die lokale Entwicklung anlegen. Windows: scripts/setup-postgres.ps1
#   Linux: apt + systemd (braucht sudo) · macOS: Homebrew (postgresql@17, Dienst per brew services)
# Anderer Name/Passwort: DB_USER=… DB_PASS=… DB_NAME=… scripts/setup-postgres.sh
# Ohne DB_PASS bekommt ein neuer Nutzer ein Zufallspasswort; die fertige DATABASE_URL-Zeile für .env steht am Ende.
set -euo pipefail
DB_USER="${DB_USER:-kreiswerts}"
DB_NAME="${DB_NAME:-kreiswerts}"
GENERATED=""
if [ -z "${DB_PASS:-}" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  GENERATED=1
fi
# \set liest eine Zeile → ein Zeilenumbruch im Passwort würde den Rest als eigenen Befehl ausführen
case "$DB_PASS" in *$'\n'* | *$'\r'*) echo "❌ DB_PASS darf keinen Zeilenumbruch enthalten" >&2; exit 1 ;; esac
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
  as_admin psql -X -tAc "SELECT 1" >/dev/null 2>&1 && break
  sleep 1
done

# Name und Passwort gehen als psql-Variablen hinein (:'name' = Text, :"name" = Bezeichner), nie in den SQL-Text:
# so kann ein Sonderzeichen darin kein SQL einschleusen. psql ersetzt Variablen nur in SQL von stdin, nicht bei -c.
# Das Passwort kommt als \set-Zeile über stdin, nie als Argument: Argumente stehen in der Prozessliste und unter Linux
# dauerhaft im sudo-Log (/var/log/auth.log).
# In einfachen Anführungszeichen wertet psql \ und ' aus → beide verdoppeln. Mit sed statt ${…//…}: die Ersetzung in
# der Shell behandelt \ und ' je nach bash-Version anders (macOS liefert bash 3.2) und speicherte ein anderes Passwort.
psql_escape() { printf '%s' "$1" | LC_ALL=C sed -e 's/\\/\\\\/g' -e "s/'/''/g"; }
run_sql() {
  { printf '\\set db_pass %s\n' "'$(psql_escape "$DB_PASS")'"; cat; } |
    as_admin psql -X -qtA -v ON_ERROR_STOP=1 -v db_user="$DB_USER" -v db_name="$DB_NAME"
}

ROLE_EXISTS="$(run_sql <<<"SELECT 1 FROM pg_roles WHERE rolname = :'db_user'")"
if [ "$ROLE_EXISTS" != "1" ]; then
  # Die drei SET-Zeilen gelten nur für diese Sitzung: scheitert CREATE ROLE (z. B. reservierter Name) oder loggt der
  # Server alle Anweisungen, stünde die Anweisung sonst samt Passwort im PostgreSQL-Log.
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
  echo "✅ PostgreSQL bereit: postgres://${DB_USER}:***@localhost:5432/${DB_NAME} (Nutzer bestand schon, Passwort unverändert)"
  echo "   Vor dem 2026-11-26 eingerichtet? Dann gilt noch das alte, öffentlich bekannte Standardpasswort → ändern: README, Abschnitt „Lokal starten“"
elif [ -n "$GENERATED" ]; then
  echo "✅ PostgreSQL bereit. Diese Zeile in .env eintragen – das Passwort wird nur jetzt angezeigt:"
  echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
else
  echo "✅ PostgreSQL bereit: postgres://${DB_USER}:***@localhost:5432/${DB_NAME}"
fi
