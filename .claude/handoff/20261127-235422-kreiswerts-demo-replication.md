[KreiswertS] 10+ Demo-Firmen und Replikations-Anleitung
Rückmeldung an: mk-dev-f9

Kontext:
  KreiswertS (~/mk_dev/__project_kreiswertS), Stand 92faa16.
  Projektziele der Spezifikation (CONTENT/KreiswertS_Backend_
  Functionality.xlsx, Blatt "Read me"): ≥10 dokumentierte
  Unternehmen, Replikations-Anleitung. Heute: 4 Firmen /
  5 Standorte in scripts/seed/demo.mjs, kein Import/Export.
  User hat beides am 2026-11-27 bestellt (mk-dev-f9).

Aufgabe:
  1. Fiktive Demo-Firmen auf ≥10 erweitern (je mit Standort,
     Branche, Park, Fähigkeiten, Angeboten/Anfragen passend zu
     den Fällen A–E); Namen klar fiktiv "(fiktiv)", keine
     echten Firmen (AGENTS.md §0).
  2. Import/Export: Skript in scripts/ liest Firmen, Standorte
     und Materialkatalog aus CSV und schreibt sie zurück
     (Funktion 34 in CONTENT/Functions_KreiswertS_EN.docx).
  3. Anleitung docs/REPLICATION.md: andere Region setzt die
     Plattform mit eigenen Daten auf (Postgres, Seed, Import).
  4. README, docs/FEATURES.md, Architektur-Seite nachziehen
     (Memory dev-team-page-always-current).

Dateien:
  scripts/seed/demo.mjs, scripts/seed/reference.mjs,
  scripts/ (neues Import/Export-Skript), docs/REPLICATION.md,
  README.md, docs/FEATURES.md, scripts/e2e-level*.mjs

Beachten:
  Chat mk-dev-f9 baut parallel Logo + Design-Feinschliff
  (Header, layout.tsx, globals.css, components) → diese
  Dateien nicht anfassen. Ein dritter Chat
  (kreiswerts-guide-deadline-alerts) ändert das Schema
  (available_until, saved searches) → Seed-Konflikte per
  git pull vor dem Commit, nur eigene Pfade committen.
  E2E nur gegen eigene Test-DB (*_e2e), nie Port 3000.
