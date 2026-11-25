# Projekt-Regeln (kreiswertS)

Ergänzt die gemeinsamen Regeln aller Projekte (`~/.claude/CLAUDE.md` → `~/ai_dev_workflow_global/rules/RULES.md`, gleiche Abschnittsnummern); bei Widerspruch gilt diese Datei, Sicherheit (§0) hat immer Vorrang. Angelegt am 2026-11-19 mit `~/ai_dev_workflow_global/bin/projects.py new`; Stellen mit „ausfüllen“ klärt der erste Chat mit dem User.

## 0. Sicherheit
- **Arbeitsstand des Users nicht anfassen:** laufende Instanz (`npm run dev`, Port 3000), lokale DB `kreiswerts`, `.env` – Tests nur mit eigener Instanz (anderer Port, eigene DB, z. B. PGlite im Scratchpad).
- **Öffentliches Repo:** nur Demo-Daten, keine echten Firmen-/Kontaktdaten ohne Quelle und Freigabe; Secrets nur in `.env`.
- **Team-Grenzen:** Oberfläche (`src/app/**/page.tsx`, `src/components/`) baut das Frontend-Team, das Datenmodell verantworten die DB-Verantwortlichen → dort nur auf Wunsch des Users ändern.
- Zugangsdaten, `.env`, Nutzerdaten nie einchecken, nie in Antworten oder Screenshots zeigen.

## 0c. Skill-Finder
- Allgemeine Skills: Tabelle in `RULES.md` §0c; eigene Skills dieses Projekts in `.claude/skills/` → hier je eine Zeile.

## 4. Projekt-Karte

| Ort | Zweck |
|---|---|
| `AGENTS.md` | diese Regeln (`GEMINI.md` = Link darauf) |
| `.claude/memory/` | Projekt-Memory, Index `MEMORY.md` (Claude lädt ihn selbst, Codex/Gemini lesen ihn zu Beginn) |
| `README.md` | Stack, lokal starten, Wer arbeitet wo, API, offene DB-Punkte |
| `src/app/api/` | Route Handler (Backend), Beispiel aller 5 Stationen: `offers/route.ts` |
| `src/server/` | `auth.ts` (Better Auth) · `viewer.ts` (Gast/Mitglied) · `validation/` (Zod) · `dal/` (Zugriffsregeln) · `domain/` (Status-Abläufe) · `db/` (Drizzle-Schema + Client) |
| `docs/FUNKTIONEN.md` | Plan aller Funktionen (Datenmodell, Endpunkte, Status, offene DB-Fragen) → neue Funktion dort zuerst eintragen |
| `docs/FRONTEND.md` | Leitfaden für das Frontend-Team, **nur Englisch** (Ordner, Daten holen, Login, Rollen, DE/EN, Styling, fehlende Endpunkte) → bei neuem Endpunkt Tabelle §10 dort nachziehen |
| `scripts/setup-postgres.sh` · `.ps1` | PostgreSQL 17 installieren + Nutzer/DB anlegen: `.sh` Linux (apt, sudo) + macOS (Homebrew), `.ps1` Windows (winget) |

## 5. Arbeitsweise
- **Node:** ≥ 20.9 (`.nvmrc` 20; Node 24 geht auch). Linux-Rechner mit System-Node v12: `export PATH=$HOME/.local/node-v20.20.2-linux-x64/bin:$PATH` · Mac: System-Node, PostgreSQL per Homebrew (`brew services`).
- **Prüfungen (Definition of Done):** `npm run check` (TypeScript + vitest) · `npm run build` · API-/Login-Änderung zusätzlich Ende-zu-Ende gegen eigene Test-DB (`DB_NAME=kreiswerts_e2e scripts/setup-postgres.sh`, `DATABASE_URL=… npx drizzle-kit push --force`, `next start -p <eigener Port>` mit `BETTER_AUTH_URL` dieses Ports, curl/Playwright) und Prozesse danach per PID beenden. Login-Tests mit Abstand: Better Auth begrenzt Login-Versuche je 10 s.
- **npm:** vitest bleibt auf 4.x – vitest 5 bricht `npm install` mit npm 10 ab (`edgesOut`-Fehler, Peer von better-auth).
- **Commit + Push:** direkt in diesem Repo (`git@github.com:lu4k87/__project_kreiswertS.git`), Skill `commit`; Liste aller Projekte: `~/ai_dev_workflow_global/config/projects.yaml`.
