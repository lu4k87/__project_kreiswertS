---
name: postgres-local-trust
description: kreiswertS – auf dem Mac prüft PostgreSQL (Homebrew) lokal kein Passwort (trust) → Passwort-Tests nur per SCRAM-Hash; Skripte laufen dort mit bash 3.2
metadata:
  type: reference
---

Auf dem Mac (PostgreSQL 17 per Homebrew) steht `pg_hba.conf` für Socket, `127.0.0.1` und `::1` auf `trust`: jede lokale Anmeldung gelingt, auch mit falschem Passwort (geprüft 2026-11-26 mit `select type, address, auth_method from pg_hba_file_rules`).

**Why:** Beim Härten von `scripts/setup-postgres.sh` bewies der Test „mit dem neuen Passwort verbunden“ nichts. Erst der Vergleich mit dem SCRAM-Eintrag in `pg_authid` zeigte, dass ein Entwurf Passwörter mit `'` oder `\` verändert speicherte: bash 3.2 von macOS wertet `${var//…}` anders aus als bash 5.

**How to apply:** Passwörter von DB-Rollen auf dem Mac über den SCRAM-Hash prüfen (PBKDF2-SHA256 mit Salt und Iterationen aus `pg_authid.rolpassword`, `StoredKey` vergleichen), nicht über einen Login. Shell-Skripte des Projekts auch mit bash 3.2 laufen lassen; Zeichen mit `sed` ersetzen statt mit `${var//…}`. Linux (apt) prüft Passwörter über localhost.
