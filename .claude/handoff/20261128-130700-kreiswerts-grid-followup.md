[Claude] [KreiswertS] Browser checks into the repo + grid layouts for requests, matches, registration
Rückmeldung an: mk-dev-8e
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16,
  Tailwind 4, DE/EN), branch main, state 12d4364 or later.
  On 2026-11-28 the six grid layouts of the handoff
  kreiswerts-grid-layouts were built (commits a71fece header,
  d795b22 start page, 307412f dashboard, 486179e offer list,
  84f7769 offer detail, 12d4364 offer form, 1069bd1 header
  fix). docs/FRONTEND.md §9 describes the patterns: grid12 +
  stack (12 columns, rail of 4 on the right, `max-lg:contents`
  + `max-lg:order-*` for the narrow order), HeaderMenu,
  SearchFilters layout "bar", OfferCard layout "row", Facts
  layout "rail", the list of sections in offer-form.tsx.
  The user decided both parts below on 2026-11-28 (final, do
  not ask again).
Aufgabe:
  Part 1 – browser checks in the repository. Port the checks in
  .claude/handoff-files/kreiswerts-grid-followup/ (Python
  Playwright: test_header.py 39 checks, test_form.py 16 checks
  for the edit form and 16 for the new form, pw_common.py,
  measure.sh = login helper for layout_audit.py) to one Node
  script in scripts/ (playwright-core is a dev dependency since
  17781b7), guarded like scripts/e2e-level1.mjs: refuses port
  3000 and every database not ending in _e2e. Every check must
  first be seen red once (undo the fix locally, never commit
  that). They cover five bugs found while building:
  - menu panel of "Create" left the screen at 360 px
  - a class constant exported from a "use client" file reached
    a server component as a function, not as a string
  - the six German header entries were clipped at 1280 px
    (they need 1325 px → one row from 1344 px)
  - a section chosen in the form's list was scrolled to before
    it had opened
  - the live preview's figures left the card at 360 px
  Document the script in README.md / docs/FRONTEND.md §11.
  Part 2 – the same patterns for the areas that were left out:
  - requests list (/requests): filters as a bar, results as
    full-width rows with fixed columns
  - individual request (/requests/[id]): left 8 columns the
    sections, right 4 columns key facts, respond form, requester
  - request form (/my-requests/new, …/[id]/edit): list of
    sections (3) + fields (6) + what exists on the right (3)
  - matches (/matches, /matches/[requestId]/[offerId]) and
    registration (/register, /register/site): bring them onto
    the same 12-column grid; where no chosen pattern fits
    one-to-one, show a preview first (skill preview)
  One commit per area. New labels in DE + EN (src/i18n).
Dateien:
  - .claude/handoff-files/kreiswerts-grid-followup/ (delete it
    with the commit of part 1)
  - scripts/ (new check script), README.md, docs/FRONTEND.md
  - src/app/(platform)/requests/page.tsx, requests/[id]/page.tsx
  - src/components/requests/request-filters.tsx,
    request-card.tsx, request-detail-view.tsx, request-form.tsx
  - src/app/(platform)/matches/, src/components/matches/
  - src/app/register/page.tsx, register/site/page.tsx,
    src/components/auth/register-form.tsx
  - src/i18n/ (new labels)
Beachten:
  - skills layout-guard, web-interface-guidelines, text-format,
    commit; check level 2: npm run check, layout_audit.py for
    every changed page at 1440 / 768 / 360, light + dark, German
    and English, plus the new check script
  - never touch port 3000, the database kreiswerts or the
    repository's .next (the user's dev server uses it): build
    and start an own copy on another port against the seeded
    test database kreiswerts_layout_e2e
  - measure against `next build` + `next start`: `next dev` in
    a synced copy served stale modules twice (auto-memory note
    "KreiswertS UI checks on this Mac")
  - Better Auth allows 3 logins per 10 s → store the session
    per demo user, pause before a further login
  - no max-w-[68ch] on new texts (user, 2026-11-28, commit
    ad1dfb0: line length = column width)
  - the header row is full from 1344 px (1325 of 1328 px): a new
    main entry or action needs a new measurement
  - other chats work in this repository → ListAgents + git
    status before shared files, commit only your own paths
    (`git commit -- <paths>`); edits made by script are unknown
    to the file register, so check `git diff` per path first
  - request-card.tsx and the match components are used on
    several pages: a row layout belongs to the list only
