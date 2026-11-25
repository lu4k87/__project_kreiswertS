---
name: frontend-englisch-app-zweisprachig
description: Alles für das Frontend-Team nur auf Englisch; die App selbst wird später DE/EN mit Sprachschalter
metadata:
  type: project
---

User 2026-11-25: Das Frontend-Team bekommt Doku, Übergaben und Code-Kommentare **nur auf Englisch** (Leitfaden `docs/FRONTEND.md`). Die App wird später zweisprachig **DE/EN mit Sprachschalter** (Standard Deutsch); UI-Texte gehören deshalb von Anfang an in `src/i18n/messages.ts` statt fest in Komponenten.

**Why:** Frontend-Team arbeitet auf Englisch; Zielgruppe der App sind lokale Betriebe (Deutsch) plus Englisch.
**How to apply:** Texte für das Frontend-Team englisch schreiben, Backend-/README-Doku bleibt deutsch. Neue Backend-Texte, die in der UI erscheinen (z. B. `authErrorText()`), zweisprachig oder als Code liefern; Speicherort des Sprachschalters (Cookie oder URL) ist noch offen. Siehe [[stack-entscheidungen]].
