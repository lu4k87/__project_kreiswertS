[Claude] [KreiswertS] Apply the chosen grid layouts to six areas
übernommen von mk-dev-8e am 2026-11-28 11:53
Rückmeldung an: mk-dev-2f
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16,
  Tailwind 4, DE/EN), branch main, state bb0ca63. On 2026-11-28
  the user chose one layout per area in the preview
  "KreiswertS: Anordnung der Elemente im Raster". Every variant
  there is today's page with the same texts, rearranged on one
  12-column grid. Preview (before/after image of each variant,
  crops of each single change), in Git:
  ~/ai_dev_workflow_global/__treasury__allprojects/kreiswertS/
  vorschauen/2026-11-28-kreiswerts-anordnung-der-elemente-im-raster/
  Open it via the preview server (port 8086 or 8085), index.html.
  quelle/gen.py in that folder holds the exact JS + CSS of every
  variant (constants KOPF_B, START_B, DASH_A, LIST_B, DETAIL_A,
  FORM_A and the shared kit CSS) → use it as the layout spec.
  Chosen by the user (final, do not ask again):
  - Kopf:B   header in one row: logo, six menu items as text
    (no icons), right: bell, one button "Erstellen" with a menu
    (Angebot erstellen, Gesuch erstellen) and an account menu
    (Mein Konto, Sprache, Darstellung, Abmelden); "Mein Konto"
    leaves the menu row; header 68 px instead of 126 px
  - Start:B  centred hero with the button "Materialien
    entdecken", map as a full-width band, the three figures as
    large centred numbers, the three benefit points in three
    centred columns, green card as a full-width band, banner;
    content width 1120 px
  - Dash:A   left (8 columns) active offers + drafts; right
    (4 columns) card "Auf einen Blick" with the eight figures
    as rows (only values above zero highlighted), newest
    enquiries, card "Schnellzugriff" with the seven areas as
    rows (title + button, no description)
  - Liste:B  categories as one slim chip row; all filters as a
    bar above the results (search area in row 1, seven filters
    in row 2), "Diese Suche speichern" as one row below; offers
    as full-width rows with fixed columns (image, title, the
    three facts, details)
  - Detail:A left (8 columns) head + all material sections,
    short sections side by side; right (4 columns) card
    "Eckdaten", enquiry form, supplier
  - Form:A   left (3 columns) list of the seven sections with
    numbers, middle (6) the fields as today, right (3) preview
Aufgabe: Build these six layouts in the real components
  (Tailwind classes, one shared 12-column grid), responsive for
  1440 / 768 / 360 px, light + dark. New labels in DE + EN
  (src/i18n). The two header menus need keyboard and focus
  handling. One commit per area.
Dateien:
  - src/components/layout/platform-header.tsx, platform-nav.tsx
  - src/app/page.tsx
  - src/app/(platform)/dashboard/page.tsx
  - src/app/(platform)/offers/page.tsx
  - src/components/offers/search-filters.tsx, offer-card.tsx,
    category-tiles.tsx
  - src/components/offers/offer-detail-view.tsx
  - src/components/offers/offer-form.tsx, offer-live-preview.tsx
  - src/i18n/ (new labels)
Beachten:
  - Skills layout-guard, web-interface-guidelines, text-format,
    commit; check level 2: npm run check, npm run build,
    layout_audit.py for each changed page (Mac: see the memory
    note "layout_audit.py on this Mac")
  - never touch port 3000 or the database kreiswerts; a seeded
    test database kreiswerts_layout_e2e already exists
    (created 2026-11-28) → own instance on another port
  - other chats work in this repository (mk-dev-ce: static demo
    for github.io) → ListAgents + git status before shared
    files, commit only your own paths
  - Start:B shows the button "Materialien entdecken" twice (hero
    and green band); the user was told and may still say "once"
  - offer-card.tsx is also used on the dashboard and elsewhere:
    the row layout belongs to the offers list only
  - not part of this task: /register, requests, matches (same
    patterns later → ask the user at the end)
