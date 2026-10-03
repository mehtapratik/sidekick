---
publish: true
id: prd.features.core-drive.anatomy-of-a-core-drive-entry
created: 2026-09-19
kind: prd
version: 1.0.0
tags:
   - system-design
   - prd
   - feature
   - core-drive
applies_to:
   - "[[04-plans/phase-6-core-drive-ai-layer-alter-ego]]"
---

Each Core Drive entry stores, from day one:

- `category` — drives tier rules — identity, principle, mental-model, heuristic, tool, preference…
- `directive` — a compact one-line imperative form used for injection (“Never restart a project from scratch; pause and resume”), alongside the full prose the user reads. This is the primary context-size lever: thousands of entries stay affordable because the _distilled_ form is what gets injected.
- `weight` — priority for conflict resolution when two loaded entries clash in a situation
- `kernel` — boolean marking Tier 0 membership
- Applicability via [[00-global-tags-and-metadata|global tags]]; usage tracking (e.g. `lastLoadedAt`) so dead-weight entries become visible for curation
