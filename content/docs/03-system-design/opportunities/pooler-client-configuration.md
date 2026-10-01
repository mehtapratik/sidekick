---
publish: true
id: opportunity.pooler-client-configuration
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - database
   - supabase
   - drizzle
   - severity-medium
related:
   - "[[03-system-design/non-functional/database/app_runtime-for-drizzle]]"
---

**Problem**

The application uses Supavisor transaction-mode pooling but initializes `postgres.js` with its defaults.

**Risk**

The first transactions can fail on prepared statements or hang because transaction pooling does not support the default behavior.

**Recommended fix**

Configure the client with `prepare: false` and `max_pipeline: 0` before Phase 2 introduces real queries.
