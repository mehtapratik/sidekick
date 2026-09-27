---
title: DB access chokepoint
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - database
  - rls
  - architecture
  - severity-high
appliesTo: []
isSection: false
docId: opportunity.db-access-chokepoint
sourcePath: sources/docs/03-system-design/opportunities/db-access-chokepoint.md
wordCount: 64
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The raw database client is exported directly and no automated rule requires user-data access through `withRLS` or a repository boundary.

**Risk**

Convenient direct queries will accumulate before a repository chokepoint is established, making later security retrofits costly.

**Recommended fix**

Restrict the raw client export to an explicitly unsafe/server-only entry point and prohibit imports with `no-restricted-imports`. Make the safe RLS-aware path the shortest import.
