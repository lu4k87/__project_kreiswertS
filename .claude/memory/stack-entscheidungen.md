---
name: stack-entscheidungen
description: KreiswertS-App – Stack nach Folie 1+2 (Applied Research), Entscheidungen des Users 2026-11-19: Drizzle, PostgreSQL per apt, Frontend im gleichen Repo; Team-Aufteilung
metadata:
  type: project
---

Stack aus den Folien 1+2 in `~/__project_applied_research/Praesentation/folien/` (Next.js + TypeScript, Node.js, React, Better Auth, Zod, Data Access Layer, ORM, PostgreSQL); Datenmodell = Folie 3 (ER-Diagramm 2026-11-18).

User-Entscheidungen 2026-11-19:
- **ORM: Drizzle** (nicht Prisma) – DB wird extern gepflegt, Schema per `drizzle-kit pull` übernehmbar.
- **Lokale DB: PostgreSQL nativ je System**, kein Docker (User 2026-11-25: Linux, macOS und Windows sollen gleich laufen) → `scripts/setup-postgres.sh` (apt / Homebrew) + `scripts/setup-postgres.ps1` (winget), PostgreSQL 17.
- **Frontend im gleichen Repo** (ein Next.js-Projekt, wie Folie 2 „ein Projekt statt zwei“).
- Repo öffentlich (GitHub `lu4k87/__project_kreiswertS`).

Team: User = Backend + DB; Frontend = andere Gruppe; DB zusätzlich von einer weiteren Person verwaltet. DB und App-Funktionen waren am 2026-11-19 noch nicht fertig beschrieben → nur Gerüst + ein Beispiel-Endpunkt (`GET /api/offers`), keine Funktionen auf Vorrat.

**Why:** Vorgaben des Users beim Anlegen des Projekts.
**How to apply:** Neue Endpunkte nach dem Muster `src/app/api/offers/route.ts` (Route → getViewer → Zod → DAL → Drizzle); offene DB-Punkte (README „Offen“) nicht eigenmächtig im Schema lösen, sondern dem User für die DB-Person nennen.
