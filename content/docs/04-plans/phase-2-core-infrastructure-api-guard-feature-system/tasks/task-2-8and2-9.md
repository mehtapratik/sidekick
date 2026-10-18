---
publish: true
id: plan.phase-2.task-2-8and2-9
title: "Tasks 2.8 and 2.9: entitlements table and getEnabledFeatures"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - feature-system
   - database
   - drizzle
   - rls
   - postgresql
   - testing
status: planned
---

> **Handoff:** wave 1, runs alongside [[task-2-1]] and [[task-2-6and2-7]]. Depends on nothing. [[task-2-2and2-3]] and [[task-2-10]] wait for it.

**Goal:** store which features each user has, readable only by that user and writable by no one at runtime. Then read it inside an RLS transaction ([[contracts#Entitlements|contract]]).

**Read first:** [[contracts]], [[row-level-security]], [[migration]], [[05-builds/pre-2-walkthrough]] (Pre-2.1, Pre-2.5), `packages/core/src/db/migrations/0002_profiles_rls_policy.sql`, `packages/core/tests/integration/rls.test.ts`.

## Build

1. Add `packages/core/src/db/schema/user-feature-entitlements.ts` (`userFeatureEntitlements`) and export it from `schema/index.ts`.
2. Generate the table migration with `drizzle-kit generate` from `packages/core`. Generating doesn't connect to a database, but `drizzle.config.ts` requires `DATABASE_DIRECT_URL` to be set, so any placeholder value works. Then add a second, custom migration (`drizzle-kit generate --custom --name=user_feature_entitlements_rls`) that:
   - enables and forces RLS,
   - creates the `SELECT`-only own-rows policy (drop it first, the way `0002` does, so it's safe to re-run),
   - runs `REVOKE INSERT, UPDATE, DELETE ON user_feature_entitlements FROM app_runtime;`. This is needed because `0001`'s default privileges grant `app_runtime` full DML on every new table.

   Comment the SQL the way `0002` is commented. Never edit applied migrations or `meta/_journal.json` by hand.

3. Create `packages/core/src/features/entitlements.ts` with `getEnabledFeatures(tx)`, returning `feature_slug` values.
4. Extend the integration tests with a new `tests/integration/entitlements.test.ts`. Insert rows with a privileged connection to the test cluster, because `app_runtime` can't insert. If the tests need a privileged URL, export one from `tests/with-test-db.sh`. Prove:
   - each user sees only their own entitlements through `withRLS` and `getEnabledFeatures`,
   - with no user context, `app_runtime` sees zero rows,
   - `app_runtime` can't `INSERT` an entitlement even for its own user id (permission denied),
   - deleting a profile cascades to its entitlements.

## Done when

- `pnpm test:integration` passes. Each assertion fails when you remove the policy, the `REVOKE` or the FK.
- `pnpm turbo lint typecheck build test --force` passes.
- The PR description lists the two migration files and says the migration still has to be applied to the live Supabase project with `pnpm db:migrate`. Only Pratik can do that, because it needs `.env.local`.

## Out of scope

Seeding rows ([[task-2-10]]), the guard, and admin UI for entitlements.

**Learning focus:** RLS policies per command (`FOR SELECT` vs `FOR ALL`), `GRANT`/`REVOKE` as a second, independent wall, and why the table owner needs `FORCE`.
