---
name: stack-decisions
description: KreiswertS app – stack per slides 1+2 (Applied Research), user decisions 2026-11-19: Drizzle, native PostgreSQL, frontend in the same repo; team split
metadata:
  type: project
---

Stack from slides 1+2 in `~/__project_applied_research/Praesentation/folien/` (Next.js + TypeScript, Node.js, React, Better Auth, Zod, Data Access Layer, ORM, PostgreSQL); data model = slide 3 (ER diagram 2026-11-18).

User decisions 2026-11-19:
- **ORM: Drizzle** (not Prisma) – the DB is maintained externally, schema can be imported with `drizzle-kit pull`.
- **Local DB: native PostgreSQL per system**, no Docker (user 2026-11-25: Linux, macOS and Windows should work the same) → `scripts/setup-postgres.sh` (apt / Homebrew) + `scripts/setup-postgres.ps1` (winget), PostgreSQL 17.
- **Frontend in the same repo** (one Next.js project, as on slide 2 “one project instead of two”).
- Public repository (GitHub `lu4k87/__project_kreiswertS`).

Team: user = backend + DB; frontend = another group; the DB is also managed by one more person. On 2026-11-19 the DB and app features were not fully described yet → only scaffold + one example endpoint (`GET /api/offers`), no features in advance.

**Why:** the user's requirements when the project was created.
**How to apply:** new endpoints follow the pattern of `src/app/api/offers/route.ts` (route → getViewer → Zod → DAL → Drizzle); do not resolve open DB points (README “Open”) in the schema on your own, name them to the user for the DB owner. See [[frontend-english-app-bilingual]].
