---
title: Repository client
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - database
  - rls
  - supabase
  - drizzle
  - api
  - repository-pattern
appliesTo: []
isSection: false
docId: system-design.non-functional.database.repository-client
sourcePath: sources/docs/03-system-design/non-functional/database/repository-client.md
wordCount: 110
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Database repository client’s job is to make sure all queries are executed under right context.
2. Every query must be funneled through database repository client to ensure right guards ([[row-level-security|RLS]] or no-RLS) are added.
3. Never run rogue database query directly. [[never-mutate-outside-api-layer]]
4. Every query must either be executed via Supabase’s `createAdminClient` or `drizzle-orm`.

**Questions:**

> How can we ensure all queries, `createAdminClient` or Drizzle, are routed through DB repository layer?

> How do we ensure read queries are authenticated, and authorized? Original handover document only talks about mutations, not select queries. Can select queries be scattered? If so, why? Why not route select queries also through repository layer?
