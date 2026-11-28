---
name: logo-flake-ring
description: Logo = spiral of 8 recycled plastic flakes (chosen 2026-11-28, replaces the 13-flake ring of 2026-11-27) with a wave on load and mouse touch
metadata:
  type: project
---

The user chose the flake-ring logo (preview round 2, variant Bild:C) on 2026-11-27 and reshaped it on 2026-11-28 (preview "Logo-Spirale 2", variant Fib:B): 8 irregular flakes in ochre, green, petrol, brown, salmon, sage, ochre and rust, each 15 % larger and 15 % further out than the one before (smallest at the right, clockwise, largest at the top right) – a Fibonacci-type spiral. Wordmark "kreiswertS" in Syne 800: lowercase except the last letter, a capital S in the rust of the largest flake (`#c2532f` light, `#e07a55` dark) – chosen 2026-11-28 in the preview "Wortmarke kreiswertS" (variant S:B). Typeface (Font:A/B/C) and word split (Wort:A/B/C) of that preview were left open, so Syne in one line stays until the user decides.

Motion (same choice): once when the logo appears and once per mouse touch every flake grows by 20 % for 520 ms, 90 ms after the one before; touch input and "reduce motion" stay still.

Files in `public/brand/`: `kreiswerts-mark.svg` and `kreiswerts-mark-small.svg` (same 8 flakes, cropped tighter for 16–32 px), each with a `-dark` variant, plus `favicon.svg` (follows `prefers-color-scheme`) = `src/app/icon.svg`.

**Why:** the 13-flake ring had "too many single pieces"; a first try with 13 flakes and only a slight arc was rejected the same day ("fewer pieces, a bit more of the Fibonacci effect"). The flakes show the material the platform starts with (plastics regranulate).

**How to apply:** `src/components/ui/brand-mark.tsx` – `BrandMark` draws the flakes inline with `light-dark()` fills (follows the theme switch, `tone="onBrand"` = dark colours on the green brand card), `BrandLogo` = mark + wordmark inside `BrandWave` (`brand-wave.tsx`, client component that restarts the CSS animation `kw-wave` from `globals.css` on mouse enter). `brand-mark.test.ts` fails when the `FLAKES` table and the SVG files differ – never edit one side only. The wide wordmark is why the public nav sits next to the logo only from `xl` (1280 px). Previews: `__treasury__allprojects/kreiswertS/vorschauen/2026-11-27-neues-logo-für-kreiswerts*` and `2026-11-28-kreiswerts-logo-*`. Related: [[stack-decisions]]
