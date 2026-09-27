---
title: Architecture invariants
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: guidance
status: draft
version: 1.0.0
tags:
  - ai-coding
  - architecture
  - invariants
  - agent-guidance
  - api
  - nextjs
appliesTo: []
isSection: false
docId: harness.architecture-invariants
sourcePath: sources/docs/08-ai-coding-harness/architecture-invariants.md
wordCount: 42
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Before changing code, use the relevant system-design note as the source of truth. Always preserve the package dependency direction, public-API boundary, centralized copy policy, and server/client runtime separation.

- [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]]
- [[03-system-design/non-functional/api/api-first|API-first]]
- [[03-system-design/non-functional/content/centralized-copy|Centralized copy]]
- [[03-system-design/non-functional/nextjs/server-actions|Server actions]]
- [[best-practices|Implementation checklist]]
