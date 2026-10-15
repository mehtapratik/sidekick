---
publish: true
id: opportunity.pooler-client-configuration
created: 2026-09-19
updated: 2026-10-15
kind: opportunity
version: 1.1.0
status: resolved
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

Configure the client with `prepare: false` before Phase 2 introduces real queries. Supavisor's transaction mode does not keep a client on one Postgres connection between transactions, so named prepared statements fail.

**Do not set `max_pipeline: 0`.** It was originally recommended here as a precaution, but in `postgres.js` it prevents a connection from ever being reserved for a transaction, so every transaction — including `withRLS` — fails with `UNSAFE_TRANSACTION`. The RLS proof test (`packages/core/tests/integration/rls.test.ts`) caught this before any code depended on `withRLS`. Inside a transaction, Supavisor already pins one Postgres connection and `postgres.js` reserves it, so disabling pipelining added no protection.
