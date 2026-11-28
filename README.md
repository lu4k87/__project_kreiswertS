# KreiswertS

Platform prototype for circular material exchange between businesses in and around Kamp-Lintfort: a verified company site publishes material it no longer needs, other sites find it in their own industrial park or in a wider radius, read the details and contact the supplier.

**Level 1 is a clickable prototype of an offers-first marketplace**, starting with plastics. It is a proof of concept, not an operational marketplace: all companies, sites and listings in it are fictional demo data, and no payment, contract or logistics booking takes place.

What is built and why: [`docs/FEATURES.md`](docs/FEATURES.md) · architecture at a glance: [`docs/architecture.html`](docs/architecture.html).

## Tech stack

| Layer | Building block |
|---|---|
| Language · framework · runtime | TypeScript · Next.js 16 (App Router, pages + API in one project) · Node.js ≥ 20.9 |
| User interface | React 19 · Tailwind CSS v4 (tokens in `src/app/globals.css`) · German and English · MapLibre GL JS with OpenFreeMap tiles (interactive maps) |
| Backend & security | Better Auth (login, session cookie) · Zod (input validation) · Data Access Layer (who may do and see what) |
| Data | Drizzle ORM · PostgreSQL 17 |

Every request passes through five stations on the server. The reference example is [`src/app/api/offers/route.ts`](src/app/api/offers/route.ts):

```text
Browser ──▶ 1 Next.js Route ──▶ 2 Better Auth ──▶ 3 Zod ──▶ 4 Data Access Layer ──▶ 5 Drizzle ──SQL──▶ PostgreSQL
            (entry point)       (who is asking?)  (valid?)   (may they? what may they see?) (safe query)
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

# 3. Create tables (from src/server/db/*.ts) and fill them
npm run db:push                 # after a change of the data model: answer the questions, or add -- --force on an empty database
npm run db:seed -- --demo       # reference data (material catalogue, units, industrial parks) + fictional demo data
#                                 without --demo: reference data only · --reset-demo: remove the demo data and seed it again

# 4. Start
npm run dev                     # development → http://localhost:3000 (reachable from this computer only)
npm run build && npm start      # production-like; reachable from this computer only (other devices: put a reverse proxy with TLS in front)
```

Check: <http://localhost:3000/api/health> responds with `{"ok":true,"db":"up"}`. Always open `http://localhost:3000`, not `127.0.0.1`: login checks the origin against `BETTER_AUTH_URL`.

Set up before 2026-11-26? Then the database user still has the old default password, which is public in this repository. Change it once – `psql -d postgres -c '\password kreiswerts'` (Linux: `sudo -u postgres psql -c '\password kreiswerts'`) asks for the new one without showing or logging it – and put it into `DATABASE_URL` in `.env`.

### Static demo

Online: <https://lu4k87.github.io/web_kreiswerts/app/>. `npm run demo:db && npm run demo:build` builds a version of the app that needs no server: the app's own server code and PostgreSQL (PGlite) run inside the visitor's browser, with a private copy of the fictional demo data, demo logins only and registration switched off. It is made for a static host such as GitHub Pages; how it works, its limits and the test are described in [`demo/README.md`](demo/README.md).

### Demo logins

`npm run db:seed -- --demo` creates eleven fictional companies with twelve sites and one administrator. The first five sites carry the user scenarios:

| Login | Role | Use it to |
|---|---|---|
| `site_a` | Werk A, manufacturer (verified) | publish a batch for collection, close it later (scenario 1) |
| `site_b` | Standort B, recycler (verified) | search its park, widen the search, contact Site A; offer regrind (scenarios 2 and 3) |
| `site_c` | Werk C, manufacturer (verified) | assess a recurring supply and ask for a sample (scenario 4) |
| `site_d` | Werk D, second branch of Site A's company (verified) | see that branches are separate sites with their own offers |
| `site_e` | Standort E (pending) | see what a site may do before verification |
| `site_f` … `site_l` | Lager F, Werk G, Bauhof H, Compoundierwerk I, Standort J, Werk K, Sortieranlage L (verified) | further sources, takers and processors around the cases A–E: logistics, construction, compounding, packaging, sorting; Sortieranlage L lies outside every park |
| `admin` | administrator | verify or decline sites, switch a material category on or off |

Passwords: the sites share `DEMO_PASSWORD`, the administrator has its own `DEMO_ADMIN_PASSWORD` (each at least 12 characters with a digit and a capital letter). Put both into a file `.env.demo` next to `.env` – it is ignored by Git – to keep them across re-seeds; without them the seed generates random ones and prints them once. The four walkthroughs are described in `CONTENT/KreiswertS_User_Scenarios.pdf`.

A new account registers in two steps (`/register`, then `/register/site`) and stays pending until `admin` verifies it under “Prüfung / Verification”. Password recovery works without a mail provider: the reset link is written to the server log.

## Who works where

| Area | Folder |
|---|---|
| Pages of the company platform (dashboard, offers, map, companies, account, administration) | `src/app/(platform)/` |
| Public pages, login, registration | `src/app/page.tsx`, `src/app/about/`, `regional-map/`, `help/`, `login/`, `register/`, `forgot-password/`, `reset-password/` |
| Components, DE/EN texts | `src/components/`, `src/i18n/` |
| API (route handlers) | `src/app/api/` |
| Login, access rules, validation, business rules | `src/server/` (`auth.ts`, `access.ts`, `http.ts`, `validation/`, `dal/`, `domain/`) |
| Data model | `src/server/db/schema.ts` |
| Reference data and demo data | `scripts/seed.mjs`, `scripts/seed/` |
| Region data as CSV (import/export) | `scripts/data-csv.mjs`, `scripts/data/` – guide: [`docs/REPLICATION.md`](docs/REPLICATION.md) |

- Pages and components fetch data only via functions from `src/server/dal/` (server components) or via `/api/*` (client components), never directly from `src/server/db/`.
- Shared types: Zod schemas in `src/server/validation/` provide validation and the TypeScript type at once; the offer form in the browser checks with the same schemas and rules as the server.
- Guide for building on it (fetching data, roles, DE/EN, styling, pages and endpoints) → [`docs/FRONTEND.md`](docs/FRONTEND.md).
- Architecture at a glance: layers, feature progress, components, request path, API, server functions, database, tools → [`docs/architecture.html`](docs/architecture.html) (German: [`docs/architecture.de.html`](docs/architecture.de.html), image: [`docs/architecture.png`](docs/architecture.png)); rebuild both after changes: `python3 scripts/architecture/make.py`.

## Pages

| Area | Pages |
|---|---|
| Public | `/` · `/about` · `/regional-map` · `/help` · `/guide` · `/login` · `/register` → `/register/site` · `/forgot-password` → `/reset-password` |
| Company platform | `/dashboard` · `/offers` · `/offers/[id]` · `/map` · `/companies` · `/sites/[id]` · `/my-offers` · `/my-offers/new` · `/my-offers/[id]/edit` · `/my-offers/[id]/preview` · `/notifications` · `/account` |
| Company platform, Level 2 | `/requests` · `/requests/[id]` · `/my-requests` · `/my-requests/new` · `/my-requests/[id]/edit` · `/matches` · `/matches/[requestId]/[offerId]` · `/negotiations` · `/negotiations/new` · `/negotiations/[id]` · `/exchanges` · `/exchanges/[id]` · `/contracts/[id]` · `/impact` |
| Administration | `/admin/verification` · `/admin/reference-data` |

## API

Same address as the app, JSON in and out, the session cookie is sent automatically. Errors have one shape: `{ "error": "<CODE>", "requestId": "…", "fields"?: [{ "field", "code" }] }` with HTTP 400 (invalid), 401 (not logged in), 403 (not allowed, e.g. `NOT_VERIFIED`), 404, 409 (conflict, e.g. `STALE`), 422 (a rule is broken), 503 (database down). Writes need the app's own `Origin` and a JSON body.

| Method + path | Who | Purpose |
|---|---|---|
| `GET /api/health` | everyone | Server + database reachable? |
| `GET /api/catalogue` | everyone | Material categories, types, forms, units, attribute definitions, industrial parks |
| `GET /api/public/map` | everyone | Public projection: park areas, publicly named sites, categories of the region, simulated pathways |
| `POST /api/auth/sign-up/email` · `sign-in/email` · `sign-in/username` · `sign-out` · `request-password-reset` · `reset-password` · `change-password` · `GET get-session` | see Better Auth | Accounts and sessions |
| `POST /api/registration/site` | account without a site | Second step of the registration: company + physical site (starts as pending) |
| `GET · PUT /api/my/site` | own site | Own profile with address and verification status · change contact, capabilities, visibility |
| `GET · POST /api/my/offers` | own site | Own offers in every status · save a new draft |
| `GET · PUT · DELETE /api/my/offers/[id]` | owner | Edit form data · change (with `expectedRevision`) · delete a draft |
| `POST /api/my/offers/[id]/publish` · `/renew` · `/close` | owner (publish, renew: verified site) | Lifecycle of an offer |
| `GET /api/my/enquiries` · `POST /api/my/enquiries/[id]/response` | own site | Received and sent enquiries · answer once |
| `GET /api/offers?scope=park\|radius&radiusKm=&typeId=&formId=&origin=&frequency=&delivery=&minQuantityKg=&sort=` | verified site · administrator | Search in the own park or a radius with the same filters, with straight-line distance · `sort=deadline` earliest collection deadline first, each card with `urgent` (deadline within 7 days) |
| `GET /api/offers/[id]` · `POST /api/offers/[id]/enquiries` | verified site (detail: also the owner) | One offer · contact the supplier |
| `GET · POST /api/my/saved-searches` · `DELETE /api/my/saved-searches/[id]` | own site (saving: verified site) | Saved searches of the site: `{ name, query }` with the query string of `/offers` · at most 20 (422 `TOO_MANY`) · deleting removes its notices |
| `GET /api/my/notifications` · `POST /api/my/notifications/read` (`{ ids? }`) | own site | Notices of new matching offers (`{ unread, items }`, newest 50) · mark the given or all as read |
| `GET /api/sites` · `GET /api/sites/[id]` | verified site · administrator | Company directory · site profile with its active offers |
| `GET /api/map` | verified site · administrator | Parks, sites, the offers of the same search as `/api/offers`, the open requests of the same area and the potential collection groups (L2-010) |
| `GET /api/admin/sites` · `POST /api/admin/sites/[id]/verification` · `POST /api/admin/categories/[id]` | administrator | Sites by status · verify, decline, reset · switch a category |
| `GET · POST /api/my/requests` | own site | Own material requests in every status · save a new draft |
| `GET · PUT · DELETE /api/my/requests/[id]` | owner | Edit form data · change (with `expectedRevision`) · delete a draft |
| `POST /api/my/requests/[id]/publish` · `/renew` · `/close` (`{ reason: "fulfilled" \| "withdrawn" }`) | owner (publish, renew: verified site) | Lifecycle of a request |
| `GET /api/requests?scope=park\|radius&radiusKm=&typeId=&formId=&frequency=&sort=` | verified site · administrator | Open requests of other sites, own park first, wider area with the same filters |
| `GET /api/requests/[id]` | verified site · administrator (also the owner) | One request |
| `GET · POST /api/requests/[id]/responses` | verified site | Responses the viewer may read (owner: all, responder: own) · respond once, optionally with an own active offer |
| `GET /api/my/responses` · `POST /api/my/responses/[id]/reply` | own site | Received and sent responses · the requester replies once |
| `GET /api/matches` · `GET /api/matches/[requestId]/[offerId]` | verified site (owner of one side) | Candidate pairs of the own active listings · one comparison criterion by criterion |
| `GET /api/my/negotiations` · `POST /api/my/negotiations` | own site · verified site | Incoming and outgoing negotiations · first proposal for an open offer (optionally for a request); the parties come from the server |
| `GET /api/my/negotiations/[id]` · `POST …/revisions` · `…/accept` · `…/decline` · `…/withdraw` | the two sites (verified to write) | One negotiation with every revision · counterproposal · accept, decline or withdraw the current revision (`expectedRevision`, 409 when outdated or expired) |
| `POST /api/my/negotiations/[id]/exchange` | the two sites, verified | Plan the exchange of an agreed negotiation (409 `NOT_AGREED` otherwise) |
| `GET /api/my/exchanges` · `GET` / `PUT /api/my/exchanges/[id]` · `POST …/complete` · `…/cancel` | the two sites (verified to write) | Exchanges with counts kept apart for simulated records · move the date · receipt and quality check (receiving site only) · cancel with a reason |
| `PUT /api/my/assessments` | verified site, one side of the match or negotiation | Save the own private feasibility (L2-007) or environmental assessment (L2-008) with the revision shown; answers with the calculated result · 409 `STALE` · 422 `FREIGHT_ALREADY_INCLUDED`, `FACTOR_MISMATCH`, `UNIT_NOT_MASS` |
| `POST /api/my/assessments/[id]/approve` | owning site | Release a comparative environmental result for the own circularity overview · 422 `INCOMPLETE` |
| `POST /api/my/negotiations/[id]/contract` · `GET /api/my/contracts/[id]` · `POST …/sign` · `…/void` | the two sites (verified to write) | Contract from the accepted revision (snapshot + SHA-256) · sign with the shown fingerprint · void while a signature is missing |
| `GET` / `POST /api/my/exchanges/[id]/payments` · `POST /api/my/payments/[id]/checkout` · `…/capture` · `…/cancel` · `…/refund` | the two sites (verified to write) | **Simulated** payment under the signed contract: amount from the terms, idempotency keys, simulated checkout, capture after delivery, refund by the payee |
| `POST /api/payments/webhook` | payment provider (HMAC signature, no session) | Signed provider confirmation (authorised / failed); unsigned, outdated or replayed confirmations change nothing |
| `GET` / `POST /api/my/negotiations/[id]/chain-consent` | the two sites (verified to write) | Release or withdraw the own commercial comparison; combined chain benefit once both released |
| `GET /api/my/impact` | own site | Circularity overview (PG-27): exchanges with realised apart from simulated, released assessments, combined chain benefits, demo records summed apart |
| `GET /api/impact-factors` | everyone | Emission factors with unit, version, geography, boundary, source; four sourced factors (UBA, IPCC, Plastics Europe) with the document link, the rest example values |

## Database

- `src/server/db/schema.ts` holds the 16 platform tables of Level 1 – companies, sites, industrial parks, the material catalogue (categories, types, forms, units, attribute definitions), offers with delivery options, attribute values and history, enquiries, the verification audit trail and the demo cases – the 6 tables of the Level 2 requests: `requests`, `request_types`, `request_forms`, `request_criteria`, `request_revisions`, `request_responses`, the 4 tables of negotiations and exchanges: `negotiations`, `proposal_revisions`, `exchanges`, `exchange_events`, the 5 tables of contracts, simulated payments and consent: `contracts`, `contract_events`, `payments`, `payment_events`, `chain_consents`, and the 2 tables of saved searches: `saved_searches`, `notifications`. Matches are computed, not stored. Overview and rules: [`docs/FEATURES.md`](docs/FEATURES.md#data-model).
- `src/server/db/auth-schema.ts` holds the login tables of Better Auth (`auth_users` with `role` and `site_id`, sessions, accounts, verification tokens). After a change of the additional fields in `src/server/auth.ts`, keep this file in step (`npm run auth:schema` regenerates it; for that run remove the line `import "server-only";` from `src/server/auth.ts` and `src/server/db/client.ts` and put it back afterwards).
- The material catalogue is data, not code: a new category, attribute or industrial park is added in `scripts/seed/reference.mjs` and written with `npm run db:seed`.
- Parks, catalogue, companies and sites also travel as CSV files (Excel, LibreOffice): `npm run data:export` writes them to `data-export/` (ignored by Git – `sites.csv` holds contact data), `npm run data:import` checks every row and saves all or nothing. Setting up another region: [`docs/REPLICATION.md`](docs/REPLICATION.md).

| Command | Effect |
|---|---|
| `npm run db:push` | Write the schema directly to the local DB (development) |
| `npm run db:seed` | Reference data · `-- --demo` adds the demo data · `-- --reset-demo` replaces it |
| `npm run data:export` · `npm run data:import` | Region data as CSV · `-- --dry-run` checks only · `-- --prune-parks` removes parks missing from `parks.csv` that no site uses |
| `npm run db:pull` | Read the schema from an existing DB |
| `npm run db:generate` · `npm run db:migrate` | Generate · run SQL migrations |
| `npm run db:studio` | Browse the database in the browser |

## Known limits of the prototype

- **Password recovery without mail:** the reset link is written to the server log. Connect a mail provider in `sendResetPassword` (`src/server/auth.ts`) before real use – the token must then never be logged.
- **Sign-up reveals taken names:** it answers differently for a username or e-mail that already exists. Closing this needs e-mail confirmation.
- **Rate limit without a proxy:** Better Auth allows 3 login/sign-up requests per 10 s and 3 password reset requests per 60 s. The server trusts no address header (a browser can set `X-Forwarded-For` itself), so all visitors share one counter per path – anyone can block logins for everyone, and the counter lives in the memory of one process. In production: run behind a reverse proxy, enter the header the proxy overwrites in `advanced.ipAddress.ipAddressHeaders` (`src/server/auth.ts`) and make the Next.js port reachable for the proxy only.
- **No file upload:** evidence (datasheet, photographs, sample) is metadata; listing pictures are example photos of the material form (free licences, credits on the About page), never a photo of the batch.
- **Positions:** industrial parks are approximate centres from public descriptions, not surveyed boundaries. A newly registered site has no coordinates until the administrator enters them at verification; distances are straight lines.
- **Legal notice, privacy policy and terms of use** are labelled placeholders; the project team supplies the texts.
- **Level 2 built:** material requests, responses, explained matching, negotiations and exchanges, requests on the map and volume aggregation, economic feasibility (L2-007), the environmental assessment (L2-008) and the circularity overview (PG-27). Contracts with both signatures (a platform confirmation, not a qualified electronic signature), a **simulated** payment per exchange (no money moves; built like a real provider integration with signed confirmations and idempotency keys) and the combined chain benefit once both sites released their comparison. Four emission factors are sourced (UBA, IPCC, Plastics Europe); the rest stay example values, and any result that uses one is an illustration, not a CO₂e claim.
- **Matching runs in the application** for up to 1,000 candidate listings per own listing; beyond that it has to move into SQL.

## Check before committing

```bash
npm run check    # TypeScript + unit tests (vitest)
npm run build    # production build
```

Changes to login, access rules or the API additionally run the acceptance script against an own test instance and the database `kreiswerts_e2e` – never against the working database; the script refuses any other target. How to start the test instance is in the header of [`scripts/e2e-level1.mjs`](scripts/e2e-level1.mjs).

Changes to pages run the browser checks against the same kind of test instance: [`scripts/e2e-ui.mjs`](scripts/e2e-ui.mjs) opens the header menus, the forms with their list of sections and the 12-column pages in the installed Google Chrome (`playwright-core`) at 1440, 1344, 1100 and 360 px. It refuses port 3000 and every database not ending in `_e2e`; `--only header,offer-form` runs single groups.
