---
name: project-goals-prototype
description: Project goal of KreiswertS (interview 2026-11-27) – a presentable prototype first that later becomes a real app; architecture clean and above all robust; "done" = E2E green + click-through, no waiting for the dev team
metadata:
  type: project
---

Interview of 2026-11-27 ([Claude] mk-dev-82, user's own words summarised):

- **Goal:** a prototype that is meant to become a real app later. **First priority is the presentable prototype** – focus on it. Still keep the architecture as clean as possible and, above all, robust.
- **Priority for the next days:** no fixed order – do what makes sense (Level 2 part 2 negotiation/exchanges was already running in another chat).
- **Done for a Level 2 stage:** E2E scripts green (one acceptance + one negative test per requirement), a click-through scenario with the demo sites, the usual checks (`npm run check`, build). A dev-team review is welcome but **never a blocker** – build as far as is sensible without waiting for their feedback.

**Why:** the prototype is what gets shown; a later team builds the product on it.
**How to apply:** prefer visible, demo-ready results; never trade robustness (access rules, validation, data integrity) for speed; don't park work waiting for the dev team. See [[stack-decisions]].
