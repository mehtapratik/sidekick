---
id: system-design.non-functional.database.app-runtime-for-drizzle
created: 2026-09-19
kind: spec
version: 1.1.0
tags:
   - system-design
   - database
   - drizzle
   - postgresql
---

Regular `drizzle-orm` queries flow through the nonsuperuser `app_runtime` role using `DATABASE_URL`.

For Supavisor transaction pooling, `DATABASE_URL` uses:

- username: `app_runtime.<project-ref>`
- port: `6543`
- database: `postgres`
- SSL: required

DO NOT use `DATABASE_DIRECT_URL` for regular queries. It uses the privileged `postgres` role and bypasses [[row-level-security]]; reserve it for migrations and administration.

[[app-runtime-role-for-drizzle|more information…]]
