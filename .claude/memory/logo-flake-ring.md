---
name: logo-flake-ring
description: New logo chosen 2026-11-27 – ring of recycled plastic flakes; wired in 2026-11-28 (BrandMark/BrandLogo, Syne wordmark, app icon)
metadata:
  type: project
---

The user chose the flake-ring logo (preview round 2, variant Bild:C) on 2026-11-27: 13 irregular flakes in rust, ochre, green, petrol and brown form a ring; wordmark "kreiswerts" in Syne 800, lowercase.

Files in `public/brand/`: `kreiswerts-mark.svg` (from 32 px) and `kreiswerts-mark-small.svg` (7 large flakes, 16–32 px), each with a `-dark` variant, plus `favicon.svg` (follows `prefers-color-scheme`).

**Why:** the first, calmer round was "not creative enough"; the flakes show the material the platform starts with (plastics regranulate).

**How to apply:** wired in on 2026-11-28 (mk-dev-f9): `src/components/ui/brand-mark.tsx` – `BrandMark` draws the 13 flakes inline with `light-dark()` fills (follows the theme switch, `tone="onBrand"` = dark colours on the green brand card), `BrandLogo` = mark + wordmark (Syne 800 via `next/font`, `--font-display`) in both headers; `src/app/icon.svg` = `public/brand/favicon.svg`. The wider wordmark is why the public nav sits next to the logo only from `xl` (1280 px). Change the flakes in the SVG files and regenerate the `FLAKES` table, never edit one side only. Previews: `__treasury__allprojects/kreiswertS/vorschauen/2026-11-27-neues-logo-für-kreiswerts*`. Related: [[stack-decisions]]
