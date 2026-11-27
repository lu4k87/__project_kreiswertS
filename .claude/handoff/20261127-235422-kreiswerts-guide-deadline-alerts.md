[KreiswertS] Leitfaden, Ablaufdatum, gespeicherte Suche
Rückmeldung an: mk-dev-f9

Kontext:
  KreiswertS (~/mk_dev/__project_kreiswertS), Stand 92faa16.
  Funktionsliste CONTENT/Functions_KreiswertS_EN.docx: Nr. 46
  Leitfaden-Seite, Nr. 41 Frist im Inserat, Nr. 19 gespeicherte
  Suche + In-App-Hinweis fehlen im Code. User hat alle drei am
  2026-11-27 bestellt (mk-dev-f9).

Aufgabe (nacheinander, alle ändern das Schema):
  1. Nr. 41: Feld "verfügbar bis" an Angeboten (Spalte
     available_until), Label "dringend" in Liste + Karte,
     Sortierung nach Frist; Zod, DAL, Formular, Detailseite.
  2. Nr. 46: öffentliche Seite /guide – Pflichten beider
     Seiten, Nebenprodukt oder Abfall, Ablauf einer
     Kooperation, Quellen (KrWG §§ 4–6, PPWR Art. 7 aus
     "Read me" der xlsx), keine Rechtsberatung; Link im Footer.
  3. Nr. 19: Suche speichern (Filter von /offers), Hinweis
     als Glocke im Kopf, sobald ein passendes Angebot
     veröffentlicht wird; Tabellen saved_searches +
     notifications, Zugriffsregeln je Standort.
  Je Punkt: Abnahme- + Negativtest in E2E, docs/FEATURES.md,
  docs/FRONTEND.md §10, Architektur-Seite (make.py), DE+EN.

Dateien:
  src/server/db/schema.ts, src/server/validation/,
  src/server/dal/, src/app/api/, src/app/(platform)/offers/,
  src/app/(platform)/my-offers/, src/app/guide/ (neu),
  src/i18n/, scripts/e2e-level*.mjs, docs/

Beachten:
  Glocke im Header erst, wenn mk-dev-f9 Logo + Header
  committet hat (git log, sonst SendMessage an mk-dev-f9);
  bis dahin Punkte 1–2. Chat kreiswerts-demo-replication
  ändert parallel scripts/seed/ → vor dem Commit pullen,
  nur eigene Pfade. Schema-Änderungen per drizzle-kit, nie
  die User-DB kreiswerts oder Port 3000 anfassen.
