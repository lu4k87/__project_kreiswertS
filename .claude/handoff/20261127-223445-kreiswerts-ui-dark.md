[Claude] [KreiswertS] Dark theme and UI polish
übernommen von mk-dev-0c am 2026-11-27 22:36
Rückmeldung an: mk-dev-bb

Context: Repo ~/mk_dev/__project_kreiswertS (branch main, commit 262ece0). That commit made the page white, the map colourful and interactive (<LiveMap interactive> on /map and /regional-map: layer toggles, show all, park hover, markers rise in, ping, flowing pathways), section icons 48 px and a prose-justify utility. The app has only a light theme (color-scheme: light in src/app/globals.css). User decision 2026-11-27: build the rest.

Task:
1. Dark theme: a dark token set in src/app/globals.css (prefers-color-scheme + a switch next to the language switch, stored in a cookie like the locale); check every token use (bg-canvas insets, map colour tokens, markers, popups, auth cards); map style in dark: check whether OpenFreeMap offers a dark style, otherwise keep liberty.
2. Polish found by layout_audit on 2026-11-27: start page H2 too small (heading-small: 18 px = 1.2× body, src/app/page.tsx); on /map marker 1 sits under marker 2 at Grafschafter Gewerbepark Genend (sameSpotOffsets only spreads identical rounded positions – also spread markers closer than about 34 px on screen, with a test in geo.test.ts); invisible character in src/components/negotiations/terms-view.tsx (python3 scripts/escape-invisible.py --check).

Files: src/app/globals.css, src/app/layout.tsx, src/components/layout/*, src/components/map/live-map.tsx, geo.ts, geo.test.ts, marker-style.ts, src/app/page.tsx, src/components/negotiations/terms-view.tsx, docs/FRONTEND.md §9.

Beachten: show a preview of the dark palette first (skill preview, port 8085); layout_audit on this Mac needs the workaround in the Claude auto memory "layout-audit-on-this-mac" plus a Chrome shim with --use-angle=swiftshader --enable-unsafe-swiftshader for the WebGL map (full-page shots can miss markers – confirm with a CDP probe); measure light + dark. The parallel chat kreiswerts-level2-rest builds new pages – coordinate shared files.
