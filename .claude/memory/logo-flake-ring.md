---
name: logo-flake-ring
description: New logo chosen 2026-11-27 – ring of recycled plastic flakes; SVG files in public/brand/, not yet wired into headers/favicon
metadata:
  type: project
---

The user chose the flake-ring logo (preview round 2, variant Bild:C) on 2026-11-27: 13 irregular flakes in rust, ochre, green, petrol and brown form a ring; wordmark "kreiswerts" in Syne 800, lowercase.

Files in `public/brand/`: `kreiswerts-mark.svg` (from 32 px) and `kreiswerts-mark-small.svg` (7 large flakes, 16–32 px), each with a `-dark` variant, plus `favicon.svg` (follows `prefers-color-scheme`).

**Why:** the first, calmer round was "not creative enough"; the flakes show the material the platform starts with (plastics regranulate).

**How to apply:** wiring it in (both headers replace `LoopIcon` tile, Syne wordmark via `next/font`, `favicon.svg` as app icon) is still open – the user wants it done only after the parallel chats on headers/`layout.tsx` (dark theme, Level 2) have committed. Previews: `__treasury__allprojects/kreiswertS/vorschauen/2026-11-27-neues-logo-für-kreiswerts*`. Related: [[stack-decisions]]
