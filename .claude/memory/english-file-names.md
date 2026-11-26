---
name: english-file-names
description: kreiswertS – English file, folder and route names only (2026-11-25); existing ones renamed, old URLs redirect
metadata:
  type: feedback
---

In kreiswertS use **English file and folder names only** (user, 2026-11-25), e.g. `docs/architecture.html`, not `docs/architektur.html`. Exception: language suffix such as `docs/architecture.de.html`.

**Why:** the frontend team and the docs work in English ([[frontend-english-app-bilingual]]); German names mix the languages.

**How to apply:** name new files/folders/routes in English. Renamed on 2026-11-25: `docs/FUNKTIONEN.md` → `docs/FEATURES.md` (content translated 2026-11-26), `/registrieren` → `/register`, `/konto` → `/account` (+ `sign-out-button.tsx`), `_test/test-hinweis.tsx` → `test-notice.tsx`, `CONTENT/Funktionen_KreiswertS.docx` → `Functions_KreiswertS_DE.docx`; `next.config.ts` redirects the old URLs (308).
