---
publish: true
title: Why Prettier at repo level?
id: decision.technical.why-prettier-at-repo-level
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - prettier
   - turborepo
   - graph
status: accepted
aliases:
   - prettier-at-repo-level
   - root-prettier-config
---

The Decision: [[prettier-at-repo-level]]

**Rationale:**
Prettier operates on files, not packages. It doesn't understand the package dependency graph and has no concept of "build this package before formatting that one." Running it once from the root is simpler, faster, and correct.

Turborepo caching would also be counterproductive for formatting — Prettier rewrites files in place, which would constantly invalidate the cache.
