# KreiswertS

Platform prototype for circular plastic material exchange in Kamp-Lintfort: businesses list their plastic leftovers as offers, other businesses find and match them.

Proof of concept, not an operational marketplace. All company data in the prototype is demo data.

## Tech stack

| Layer | Building block |
|---|---|
| Language · framework · runtime | TypeScript · Next.js (App Router, pages + API in one project) · Node.js ≥ 20.9 |
| User interface | React · Tailwind CSS v4 (frontend team, entry point `src/app/globals.css`) |
| Backend & security | Better Auth (login, session cookie) · Zod (input validation) · Data Access Layer (who may see what) |
| Data | Drizzle ORM · PostgreSQL |

Every request passes through five stations on the server. The reference example is [`src/app/api/offers/route.ts`](src/app/api/offers/route.ts):

```text
Browser ──▶ 1 Next.js Route ──▶ 2 Better Auth ──▶ 3 Zod ──▶ 4 Data Access Layer ──▶ 5 Drizzle ──SQL──▶ PostgreSQL
            (entry point)       (guest/member?)   (valid?)   (what may they see?)    (safe query)
```

The browser never accesses the database directly.

## Run locally

Requirements: Node.js ≥ 20.9 ([`.nvmrc`](.nvmrc)) and PostgreSQL 17. Works the same on Linux, macOS and Windows; only step 1 differs.

```bash
# 1. Install and start PostgreSQL, create user/database (once per machine)
scripts/setup-postgres.sh       # Linux (apt, needs sudo) · macOS (Homebrew) → prints the DATABASE_URL line for .env
# Windows (PowerShell as administrator, winget):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1

# 2. Dependencies + environment
npm install
cp .env.example .env            # Windows: copy
chmod 600 .env                  # Linux/macOS: only your own user may read the file
# in .env: DATABASE_URL = the line from step 1 · BETTER_AUTH_SECRET = output of: openssl rand -base64 32
#          (without a secret of at least 32 characters the server answers every request with HTTP 500)

# 3. Create tables (from src/server/db/*.ts)
npm run db:push

# 4. Start
npm run dev                     # development → http://localhost:3000 (reachable from this computer only)
npm run build && npm start      # production-like; listens on all network interfaces (local only: npm start -- -H 127.0.0.1)
```

Check: <http://localhost:3000/api/health> responds with `{"ok":true,"db":"up"}`.

Set up before 2026-11-26? Then the database user still has the old default password, which is public in this repository. Change it once – `psql -d postgres -c '\password kreiswerts'` (Linux: `sudo -u postgres psql -c '\password kreiswerts'`) asks for the new one without showing or logging it – and put it into `DATABASE_URL` in `.env`.

Try the login: start page → “Create account” (`/register`) → “Log in” (`/login`) → `/account`. Start page, login and register page are built per Figma (DE/EN switch in the header, language stored in the `locale` cookie); `/account` is still a test page without design. Sign-up asks for company name, tax / VAT ID, material interest, username, work email and password (≥ 8 characters with a number and a capital letter); login works with username or email. Login only works via `http://localhost:3000` (Better Auth checks the origin against `BETTER_AUTH_URL`).

## Who works where

| Area | Folder | Team |
|---|---|---|
| User interface (pages, components, DE/EN texts) | `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/`, `src/i18n/` | Frontend (start page + login: backend, at MK's request, 2026-11-25) |
| API (route handlers) | `src/app/api/` | Backend |
| Login, validation, access rules | `src/server/` (`auth.ts`, `validation/`, `dal/`) | Backend |
| Data model | `src/server/db/schema.ts` | Database + backend |

- The frontend fetches data only via `src/app/api/*` or via functions from `src/server/dal/`, never directly from `src/server/db/`.
- Shared types: Zod schemas in `src/server/validation/` provide validation and the TypeScript type at once.
- **Frontend team:** guide (getting started, fetching data, login, guest/member, DE/EN, styling) → [`docs/FRONTEND.md`](docs/FRONTEND.md).
- **Architecture at a glance:** layers, feature progress, components, request path, API by feature, server functions, database, tools → [`docs/architecture.html`](docs/architecture.html) (German: [`docs/architecture.de.html`](docs/architecture.de.html), image: [`docs/architecture.png`](docs/architecture.png)); rebuild both after changes: `python3 scripts/architecture/make.py`.

## API (current state)

| Method + path | Purpose |
|---|---|
| `GET /api/health` | Server + database reachable? |
| `GET /api/offers?materialId=&city=&limit=` | Offers; guest: title, material, quantity, city · member: additionally price, description, contact |
| `POST /api/auth/sign-up/email` · `POST /api/auth/sign-in/email` · `POST /api/auth/sign-out` · `GET /api/auth/get-session` | Better Auth (sign up, log in, log out, session) |

Related pages: `/login` and `/register` (per Figma; the server checks sign-up fields in [`src/server/validation/registration.ts`](src/server/validation/registration.ts)) and the test page `/account` – Better Auth errors appear as a sentence in German or English ([`src/lib/auth-errors.ts`](src/lib/auth-errors.ts)). The start page figures (businesses, offers) come from `getPlatformStats()` in [`src/server/dal/stats.ts`](src/server/dal/stats.ts).

Further features (map + search, demand, cooperation, overview, impact …) are planned in [`docs/FEATURES.md`](docs/FEATURES.md); endpoints follow when a feature is up next.

## Database

- `src/server/db/schema.ts` implements the ER diagram from 2026-11-18 (sites, users, materials, offers, agreements).
- `src/server/db/auth-schema.ts` is generated by Better Auth (`npm run auth:schema`), do not edit by hand. For that run, remove the line `import "server-only";` from `src/server/auth.ts` and `src/server/db/client.ts` and put it back afterwards: the generator loads the configuration outside Next.js, where that import throws.
- Once the real database exists, `npm run db:pull` imports its state into the project; changes to the model go through the database owners.

| Command | Effect |
|---|---|
| `npm run db:push` | Write the schema directly to the local DB (development) |
| `npm run db:pull` | Read the schema from an existing DB |
| `npm run db:generate` · `npm run db:migrate` | Generate · run SQL migrations |
| `npm run db:studio` | Browse the database in the browser |

### Open (to clarify with the database owners)

- **Duplicate login:** Better Auth needs its own tables (`auth_users`, `auth_accounts` with password hash, `auth_sessions`). This replaces or changes the `users` table from the ER diagram.
- **Types:** PostgreSQL has no `DATETIME` (here `TIMESTAMP`). Prices as `FLOAT`/`INTEGER` → better `NUMERIC`. CO₂ factors as `INTEGER` → better `NUMERIC`.
- **1:1 site–login:** `users.site_id` is not unique in the diagram (`UNIQUE` missing).
- **Login before real data:** sign-up is open, every session immediately counts as a member and sees contact data; sign-up reveals whether an email already exists (422). Proposal: email confirmation + approval (`approved`) in `src/server/auth.ts`/`viewer.ts`.
- **Rate limit without a proxy:** Better Auth allows 3 login/sign-up requests per 10 s, in development and in production. The server trusts no address header (a browser can set `X-Forwarded-For` itself), so all visitors share one counter per path – anyone can block logins for everyone with 3 requests per 10 s (even a web page open in the same browser), all other login routes share 100 requests per 10 s, and the counter lives in the memory of one process. In production: run behind a reverse proxy, enter the header the proxy overwrites in `advanced.ipAddress.ipAddressHeaders` (`src/server/auth.ts`) and make the Next.js port reachable for the proxy only.
- **Status values:** allowed values for `offers.status`, `users.account_status`; `agreements.status` → proposal in [`docs/FEATURES.md`](docs/FEATURES.md#open-database-questions-for-the-database-owners) (also demand, notifications, history).

## Check before committing

```bash
npm run check    # TypeScript + tests (vitest)
npm run build    # production build
```
