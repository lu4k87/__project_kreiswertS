# Project rules (kreiswertS)

Adds to the shared rules of all projects (`~/.claude/CLAUDE.md` → `~/ai_dev_workflow_global/rules/RULES.md`, same section numbers); in case of conflict this file applies, security (§0) always comes first. Created on 2026-11-19 with `~/ai_dev_workflow_global/bin/projects.py new`.

## 0. Security
- **Do not touch the user's working state:** running instance (`npm run dev`, port 3000), local DB `kreiswerts`, `.env` – test only with your own instance (different port, own DB, e.g. PGlite in the scratchpad).
- **Public repository:** demo data only, no real company or contact data without source and approval; secrets only in `.env`.
- **Team boundaries:** the frontend team builds the user interface (`src/app/**/page.tsx`, `src/components/`), the database owners are responsible for the data model → change those only at the user's request.
- Never commit credentials, `.env` or user data, never show them in answers or screenshots.

## 0c. Skill finder
- General skills: table in `RULES.md` §0c; this project's own skills in `.claude/skills/` → one line each here.

## 2. Language
- **Everything in English** (user, 2026-11-26): code, comments, log and API messages, README, docs, project memory, handoff notes, commit messages; file, folder and route names too.
- **Exceptions:** the app's UI texts stay German + English with the language switch (`src/i18n/`, `src/lib/auth-errors.ts`; default German), and the dev-team architecture page keeps its German version with the DE/EN switch (`docs/architecture.de.html`, generated from `scripts/architecture/de.json`).

## 4. Project map

| Place | Purpose |
|---|---|
| `AGENTS.md` | these rules (`GEMINI.md` = link to it) |
| `.claude/memory/` | project memory, index `MEMORY.md` (Claude loads it itself, Codex/Gemini read it at the start) |
| `README.md` | stack, run locally, demo logins, pages, API, database, known limits |
| `src/app/(platform)/` | pages of the company platform (dashboard, offers, map, companies, my offers, account, admin); `gate.tsx` decides who may open a page |
| `src/app/api/` | route handlers (backend), example of all 5 stations: `offers/route.ts`; every route runs inside `api()` from `src/server/http.ts` |
| `src/server/` | `auth.ts` (Better Auth) · `viewer.ts` (guest / member with site / administrator) · `access.ts` (access rules) · `http.ts` (route frame, errors) · `validation/` (Zod) · `dal/` (data access, allow-listed views) · `domain/` (value lists, status flows, offer rules – pure) · `db/` (Drizzle schema + client) |
| `scripts/seed.mjs` · `scripts/seed/` | reference data (material catalogue, units, parks) and fictional demo data: `npm run db:seed [-- --demo \| --reset-demo]`; demo passwords in `.env.demo` (ignored by Git) |
| `scripts/e2e-level1.mjs` | acceptance run: the four user scenarios + negative tests against an own test instance (refuses port 3000 and any database not ending in `_e2e`) |
| `docs/FEATURES.md` | what Level 1 does and why (roles, data model, rules, decisions, checks) and what Level 2 will add → add a new feature there first |
| `docs/FRONTEND.md` | guide for building pages (folders, fetching data, roles, DE/EN, styling, pages + endpoints) → for a new page or endpoint update the table in §10 there |
| `docs/architecture.html` · `.de.html` | architecture page for the dev team (EN + DE with switch), online at <https://lu4k87.github.io/web_kreiswerts/>; rebuild after changes: `python3 scripts/architecture/make.py` |
| `demo/` | static demo for GitHub Pages: the unchanged app in the visitor's browser (vinext build, PGlite, service worker); `npm run demo:db` · `demo:build` · `demo:serve` · `demo:test`, details and pitfalls in `demo/README.md`; the app's only switch is `src/lib/demo.ts` |
| `scripts/setup-postgres.sh` · `.ps1` | install PostgreSQL 17 + create user/DB: `.sh` Linux (apt, sudo) + macOS (Homebrew), `.ps1` Windows (winget) |

## 5. Way of working
- **Node:** ≥ 20.9 (`.nvmrc` 20; Node 24 works too). Linux machine with system Node v12: `export PATH=$HOME/.local/node-v20.20.2-linux-x64/bin:$PATH` · Mac: system Node, PostgreSQL via Homebrew (`brew services`).
- **Checks (Definition of Done):** `npm run check` (TypeScript + vitest) · `npm run build` · API/login/access changes additionally end-to-end against your own test DB (`DB_NAME=kreiswerts_e2e scripts/setup-postgres.sh`, then as in the header of `scripts/e2e-level1.mjs`: `drizzle-kit push --force`, `node scripts/seed.mjs --reset-demo`, `next start -p <own port>` with `BETTER_AUTH_URL` of that port, `node scripts/e2e-level1.mjs --base … --log …`) and stop the processes by PID afterwards. Every bug found becomes a check there or a unit test. Space out login tests: Better Auth allows 3 login/sign-up requests per 10 s (also under `next dev`), one shared counter per path for all clients; the window extends with every allowed request → pause 11 s after every 3 requests.
- **Source files without invisible characters:** write a no-break space as `\u00a0` inside a string, never as the character itself (`python3 scripts/escape-invisible.py [--check]`).
- **npm:** vitest stays on 4.x – vitest 5 breaks `npm install` with npm 10 (`edgesOut` error, peer of better-auth).
- **Commit + push:** directly in this repository (`git@github.com:lu4k87/__project_kreiswertS.git`), skill `commit`; list of all projects: `~/ai_dev_workflow_global/config/projects.yaml`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
