---
title: Why prettier at repo level?
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - prettier
  - turborepo
  - graph
appliesTo: []
isSection: false
docId: decision.technical.why-prettier-at-repo-level
sourcePath: sources/docs/06-decisions/technical/why-prettier-at-repo-level?.md
wordCount: 60
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

The Decision: [[prettier-at-repo-level]]

**Rationale:**
Prettier operates on files, not packages. It doesn't understand the package dependency graph and has no concept of "build this package before formatting that one." Running it once from the root is simpler, faster, and correct.

Turborepo caching would also be counterproductive for formatting — Prettier rewrites files in place, which would constantly invalidate the cache.
