---
title: Evolvability
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - rls
  - offline
appliesTo: []
isSection: false
docId: system-design.non-functional.evolvability
sourcePath: sources/docs/03-system-design/non-functional/evolvability.md
wordCount: 78
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Requirements will keep evolving as clarity grows. To keep technical architecture and implementation plan flexible…

1. **`./prd/` is product truth** — the high-level PRD plus per-feature PRDs written before each feature starts.
2. **`./system-design` describes mechanisms and invariants, not feature lists.** Implementation changes based on feature specs should only affect `./system-design/functional` (system design translation of product requirements) — never the security, RLS, repository, or offline sections.
3. Changes flow one way: PRD → `./system-design/functional` → living plan phases.
