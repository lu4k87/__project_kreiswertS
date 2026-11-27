---
name: dev-team-page-always-current
description: Keep the dev-team architecture page current – local (docs/architecture*.html) AND online (lu4k87.github.io/web_kreiswerts) after every feature or API/data change; how to publish from the Mac
metadata:
  type: feedback
---

The user (2026-11-27): “also update the dev team information website (always keep it up to date!)”.

**Rule:** every change that touches features, endpoints, server functions, tables or status flows ends with
1. `scripts/architecture/build.py` + `de.json` updated, `python3 scripts/architecture/make.py`, `docs/architecture.png` renewed, layout measured, committed;
2. the online copy at <https://lu4k87.github.io/web_kreiswerts/> updated in the same task – not left for a later sync.

**Why:** the dev team reads the online page; a page that shows an older level misleads them.

**How to apply on this Mac:** the pre-push pages hook cannot publish here (expects `~/dev_ws` and `~/lu4k87.github.io`). Instead, in `~/mk_dev/lu4k87.github.io` (pull first): copy `docs/architecture.html`, `.de.html`, `.png` from `git show HEAD:` byte for byte into `web_kreiswerts/`; for `docs/FEATURES.md` and `FRONTEND.md` turn every Markdown link outside `docs/` into plain text and `.md` links inside `docs/` into `.html` (what `publish_pages.py` does – checked byte-equal against its output on 2026-11-27); commit only `web_kreiswerts/` and push. Do not run the full builder from the Mac: it would rebuild every other project page from the Mac checkouts. On the Linux machine the pre-push hook publishes by itself.
