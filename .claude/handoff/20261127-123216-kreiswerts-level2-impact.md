[Claude] [KreiswertS] Level 2 rest: feasibility, environment, /impact
übernommen von mk-dev-b1 am 2026-11-27 12:33
Rückmeldung an: mk-dev-ec
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16, Better Auth,
  Zod, Drizzle, PostgreSQL), branch feat/level2-requests-matching,
  commit 2028df4. Level 1 and Level 2 parts 1 + 2 are built and tested
  (requests, matching, negotiations, exchanges – docs/FEATURES.md).
  The user wants the rest of Level 2 built (2026-11-27). Spec in
  CONTENT/KreiswertS_Backend_Functionality.xlsx (sheets "Level 2 -
  Future", "Page register", "Decision register", tests AT/NT-L2-…;
  no openpyxl on this Mac → unzip and read the XML, prefix "x:").
  Decided by the user on 2026-11-27: build directly in the style of
  the existing pages without a preview round; emission factors for
  L2-008 as demo factors, every one clearly labelled "example value,
  not sourced" (like the fictional demo companies); the data model
  may be extended in this repository (AGENTS.md §0 team boundary).
Aufgabe: build L2-007 economic feasibility (delivered cost for the
  requester, net proceeds for the offerer, freight sharing, private
  baseline, cost status estimated/quoted/confirmed, break-even only
  for a positive contribution, D17) on the match comparison (PG-22)
  and the negotiation (PG-24); L2-008 comparative environmental
  assessment (factor table with unit, version, geography, boundary;
  transport-only separate from lifecycle; no CO2e claim without
  baseline or factor, D18) on PG-22; PG-27 company circularity
  overview /impact (private or approved outcome indicators from
  L2-008 and completed exchanges L2-011; simulated never counts as
  realised, D13). One acceptance + one negative test per requirement
  (AT/NT-L2-007, AT/NT-L2-008) in scripts/e2e-level2.mjs, pure
  calculations as unit tests.
Dateien:
  - src/server/db/schema.ts, src/server/domain/ (new pure modules),
    src/server/dal/, src/server/validation/, src/app/api/my/**
  - pattern to follow: src/server/dal/negotiations.ts,
    src/components/negotiations/**, src/components/matches/**,
    src/i18n/level2.ts
  - docs/FEATURES.md ("Level 2, rest"), docs/FRONTEND.md §10,
    README.md, docs/architecture* (python3 scripts/architecture/make.py,
    then the online copy, see memory dev-team-page-always-current)
  - scripts/seed/demo.mjs, scripts/e2e-level2.mjs
Beachten:
  - Chat mk-dev-ec works on the same branch and working tree at the
    same time: interactive MapLibre map (/map, /regional-map, start
    page), requests on the map and volume aggregation L2-010
    (src/components/map/**, src/components/home/material-map.tsx,
    src/app/(platform)/map/**, src/app/regional-map/**,
    src/server/dal/map.ts, new src/server/domain/aggregation.ts).
    Do not touch those. Shared files (docs/FEATURES.md, README.md,
    docs/FRONTEND.md, src/i18n/*, scripts/seed/demo.mjs, package.json,
    docs/architecture*): small edits, pull first, commit only own
    paths (git commit -- <paths>), tell mk-dev-ec via SendMessage
  - npm run check may briefly fail from the other chat's work in
    progress → check whose file it is before fixing anything
  - Repo, code, docs in English; UI texts DE + EN
  - DoD (AGENTS.md §5): npm run check, npm run build, e2e against own
    DB kreiswerts_impact_e2e on port 3200 (mk-dev-ec uses
    kreiswerts_e2e on 3100), layout_audit.py 1440/768/360 (on this
    Mac via the wrapper in the Claude memory "layout-audit-on-this-mac"),
    security-reviewer before commit
  - The user's dev server may run on port 3000 – never touch it
  - Delete this handoff file in the commit of the finished work
