---
id: opportunity.runtime-database-url-drift
created: 2026-09-19
kind: opportunity
version: 1.1.0
status: resolved
tags:
   - opportunity
   - phase-2
   - security
   - rls
   - configuration
   - severity-high
related:
   - "[[03-system-design/non-functional/database/app_runtime-for-drizzle]]"
   - "[[03-system-design/non-functional/security/row-level-security]]"
---

**Verification**

A Supavisor transaction-pooler connection as `app_runtime` on port `6543` and database `postgres` has been verified. The role has `NOBYPASSRLS`, and `DATABASE_URL` has been updated to use that connection shape.

**Remaining proof**

RLS still needs an end-to-end behavioral test through the application runtime: two users must see only their own rows, and a query without `app.current_user_id` must see zero rows.

**Operational rule**

Never record credentials in documentation. Rotate a runtime password immediately if it is exposed, then update `.env.local` and local database-client profiles.
