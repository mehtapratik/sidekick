---
title: Pooler client configuration
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
  - supabase
  - drizzle
  - severity-medium
appliesTo: []
isSection: false
docId: opportunity.pooler-client-configuration
sourcePath: sources/docs/03-system-design/opportunities/pooler-client-configuration.md
wordCount: 50
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The application uses Supavisor transaction-mode pooling but initializes `postgres.js` with its defaults.

**Risk**

The first transactions can fail on prepared statements or hang because transaction pooling does not support the default behavior.

**Recommended fix**

Configure the client with `prepare: false` and `max_pipeline: 0` before Phase 2 introduces real queries.
