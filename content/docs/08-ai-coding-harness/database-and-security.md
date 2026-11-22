---
publish: true
id: harness.database-and-security
title: Database and Security
created: 2026-09-19
updated: 2026-11-21
kind: guidance
version: 1.6.0
tags:
   - ai-coding
   - database
   - security
   - agent-guidance
   - api-guard
   - rls
   - drizzle
   - api
   - react
   - repository-pattern
---

Use the repository client for database access, preserve RLS, and route mutations through the API layer. Drizzle never runs in client components.

Supabase's Data API is off, and its roles (`anon`, `authenticated`) hold no privileges in `public`; default privileges keep new tables, sequences and functions that way. Never grant them anything, and don't add `SECURITY DEFINER` functions without a review. Core's `tests/integration/data-api-roles.test.ts` fails if either slips; every package migrates into the same test database, so it checks every package's tables and functions.

A SQL function another package binds (core's soft-delete trigger functions) is public API. Change it only in a way every caller survives: a `CREATE OR REPLACE` that changes behaviour changes it for every package at once, with no error. A first definition uses plain `CREATE FUNCTION`, so a name clash fails loudly; prefix a package's own functions with its name (`synergy_…`). See [[03-system-design/non-functional/database/migration|Migration]].

Every table has a [[03-system-design/non-functional/database/delete-models|delete model]] (hard delete, tombstones hidden or tombstones visible), named in its schema file; it decides the table's policy and triggers. Every write in Synergy's repository runs inside `withUserLock` (from `@sidekick/core/db`; lint rule `sidekick/require-user-lock`, [[D265]]), and every write route sets `lockUser: true` in its guard options so the lock is taken before any row lock. Core's catalog test lists every table with its delete model: a new table must be added there and in Delete Models.

Each table's policy writes out its own ownership check; a central function every policy calls is deferred ([[D267]]). Raise D267 with Pratik when a change would edit the ownership check in three or more tables' policies, or an ownership rule (sharing, workspaces, an agent acting for a user) must apply to most tables at once. Don't build it unasked.

A handler's error response (status 400 or above) rolls back its whole transaction, the same as a throw ([[D268]]). Don't order a handler's writes to protect against a failing check, and don't reintroduce "validate before you write" or "call Synergy first" as rules; both are retired. A write that must survive an error needs an explicit opt-in, which doesn't exist yet: raise it with Pratik.

- [[03-system-design/non-functional/database/delete-models|Delete models]]
- [[03-system-design/non-functional/database/repository-client|Repository client]]
- [[03-system-design/non-functional/security/row-level-security|Row-level security]]
- [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Mutation boundary]]
- [[03-system-design/non-functional/security/with-api-guard|API guard]]
