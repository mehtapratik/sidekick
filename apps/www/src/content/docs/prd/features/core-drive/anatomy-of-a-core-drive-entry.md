---
title: Anatomy of a core drive entry
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: prd
status: draft
version: 1.0.0
tags:
  - system-design
  - prd
  - features
  - core-drive
appliesTo:
  - 04-plans/phase-6-core-drive-ai-layer-alter-ego
isSection: false
docId: prd.features.core-drive.anatomy-of-a-core-drive-entry
sourcePath: >-
  sources/docs/02-prd/03-features/00-core-drive/03-anatomy-of-a-core-drive-entry.md
wordCount: 106
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Each Core Drive entry stores, from day one:

- `category` — drives tier rules — identity, principle, mental-model, heuristic, tool, preference…
- `directive` — a compact one-line imperative form used for injection (“Never restart a project from scratch; pause and resume”), alongside the full prose the user reads. This is the primary context-size lever: thousands of entries stay affordable because the _distilled_ form is what gets injected.
- `weight` — priority for conflict resolution when two loaded entries clash in a situation
- `kernel` — boolean marking Tier 0 membership
- Applicability via [[00-global-tags-and-metadata|global tags]]; usage tracking (e.g. `lastLoadedAt`) so dead-weight entries become visible for curation
