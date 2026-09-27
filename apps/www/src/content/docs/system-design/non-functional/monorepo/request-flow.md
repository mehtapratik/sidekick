---
title: Request flow
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - monorepo
  - api
  - offline
appliesTo: []
isSection: false
docId: system-design.non-functional.monorepo.request-flow
sourcePath: sources/docs/03-system-design/non-functional/monorepo/request-flow.md
wordCount: 52
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

All request must flow from `UI -> Repository -> API -> DB`. No exceptions.

**Why:**
To support [[offline-ready]] requirement. When we’re ready to support offline features this flow will switch to `UI -> Local DB -> Sync Engine -> API -> Database`. In this manner, UI will remain agnostic of request flow.
