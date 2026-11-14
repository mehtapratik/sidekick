---
publish: true
id: harness.database-and-security
title: Database and Security
created: 2026-09-19
updated: 2026-11-14
kind: guidance
version: 1.3.0
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

Every table has a [[03-system-design/non-functional/database/delete-models|delete model]] (hard delete, tombstones hidden or tombstones visible), named in its schema file; it decides the table's policy and triggers. Every write in Synergy's repository runs inside `withUserLock` (lint rule `sidekick/require-user-lock`, [[D265]]).

- [[03-system-design/non-functional/database/delete-models|Delete models]]
- [[03-system-design/non-functional/database/repository-client|Repository client]]
- [[03-system-design/non-functional/security/row-level-security|Row-level security]]
- [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Mutation boundary]]
- [[03-system-design/non-functional/security/with-api-guard|API guard]]
