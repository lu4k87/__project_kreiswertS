---
name: postgres-local-trust
description: kreiswertS – on the Mac, PostgreSQL (Homebrew) does not check passwords locally (trust) → test passwords only via SCRAM hash; scripts run there with bash 3.2
metadata:
  type: reference
---

On the Mac (PostgreSQL 17 via Homebrew), `pg_hba.conf` is set to `trust` for the socket, `127.0.0.1` and `::1`: every local login succeeds, even with a wrong password (checked 2026-11-26 with `select type, address, auth_method from pg_hba_file_rules`).

**Why:** while hardening `scripts/setup-postgres.sh`, the test “connected with the new password” proved nothing. Only comparing with the SCRAM entry in `pg_authid` showed that a draft stored passwords containing `'` or `\` altered: macOS bash 3.2 evaluates `${var//…}` differently from bash 5.

**How to apply:** on the Mac, verify DB role passwords via the SCRAM hash (PBKDF2-SHA256 with salt and iterations from `pg_authid.rolpassword`, compare `StoredKey`), not via a login. Run the project's shell scripts with bash 3.2 too; replace characters with `sed` instead of `${var//…}`. Linux (apt) checks passwords over localhost.
