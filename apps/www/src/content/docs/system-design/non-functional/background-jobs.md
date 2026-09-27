---
title: Background jobs
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - vercel
  - background-jobs
appliesTo: []
isSection: false
docId: system-design.non-functional.background-jobs
sourcePath: sources/docs/03-system-design/non-functional/background-jobs.md
wordCount: 35
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Use lightweight async background jobs using `waitUntil()`, Vercel background execution, and retry wrappers.
2. As complexity emerge post-MVP and user-base increase, this will evolve in complex ingest flow, queues, cron jobs, and distributed workers.
