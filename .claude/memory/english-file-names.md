---
name: english-file-names
description: kreiswertS – nur englische Datei- und Ordnernamen (neu ab 2026-11-25); deutsche Altnamen noch offen
metadata:
  type: feedback
---

In kreiswertS nur **englische Datei- und Ordnernamen** verwenden (User, 2026-11-25), z. B. `docs/architecture.html`, nicht `docs/architektur.html`. Ausnahme: Sprach-Suffix wie `README.de.md`.

**Why:** Frontend-Team und Doku arbeiten auf Englisch ([[frontend-englisch-app-zweisprachig]]); deutsche Namen mischen die Sprachen.

**How to apply:** neue Dateien/Ordner/Routen englisch benennen. Bestand mit deutschen Namen (Stand 2026-11-25): `docs/FUNKTIONEN.md`, `src/app/registrieren/`, `src/app/konto/` (+ `abmelden-button.tsx`), `src/app/_test/test-hinweis.tsx`, `CONTENT/Funktionen_KreiswertS.docx`, `.claude/memory/frontend-englisch-app-zweisprachig.md` – Umbenennen nur nach Rückfrage (Routen-URLs, Links, anderes Team).
