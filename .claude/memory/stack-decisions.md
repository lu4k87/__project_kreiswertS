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
**How to apply:** new endpoints follow the pattern of `src/app/api/offers/route.ts` (route inside `api()` → viewer → Zod → DAL → Drizzle). See [[frontend-english-app-bilingual]].

**Update 2026-11-26/27:** for the Level 1 build (spec in `CONTENT/`, plan in `docs/FEATURES.md`) the user lifted the team boundary for frontend and data model: the schema in `src/server/db/schema.ts` is now owned in this repository (16 tables; the old `users` and `agreements` tables are gone). The boundary rule in `AGENTS.md` §0 still applies to later tasks unless the user lifts it again. User on 2026-11-27: finish without further questions and decide sensibly where something is unclear – applies to that task, not as a standing rule.

**Update 2026-11-27 (Level 2, part 1):** the user chose requests + matching (PG-17 – PG-22) as the next step, allowed extending `schema.ts` for it (6 request tables) and building in the Level 1 page style without a preview round. Negotiations, exchanges, feasibility and impact (PG-23 – PG-27) are still open – ask before starting them; the boundary rule of `AGENTS.md` §0 applies again to later tasks.
