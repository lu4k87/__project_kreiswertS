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
| `README.md` | stack, run locally, who works where, API, open database points |
| `src/app/api/` | route handlers (backend), example of all 5 stations: `offers/route.ts` |
| `src/server/` | `auth.ts` (Better Auth) · `viewer.ts` (guest/member) · `validation/` (Zod) · `dal/` (access rules) · `domain/` (status flows) · `db/` (Drizzle schema + client) |
| `docs/FEATURES.md` | plan of all features (data model, endpoints, status, open database questions) → add a new feature there first |
| `docs/FRONTEND.md` | guide for the frontend team (folders, fetching data, login, roles, DE/EN, styling, missing endpoints) → for a new endpoint update the table in §10 there |
| `docs/architecture.html` · `.de.html` | architecture page for the dev team (EN + DE with switch), online at <https://lu4k87.github.io/web_kreiswerts/>; rebuild after changes: `python3 scripts/architecture/make.py` |
| `scripts/setup-postgres.sh` · `.ps1` | install PostgreSQL 17 + create user/DB: `.sh` Linux (apt, sudo) + macOS (Homebrew), `.ps1` Windows (winget) |

## 5. Way of working
- **Node:** ≥ 20.9 (`.nvmrc` 20; Node 24 works too). Linux machine with system Node v12: `export PATH=$HOME/.local/node-v20.20.2-linux-x64/bin:$PATH` · Mac: system Node, PostgreSQL via Homebrew (`brew services`).
- **Checks (Definition of Done):** `npm run check` (TypeScript + vitest) · `npm run build` · API/login changes additionally end-to-end against your own test DB (`DB_NAME=kreiswerts_e2e scripts/setup-postgres.sh`, `DATABASE_URL=… npx drizzle-kit push --force`, `next start -p <own port>` with `BETTER_AUTH_URL` of that port, curl/Playwright) and stop the processes by PID afterwards. Space out login tests: Better Auth allows 3 login/sign-up requests per 10 s (also under `next dev`), one shared counter per path for all clients; the window extends with every allowed request → pause 11 s after every 3 requests.
- **npm:** vitest stays on 4.x – vitest 5 breaks `npm install` with npm 10 (`edgesOut` error, peer of better-auth).
- **Commit + push:** directly in this repository (`git@github.com:lu4k87/__project_kreiswertS.git`), skill `commit`; list of all projects: `~/ai_dev_workflow_global/config/projects.yaml`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
