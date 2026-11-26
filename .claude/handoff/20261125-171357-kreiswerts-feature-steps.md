[Claude] [KreiswertS] Abschnitt 11 „Funktion ergänzen“ verständlich
übernommen von mk-dev-9d · mach eine grafik die deutlich und verständlich (englisch) ma am 2026-11-25 17:15
Rückmeldung an: mk-dev-9d
Kontext: Projekt ~/mk_dev/__project_kreiswertS (Next.js 16,
  Better Auth, Zod, Drizzle, PostgreSQL), Branch feat/startseite-login,
  Stand Commit 78313de. Die Architektur-Seite gibt es auf Englisch
  (docs/architecture.html) und Deutsch (docs/architecture.de.html),
  beide erzeugt mit: python3 scripts/architecture/make.py
  (HTML nie von Hand ändern → build.py + de.json, dann make.py).
  Abschnitt 11 „Adding a feature / Eine Funktion ergänzen“ hat
  4 Karten: 1 Planen · 2 Regeln + Daten · 3 Antwort-Typ festlegen ·
  4 Die fünf Stationen bauen (nur eine Chip-Kette
  Route → Auth → Zod → DAL → Drizzle + 1 Satz).
Aufgabe: Wunsch des Users wörtlich: „vor allem 4 ist nicht gut und
  verständlich beschrieben, was ist genau damit gemeint ... mach auch
  Beispiel-UI-Elemente rein, wenn es Sinn macht, alles sauber und
  ordentlich strukturiert wie bisher anordnen“.
  - Schritt 4 konkret erklären: je Station was man tut, in welcher
    Datei, mit kurzem Code – am besten an EINEM durchgehenden
    Beispiel (z. B. neuer Endpunkt GET /api/materials für die
    Material-Auswahl): route.ts anlegen → getViewer() → Zod-Schema →
    DAL-Funktion → Drizzle-Abfrage → FRONTEND.md nachziehen
  - Schritte 1–3 am selben Beispiel greifbar machen
    (Zeile in docs/FEATURES.md, Antwort-Typ, Mock-Daten)
  - Beispiel-UI-Elemente, wo sie helfen: z. B. Material-Dropdown als
    Ergebnis, Karte mit JSON-Antwort Gast/Mitglied, Dateibaum der
    neuen Dateien, Checkliste „fertig, wenn …“
  - Fehler im Bild beheben: in Karte 4 sind die Chips ungleich groß
    („Route“ klein, „Auth/Zod/DAL/Drizzle“ groß) – Ursache
    `.steps b{font-size:17px}` trifft die <b>-Hüllen in `.mini`
Dateien:
  - scripts/architecture/build.py (page(): „# 9 new feature“,
    `<ol class="steps">`, CSS `.steps`, `.mini`)
  - scripts/architecture/de.json (deutsche Texte, Schlüssel =
    englischer Textknoten; SVG-Beschriftungen über tr())
  - scripts/architecture/make.py, translate.py (nur ausführen)
  - docs/architecture.html, docs/architecture.de.html,
    docs/architecture.png (Ergebnis, mit committen)
  - Vorlage für die 5 Stationen: src/app/api/offers/route.ts,
    src/server/viewer.ts, src/server/validation/offers.ts,
    src/server/dal/offers.ts, src/server/db/schema.ts
Beachten:
  - Stil wie bisher: Farb-Legende (Frontend blau, Next.js violett,
    Login amber, Zod petrol, DAL indigo = Hauptfarbe, Daten rosa,
    Grün nur für „fertig“), hell als Standard + dunkel, Karten mit
    1 px Rand, keine Schatten, Code in <pre>/<code>
  - Nur englische Datei-/Ordnernamen (.claude/memory)
  - Jeder neue englische Text braucht den deutschen Eintrag in
    de.json; `translate.py build … -v` zeigt, was fehlt
  - Nur belegte Fakten: /api/materials ist „geplant“, nicht live –
    als Beispiel kennzeichnen, nichts im App-Code anlegen
  - Pflicht-Messung für EN + DE: layout_audit.py (Skill layout-guard)
    ist für Linux gebaut; auf dem Mac über Wrapper starten: venv mit
    numpy, pillow, websocket-client · Skript `google-chrome` im PATH,
    das Chrome.app startet · ui_new_code_checker._die_with_parent
    = None setzen, dann layout_audit.py per runpy ausführen
  - Vorschau-Kopien nach dem Bauen: architecture.html als index.html
    + architecture.html und architecture.de.html nach
    ~/ai_dev_workflow_global/__treasury__allprojects/kreiswertS/
    vorschauen/2026-11-25-backend-architecture/ (Link Port 8085)
  - PNG: ganze englische Seite, hell (data-theme="light"), 1440 breit
  - Nicht anfassen: Dev-Server Port 3000, DB kreiswerts, fremde
    uncommittete Änderungen in AGENTS.md und package-lock.json
  - Commit + Push direkt im Repo, nur eigene Dateien; diese
    Übergabe-Datei im Commit der fertigen Arbeit löschen (git rm)
