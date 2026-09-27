---
title: Idempotent API
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - api
  - idempotency
appliesTo: []
isSection: false
docId: system-design.non-functional.api.idempotent-api
sourcePath: sources/docs/03-system-design/non-functional/api/idempotent-api.md
wordCount: 53
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Idempotent** operations that produces the same result no matter how many times you apply it (after the first time). Running it once or a hundred times leaves the system in the same state.

Sidekick’s API endpoints will be idempotent. This makes system safe to retry in case of suspected failures or parallel attempts.
