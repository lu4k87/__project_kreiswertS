---
name: english-file-names
description: kreiswertS – nur englische Datei-, Ordner- und Routennamen (2026-11-25); Bestand umbenannt, alte URLs leiten weiter
metadata:
  type: feedback
---

In kreiswertS nur **englische Datei- und Ordnernamen** verwenden (User, 2026-11-25), z. B. `docs/architecture.html`, nicht `docs/architektur.html`. Ausnahme: Sprach-Suffix wie `README.de.md`.

**Why:** Frontend-Team und Doku arbeiten auf Englisch ([[frontend-english-app-bilingual]]); deutsche Namen mischen die Sprachen.

**How to apply:** neue Dateien/Ordner/Routen englisch benennen. Bestand am 2026-11-25 umbenannt: `docs/FUNKTIONEN.md` → `docs/FEATURES.md` (Inhalt bleibt deutsch), `/registrieren` → `/register`, `/konto` → `/account` (+ `sign-out-button.tsx`), `_test/test-hinweis.tsx` → `test-notice.tsx`, `CONTENT/Funktionen_KreiswertS.docx` → `Functions_KreiswertS_DE.docx`; alte URLs leitet `next.config.ts` (308) weiter.
