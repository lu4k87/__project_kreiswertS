[Claude] [KreiswertS] Backend härten: Befunde aus dem Audit beheben
Rückmeldung an: admin-7f
Kontext: Projekt ~/mk_dev/__project_kreiswertS (Next.js 16.4,
  Better Auth 1.7, Zod 4, Drizzle, PostgreSQL), Branch
  feat/startseite-login, Stand Commit 2535c73. Audit vom
  2026-11-26 (Code gelesen, security-reviewer, Ende-zu-Ende-Test
  gegen eigene Instanz + eigene DB) hat die Punkte unten belegt.
  Entscheidung des Users: Backend-Paket beheben, Dev-Server nur
  lokal erreichbar machen.
  Nicht Teil der Aufgabe: E-Mail-Bestätigung/Freigabe vor der
  Rolle „Mitglied“ (bleibt offen, README „Open“), Oberfläche
  (src/app/**/page.tsx, src/components/) und Datenmodell
  (src/server/db/schema.ts).
Aufgabe: Prüfstufe 3 (Sicherheit). Je Punkt Fix + kleiner Test,
  danach npm run check, npm run build, Ende-zu-Ende gegen eigene
  Test-DB (AGENTS.md §5), security-reviewer vor dem Commit.
  1 Rate-Limit (src/server/auth.ts): rateLimit enabled true –
    unter next dev ist es sonst aus; Client-IP nicht aus einem
    vom Browser setzbaren X-Forwarded-For nehmen
    (advanced.ipAddress; Verhalten der installierten Version
    in node_modules nachlesen). Symptom: 6 Fehlversuche mit
    wechselndem Header ergeben kein 429.
  2 Größen: POST /api/auth/* über 16 KB mit 413 ablehnen;
    name 1–100 Zeichen im before-Hook (sign-up, update-user);
    image vom Browser nicht annehmen. Symptom: Name mit 6 MB
    wird gespeichert.
  3 Pool (src/server/db/client.ts): connectionTimeoutMillis,
    statement_timeout, query_timeout setzen; pool.on("error")
    ergänzen (Symptom: uncaughtException, wenn ruhende
    Verbindungen gekappt werden); DATABASE_URL erst beim ersten
    Zugriff prüfen (Symptom: next build bricht ohne die
    Variable ab).
  4 Logs: src/app/api/offers/route.ts:22 ohne Fehlerobjekt
    loggen; Better-Auth-Logger so setzen, dass Abfrage und
    Parameter von DB-Fehlern nicht im Log stehen. Symptom:
    Session-Token im Server-Log bei DB-Ausfall.
  5 Header (next.config.ts): poweredByHeader false,
    frame-ancestors 'none', nosniff, Referrer-Policy,
    Permissions-Policy; GET /api/offers mit
    Cache-Control: private, no-store.
  6 Secret: beim Start prüfen, dass BETTER_AUTH_SECRET gesetzt
    und mindestens 32 Zeichen lang ist (unter next dev greift
    sonst stillschweigend der Standardwert der Bibliothek).
  7 Skripte (scripts/setup-postgres.sh, .ps1): Werte als
    psql-Variablen statt im SQL-Text, Zufallspasswort als
    Standard, PGPASSWORD per try/finally entfernen.
  8 Dev-Server nur lokal: package.json
    "dev": "next dev -H 127.0.0.1"; README.md, README.de.md
    und docs/FRONTEND.md nachziehen.
  9 Kleinkram: import "server-only" in src/server/auth.ts und
    src/server/db/client.ts; @better-auth/cli mit fester
    Version; .gitignore-Zeile drizzle/meta/ entfernen; Satz
    zum Rate-Limit in README (Abschnitt „Open“) und AGENTS.md
    §5 richtigstellen (galt nur unter next start); dem User
    chmod 600 für .env nennen.
Dateien:
  - src/server/auth.ts
  - src/server/db/client.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/api/offers/route.ts
  - next.config.ts
  - package.json
  - scripts/setup-postgres.sh
  - scripts/setup-postgres.ps1
  - .gitignore
  - README.md, README.de.md, docs/FRONTEND.md
Beachten:
  - Sicherheit → Modell mindestens Opus (Skill model-routing)
  - laufende Instanz Port 3000, DB kreiswerts und .env nicht
    anfassen (AGENTS.md §0); eigene Instanz, eigene DB
  - AGENTS.md und package-lock.json sind uncommittet und fremd
    (next dev, npm 11) → nicht mitcommitten
  - Rate-Limit-Fenster verlängert sich mit jeder Anfrage → im
    Test nach je 3 Login-/Registrier-Anfragen 11 s Pause
  - Test-Skripte des Audits (e2e_setup.sh, e2e_test.py,
    e2e_rerun.py), falls der Ordner noch existiert, sonst neu
    bauen:
    /private/tmp/claude-501/-Users-admin/4fa94d78-68dc-404d-8174-ab972086eae3/scratchpad/
  - 4 Befunde an der Oberfläche (Tab-Reihenfolge bei 360 px,
    Links ohne Ziel, „1 Betriebe“, Favicon) gehören dem
    Frontend-Team → nicht ändern
