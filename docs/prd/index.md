---
title: PRDs
---

# Product Requirement Documents

Product truth for Sidekick lives here. The architecture describes *mechanisms and invariants*; PRDs describe *what gets built and why*. Changes flow one way: **PRD → architecture §5 module mapping → living plan phases**.

## Convention

1. **PRD #00 — the high-level PRD** is [Project Sidekick — A Bird's Eye View](../essays/01-sidekick-birds-eye-view.md). It stays in `essays/` (it is published on arkive.blog) and is referenced from here rather than duplicated.
2. **One PRD per feature, written before that feature's phase starts.** Before implementing Taxila, Zinsser, Core Drive, Alter Ego, War Room, or Factory, its PRD lands in this folder — adding color the high-level PRD doesn't carry (entity anatomy, interaction details, MVP cut lines).
3. When a PRD changes after implementation begins, update the traceability table in the [living plan](../plans/00-living-plan/living-plan.md) and record the change in its changelog.

## Index

| # | PRD | Status |
| --- | --- | --- |
| 00 | [High-level PRD — Bird's Eye View](../essays/01-sidekick-birds-eye-view.md) | Active |
| 01 | Taxila | Not started (required before Phase 4) |
| 02 | Zinsser | Not started (required before Phase 5) |
| 03 | [Core Drive](03-core-drive.md) | Draft (full PRD required before Phase 6; must detail the category taxonomy and tiered context model — architecture §5.2) |
| 04 | Alter Ego | Not started (required before Phase 6; must specify the source-attribution contract) |
| 05 | War Room | Not started (required before Phase 7) |
| 06 | Factory | Not started (required before Phase 7) |
