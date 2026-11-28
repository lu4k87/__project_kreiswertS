[Claude] [KreiswertS] Statische Live-Demo auf github.io einbauen
übernommen von mk-dev-ce am 2026-11-28 11:50
Rückmeldung an: mk-dev-87
Kontext: Projekt ~/mk_dev/__project_kreiswertS (Next.js 16,
  Better Auth, Drizzle, PostgreSQL), Branch main, Stand 5856844.
  Der User will die App live mit Demo-Login und Demo-Daten unter
  lu4k87.github.io. GitHub Pages liefert nur Dateien aus, die App
  braucht einen Server → Entscheidungen des Users (2026-11-28):
  - Weg: statische Version auf github.io (kein Vercel, kein
    eigener Server)
  - nur Demo-Logins, Registrierung in der Demo abgeschaltet
  - Administrator admin_demo auch als Demo-Login
  - Wunsch wörtlich: „mach aber im header der webseite einen (i)
    hinweis, dass es sich bei DIESER webseite dann um eine
    statische version handelt und gib sinvoll informationen!“
  Machbarkeit ist bewiesen: der unveränderte App-Code läuft
  komplett im Browser (Probe-Aufbau, 13/13 Schritte grün im
  Chrome von einem reinen Datei-Server: Start, Login site_a,
  9 Plattform-Seiten, Menü-Navigation, /api).
  - vinext 1.4.7 (Next-API auf Vite) baut die App,
    `vinext check` = 100 % kompatibel
  - PGlite 0.6.1 = PostgreSQL als WASM im Browser, gefüllt mit
    dem unveränderten scripts/seed.mjs --demo
  - ein Service Worker spielt den Server (Seiten + /api/*)
  - ausgetauscht wird nur src/server/db/client.ts (Vite-Plugin)
Aufgabe: Probe-Aufbau sauber ins Projekt einbauen, fertigstellen
  und nach Freigabe veröffentlichen.
  1. ZUERST lesen: .claude/spike/static-demo/NOTES.md (Aufbau,
     Stolpersteine, offene Punkte); Dateien von dort nach demo/
     übernehmen, npm-Skripte demo:db · demo:build · demo:test,
     Debug-Ausgaben entfernen
  2. Daten müssen den Neustart des Workers überleben (PGlite
     idb://, Dump nur beim ersten Start) + „Demo zurücksetzen“
  3. (i)-Hinweis im Kopf, nur im Demo-Build, DE + EN: statische
     Version ohne Server · Daten fiktiv und nur in diesem Browser,
     nicht mit anderen geteilt · Zurücksetzen · was fehlt
     (Registrierung, E-Mail, Zahlung nur simuliert) · Demo-Logins
     · Stand (Commit + Datum) · Link zur Architektur-Seite
  4. Login-Seite der Demo: Demo-Logins zum Anklicken (Firmen +
     admin_demo), Registrierung aus
  5. Test erweitern: Angebot anlegen, Verhandlung, Abmelden,
     Login wechseln, Administrator, Neustart des Workers
  6. Veröffentlichen unter lu4k87.github.io/web_kreiswerts/app/
     (Architektur-Seite unter /web_kreiswerts/ bleibt), Knopf
     „Live-Demo“ auf der Projektkarte, 404-Umleitung für
     Direktlinks
Dateien:
  - .claude/spike/static-demo/ (Probe-Aufbau + NOTES.md → nach
    Übernahme mit diesem Zettel löschen)
  - next.config.ts (eine Zeile basePath, siehe .diff im Ordner)
  - package.json, package-lock.json (Dev-Pakete laut NOTES.md)
  - src/components/layout/ (Kopf), src/components/auth/
    login-form.tsx, src/i18n/ (Texte DE + EN)
  - ~/mk_dev/ai_dev_workflow_global/bin/pages_hook.sh und
    config/projects.yaml (Eintrag kreiswertS) → Veröffentlichung
  - ~/mk_dev/lu4k87.github.io/404.html (gemeinsam für alle
    Projekte)
Beachten:
  - Veröffentlichen erst nach Rückfrage beim User im neuen Chat
    (die Auswahl im Ursprungs-Chat gilt dort nicht als Freigabe)
  - Prüfstufe 3 vor dem Veröffentlichen: Agent security-reviewer;
    Ausgabe nach den Werten aus .env und .env.demo durchsuchen
    (nichts Echtes im Bundle; Demo-Passwörter sind absichtlich
    öffentlich → eigene, nicht die aus .env.demo)
  - (i)-Hinweis + Demo-Logins = neue UI-Elemente → erst Vorschau
    (Skill preview), dann Skill layout-guard (hell + dunkel)
  - parallele Chats ändern im selben Repo UI und Logo (mk-dev-2f,
    mk-dev-b9, mk-dev-cb) → vor gemeinsamen Dateien abstimmen,
    nur eigene Pfade committen
  - Test-Instanzen nur auf eigenem Port; laufende App (Port 3000),
    lokale DB kreiswerts und .env nicht anfassen
  - Größe: rund 30 MB Dateien, erster Aufruf rund 12 MB
    komprimiert → Ladeanzeige auf der Startseite
