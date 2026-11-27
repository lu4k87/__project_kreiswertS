[Claude] [KreiswertS] Architecture page: add Level 2 requests
Rückmeldung an: mk-dev-b1
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16, Better Auth,
  Zod, Drizzle, PostgreSQL), branch feat/level2-requests-matching,
  commit 9b717a1. Level 2 part 1 is built: material requests,
  responses, explained matching (pages /requests, /my-requests,
  /matches, 13 new API routes, 6 new tables). Described in
  docs/FEATURES.md "Level 2, part 1", README "API", FRONTEND.md §10.
  The architecture page for the dev team still shows Level 1 only.
Aufgabe: Bring the architecture page up to date with Level 2 part 1
  in EN and DE: layers/feature progress (L2-001 … L2-005 built,
  PG-23 … PG-27 open), API table (new endpoints), server functions
  (dal/requests.ts, dal/matches.ts, domain/matching.ts,
  domain/request-rules.ts), database (6 request tables), and a short
  explanation of the matching result (4 results, no score).
Dateien:
  - scripts/architecture/build.py (page content, hand-written)
  - scripts/architecture/de.json (German texts, key = English node)
  - scripts/architecture/make.py, translate.py (only run)
  - docs/architecture.html, docs/architecture.de.html,
    docs/architecture.png (result, commit them too)
Beachten:
  - Never edit the HTML by hand: build.py + de.json, then
    python3 scripts/architecture/make.py
  - Every new English text needs its German entry in de.json;
    translate.py build … -v lists what is missing
  - Only facts from the code/docs; Level 2 part 2 is "open"
  - Layout measurement EN + DE with layout_audit.py (skill
    layout-guard); on this Mac via the wrapper described in the
    Claude memory "layout-audit-on-this-mac"
  - Commit on branch feat/level2-requests-matching, push, delete this
    handoff file in the same commit
