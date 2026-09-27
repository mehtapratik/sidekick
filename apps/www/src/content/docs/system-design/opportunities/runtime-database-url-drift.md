---
title: Runtime database URL drift
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: built
version: 1.1.0
tags:
  - opportunity
  - phase-2
  - security
  - rls
  - configuration
  - severity-high
appliesTo: []
isSection: false
docId: opportunity.runtime-database-url-drift
sourcePath: sources/docs/03-system-design/opportunities/runtime-database-url-drift.md
wordCount: 83
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Verification**

A Supavisor transaction-pooler connection as `app_runtime` on port `6543` and database `postgres` has been verified. The role has `NOBYPASSRLS`, and `DATABASE_URL` has been updated to use that connection shape.

**Remaining proof**

RLS still needs an end-to-end behavioral test through the application runtime: two users must see only their own rows, and a query without `app.current_user_id` must see zero rows.

**Operational rule**

Never record credentials in documentation. Rotate a runtime password immediately if it is exposed, then update `.env.local` and local database-client profiles.
