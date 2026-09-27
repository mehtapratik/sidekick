---
title: Core drive vs Taxila
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
  - taxila
  - core-drive
appliesTo:
  - 04-plans/phase-4-taxila-v1-knowledge-management
isSection: false
docId: prd.features.core-drive-vs-taxila
sourcePath: sources/docs/02-prd/03-features/core-drive-vs-taxila.md
wordCount: 50
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Taxila is a monolithic corpus consumed via top-k similarity retrieval.
- Core Drive is a minimal but selectively curated source of facts and truth about the user, assembled by a tier system. The tier 0 (the kernel) sources are always loaded entirely whereas others depend on vector similarity match.
