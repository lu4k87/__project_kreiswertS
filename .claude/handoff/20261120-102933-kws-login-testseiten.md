[Claude] KreiswertS: Testseiten Registrieren + Login
Rückmeldung an: dev-ws-57
Kontext: Repo ~/__project_kreiswertS (Stand b927b8c), Laptop eingerichtet:
  Node v20.20.2 in ~/.local/bin, .env mit BETTER_AUTH_SECRET, PostgreSQL
  lokal aktiv, Tabellen per db:push angelegt, /api/health = db up.
  Backend für Login steht schon: Better Auth (src/server/auth.ts),
  POST /api/auth/sign-up/email · sign-in/email · sign-out,
  GET /api/auth/get-session; Gast/Mitglied über src/server/viewer.ts.
  Startseite src/app/page.tsx ist nur ein Platzhalter.
Aufgabe: schlichte Testseiten bauen, damit der User Registrieren und
  Login im Browser ausprobieren kann (User-Wahl: Variante B):
  - /registrieren (Name, E-Mail, Passwort)
  - /login (E-Mail, Passwort)
  - /konto (zeigt Session: Name, E-Mail, Rolle Mitglied, Abmelden;
    ohne Login → Hinweis + Link zu /login)
  - Links dazu auf der Startseite
  Ohne Design, sichtbar als „nur zum Testen“ markiert; das
  Frontend-Team ersetzt die Seiten später nach Figma.
Nicht Teil der Aufgabe: Betrieb (sites) bei der Registrierung anlegen
  oder verknüpfen (siteId bleibt null) – braucht erst die Entscheidung
  der DB-Person zu users ↔ auth_users (README „Offen“).
Dateien:
  - src/app/page.tsx
  - src/app/registrieren/page.tsx, src/app/login/page.tsx,
    src/app/konto/page.tsx (neu)
  - ggf. src/lib/auth-client.ts (better-auth/react createAuthClient)
  - README.md (Abschnitte API + Lokal starten: Testseiten nennen)
Beachten:
  - AGENTS.md des Projekts lesen (Node-Pfad dort ist der eines anderen
    Rechners; hier liegt Node schon im PATH)
  - UI-Grundregeln RULES.md §3: neue Seiten → Vorschau-Pflicht mit dem
    User klären, bevor gebaut wird
  - Fehlermeldungen von Better Auth verständlich anzeigen (E-Mail schon
    vergeben, Passwort zu kurz, falsche Daten)
  - DoD: npm run check · npm run build · Ende-zu-Ende gegen eigene
    Test-DB und eigenen Port (curl + Headless Chrome), Prozesse per PID
    beenden
  - Sicherheit ab Login: security-reviewer (Opus) vor dem Commit
