[Claude] [KreiswertS] Level 2 part 2: negotiations and exchanges
übernommen von mk-dev-55 am 2026-11-27 09:29
Rückmeldung an: mk-dev-b1
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16, Better Auth,
  Zod, Drizzle, PostgreSQL), branch feat/level2-requests-matching,
  commit 2a65a6d. Level 1 and Level 2 part 1 are built and tested:
  requests, responses, explained matching (docs/FEATURES.md
  "Level 2, part 1"; e2e: scripts/e2e-level1.mjs 147 checks,
  scripts/e2e-level2.mjs 72 checks). The spec is in CONTENT/
  (KreiswertS_Backend_Functionality.xlsx sheets "Level 2 - Future",
  "Page register", "Decision register"; KreiswertS_Page_Tree.pdf p. 4).
  The user wants the next pages of the page tree built.
Aufgabe: Level 2 part 2 – negotiations (PG-23, PG-24, L2-006) and
  exchanges (PG-25, PG-26, L2-011): proposals with immutable revisions,
  counterproposal, accept/decline only by the counterpart, accepted
  proposal locks the terms (D16); exchange linked to the accepted
  revision with planned/completed/cancelled status, received quantity,
  quality acceptance; simulated records never count as verified
  outcomes (D13). Entry points from the match comparison page and from
  responses. Before building: agree the scope with the user in one
  dialog (which pages, whether the freight-adjusted comparison
  L2-007 and PG-27 belong to this step, and permission to extend
  src/server/db/schema.ts – AGENTS.md §0 team boundary).
Dateien:
  - src/server/db/schema.ts, src/server/domain/status.ts
    (cooperationFlow prepared for this step)
  - pattern to follow: src/server/dal/requests.ts,
    src/server/dal/matches.ts, src/app/api/my/requests/**,
    src/components/requests/**, src/i18n/level2.ts
  - docs/FEATURES.md, docs/FRONTEND.md §10, README.md
  - scripts/seed.mjs, scripts/seed/demo.mjs, scripts/e2e-level2.mjs
Beachten:
  - Chat mk-dev-82 works on the same branch (architecture page,
    scripts/architecture/**, docs/architecture*): pull first, commit
    only own paths (git commit -- <paths>)
  - Repo, code, docs in English; UI texts DE + EN
  - DoD (AGENTS.md §5): npm run check, npm run build, e2e against
    own DB kreiswerts_e2e on port 3100, layout_audit.py 1440/768/360
    (on this Mac via the wrapper in the Claude memory
    "layout-audit-on-this-mac"), security-reviewer before commit
  - The user's dev server may run on port 3000 – never touch it
  - Delete this handoff file in the commit of the finished work
