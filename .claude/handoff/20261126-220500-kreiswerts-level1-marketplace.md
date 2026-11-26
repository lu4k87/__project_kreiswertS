[Claude] [KreiswertS] Build Level 1: offers, search, map, admin
übernommen von mk-dev-11 am 2026-11-26 22:03
Rückmeldung an: mk-dev-05
Context: Project ~/mk_dev/__project_kreiswertS (Next.js 16.4,
  Better Auth 1.7, Zod 4, Drizzle, PostgreSQL 17, Tailwind 4),
  branch feat/level1-marketplace = origin/main df1d7cf, nothing
  built yet. Today only 3 pages exist (start, login, register)
  plus /account, GET /api/offers, /api/health and a 5-table
  schema (src/server/db/schema.ts). Chat admin-5f started this
  task on 2026-11-26 21:43 and was cut off while reading.
  User request, verbatim (2026-11-26): "kreiswerts solle robust,
  sicher und frontend mit den CONTENT inhalten ... die neu in
  CONTENT liegen. -> die app auch frontend daraus bauen,
  basierend auf den figma vorlagen (startseite und loginseite
  usw (aktuelle 3 frontend seiten)). wenn was unklar ist,
  abstimmen mit mir. auch die db und das backend anpassen,
  sodass alles sauber und ohne fehler (prototyp clickable
  prototyp) funktioniert." Later: "architecture.html ... die
  seite auch aktuell halten" and "die dateien beruecksichtigen".
Sources (read all before designing):
  - CONTENT/KreiswertS_Backend_Functionality.xlsx: the spec.
    Sheets: Level 1 - Build now (L1-001..021), Page register
    (PG-01..28), Decision register (D01..D20), Material fields
    (plastics dictionary), Engineering safeguards, Test register
    (64 planned tests), Persona traceability, Level 2 - Future
    (do not build). No openpyxl here: read it with zipfile +
    xml.etree (shared strings + sheet XML).
  - CONTENT/KreiswertS_Page_Tree.pdf: page tree, sections per
    page, material catalogue, main navigation, user journeys.
  - CONTENT/KreiswertS_User_Scenarios.pdf: 4 walkthroughs with
    sites A, B, C; they are the acceptance test of the build.
  - 6 JPEG wireframes in CONTENT (grey, structure only):
    f369bed3 = create offer, one page, 4 sections;
    18.47.00 = create offer with accordion + live preview;
    18.46.59 = offer detail (HDPE regrind, delivery table,
    logistics responsibility grid, specs, contact button);
    (1) = both side by side; (2) = material categories tiles,
    Plastics "Initial scope"; (3) = data structure category →
    type → form → attribute definition → offer attribute value
    and the two Level 1 workflows.
  - Not readable: the 2 Google Docs in CONTENT/Google_Docs.txt
    (HTTP 401, login) and the Figma link. Look = existing pages.
Decisions of the user (2026-11-26, do not reopen):
  - F1 Verification: new sites are pending; a demo admin
    verifies them on the admin page (D03). Pending sites may
    edit profile and drafts only. Seed 3 verified demo sites.
  - F2 Map: own drawn map in the Figma look (reuse/extend
    src/components/home/material-map.tsx), sites and parks
    placed by real coordinates. No Leaflet, no tile server.
  - F3 Build in this folder. The user's dev server on port 3000
    (PID 91328, next dev) uses it and may show errors meanwhile;
    never stop it. Local DB kreiswerts is empty (0 rows in all
    tables): at the END push the new schema to it and seed the
    demo data, so the user clicks through on port 3000. All
    tests before that: own DB kreiswerts_e2e + own port.
  - F4 Evidence: metadata only (photo, datasheet, sample;
    self-declared, documented, tested, unknown) plus demo
    images; no file upload, no file storage (D09 fallback).
Derived from the sources (tell the user if you deviate):
  - Top navigation as in the page tree: Dashboard, Material
    offers, Map, Companies, My offers, My account; primary
    action Create offer. Public: Home, How it works, Regional
    map, About, Log in, Register company.
  - Create offer: sections as in the wireframes, live preview
    on the right on wide screens, separate preview step before
    publish, Save as draft.
  - Only Plastics enabled; other categories shown as "later";
    material model generic (no plastic-only columns, D04).
  - Level 2 (requests, matching, negotiation, exchanges, impact)
    is out of scope. The old agreements table is Level 2.
  - Password reset without a mail provider: single-use token,
    30 min, generic answer, link written to the server log.
  - Legal notice and privacy page: labelled placeholders only,
    no invented legal text, no real personal data (public repo).
Task: build Level 1 as a clickable prototype, in stages, each
  stage checked and pushed on the branch:
  1 docs/FEATURES.md first, then data model + rules: company →
    site → account, industrial park, material catalogue
    (category, type, form, attribute definitions, units), offer
    (quantity + unit, minimum lot, recurrence, expiry, price
    mode/payer/VAT basis, delivery options, attribute values,
    evidence, provenance, revision for stale-edit detection),
    enquiries, site verification, admin role (server-set only),
    lifecycle draft → active → closed/expired (30 days).
  2 The 4 scenarios end to end: dashboard, my offers, create /
    edit / preview / publish / close, search own park + wider
    radius with the same filters and straight-line distance,
    offer detail, contact supplier (PG-06..PG-10).
  3 Registration with company + site, password recovery,
    account settings, company directory, site profile, map
    (PG-04, 05, 11..14).
  4 Admin verification + reference data, public pages (about,
    regional map with public projection only, help/legal),
    synthetic demo cases A–E labelled as fictional
    (PG-02, 03, 15, 16, 28).
  5 Docs: FEATURES.md, FRONTEND.md §10, README; architecture
    page EN + DE (scripts/architecture/build.py + de.json, then
    python3 scripts/architecture/make.py; never edit the HTML),
    online at lu4k87.github.io/web_kreiswerts/ after the push.
  6 Final: schema + seed into local DB kreiswerts (F3), verify
    the 4 scenarios on port 3000, report the demo logins.
Files:
  - src/server/db/schema.ts, auth-schema.ts, auth.ts, viewer.ts
  - src/server/dal/, domain/, validation/ (5-station pattern,
    example src/app/api/offers/route.ts)
  - src/app/**, src/components/**, src/i18n/messages.ts
  - docs/FEATURES.md, docs/FRONTEND.md, README.md,
    scripts/architecture/
Notes:
  - Read AGENTS.md first: code/docs/commits in English, UI
    texts German + English (default German), Next.js 16 docs in
    node_modules/next/dist/docs/ before writing code, vitest
    stays on 4.x, login tests max 3 per 10 s.
  - The team boundary (frontend, data model) is lifted for this
    task at the user's request.
  - Uncommitted changes of the user: package-lock.json and
    CONTENT/Google_Docs.txt. Do not commit or discard them;
    commit only your own paths.
  - Checks: npm run check, npm run build, end to end against
    kreiswerts_e2e on an own port, stop own processes by PID.
    Auth, roles, access rules, public projection: check level 3
    with agent security-reviewer before the commit. UI: skills
    layout-guard (layout_audit.py) and web-interface-guidelines,
    details/ui.md; colours and type from src/app/globals.css.
  - Demo data only: fictional sites A, B, C; every synthetic
    listing keeps its label; unknown stays unknown (never 0).
  - Server-side rules everywhere: owner from the session,
    ownership check on every write, public data via its own
    projection, never by hiding fields in the browser.
  - Ask the user when something is unclear (the user's wish).
  - Finish: git rm this note in the commit of the finished work.
