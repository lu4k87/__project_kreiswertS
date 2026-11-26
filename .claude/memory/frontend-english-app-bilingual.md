---
name: frontend-english-app-bilingual
description: kreiswertS – everything in the repo in English (2026-11-26); only the app UI (DE/EN switch) and the architecture page (EN + DE with switch) stay bilingual
metadata:
  type: feedback
---

User 2026-11-25: the frontend team gets docs, handoffs and code comments **in English only** (guide `docs/FRONTEND.md`). User 2026-11-26 extended this: **everything in English** – README (no `README.de.md` any more), `docs/FEATURES.md`, code comments, log and API messages, scripts, `AGENTS.md`, project memory.

Exceptions (user 2026-11-26, “in der App DE/EN-Funktion belassen”, “deutsche Versionen der Webseite für das Dev-Team als DE/EN-Schalter belassen”):
- The app stays bilingual **DE/EN with language switch** (default German): UI texts in `src/i18n/messages.ts`, Better Auth errors in `src/lib/auth-errors.ts`; switch via cookie `locale`, read with `getLocale()` (`src/i18n/locale.ts`).
- The dev-team architecture page keeps **EN + DE with switch**: `docs/architecture.html` + `docs/architecture.de.html`, German strings in `scripts/architecture/de.json`, rebuild with `python3 scripts/architecture/make.py`.

**Why:** the frontend/dev team works in English and the repository is public; the app's users are local businesses (German) plus English speakers.
**How to apply:** write every new file, comment, message and doc in English. New backend texts that appear in the UI come in both languages (or as a code the UI translates). See [[stack-decisions]], [[english-file-names]].
