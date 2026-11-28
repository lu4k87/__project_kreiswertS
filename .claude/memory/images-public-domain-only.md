---
name: images-public-domain-only
description: App images are self-made (Blender renders, SVG) – no third-party photos; anything external would have to be CC0 / public domain (user, 2026-11-28)
metadata:
  type: feedback
---

Images used in the app (`public/images/**`, stock photos in `src/components/ui/material-photo.tsx`) must be licence-free: **CC0 or public domain only** (user, 2026-11-28: "die Bilder die du für die App verwendest müssen lizenzfrei sein", then chose "CC0 / Public Domain only" over Unsplash/Pexels).

**Why:** CC BY / BY-SA need attribution and share-alike; the user wants no licence conditions at all. Before this, 15 of 17 material photos were CC BY/BY-SA and were replaced the same day.

Minutes later the user went further: "bau entsprechend hochprofessionelle geeignete Bilder selbst! sehr gute Grafiken generieren!" → all material, category and industry pictures are rendered in Blender (`scripts/images/`), no stock photos any more.

**How to apply:** new pictures = own renders in the same studio look (script in `scripts/images/`); only if that is impossible: search Openverse with `license=cc0,pdm` or Wikimedia Commons, check the licence on the source page (Commons `extmetadata.LicenseShortName`) before downloading, keep title, author and source in the credit entry (credits stay on the About page as a courtesy). Own drawings (SVG) are always fine. Related: [[logo-flake-ring]].
