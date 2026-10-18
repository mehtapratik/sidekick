---
publish: true
id: plan.phase-2.task-2-8and2-9
title: "Lesson 3 (tasks 2.8, 2.9): entitlements table and getEnabledFeatures"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.1.0
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

> **Lesson 3 of 8.** Before this: [[task-2-1|lesson 2]]. Next: [[task-2-2and2-3|lesson 4]]. The coach follows [[contracts#How we build|how we build]]. The target design is [[contracts#Entitlements|Entitlements]].

**What gets built:** the `user_feature_entitlements` table with its RLS policy and grants, `getEnabledFeatures(tx)`, and integration tests that prove a user can read only their own entitlements and can never grant one to themselves.

**Concepts:** Drizzle schema and generated migrations, custom SQL migrations, RLS policies per command (`FOR SELECT` vs. `FOR ALL`), `FORCE ROW LEVEL SECURITY`, `GRANT`/`REVOKE` as a second wall, foreign keys with `ON DELETE CASCADE`, and integration tests on a throwaway database.

**Coach reads first:** [[contracts]], [[row-level-security]], [[migration]], [[05-builds/pre-2-walkthrough]] (Pre-2.1, Pre-2.5), `packages/core/src/db/` and `packages/core/tests/` in the Sidekick repo.

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** the RLS policy and `REVOKE` migration (step 3). Pratik decides, and can switch any step either way.

1. **Design the table.** Ask: "Which columns do we need? Can a user have the same feature twice? What happens to their rows when the user is deleted?" Pratik sketches the columns, then build the Drizzle schema in `src/db/schema/user-feature-entitlements.ts` and export it.
2. **Generate the migration.** Pratik runs `drizzle-kit generate` from `packages/core` and reads the SQL it produced. Explain the journal, and why applied migrations are never edited.
3. **Lock it down.** This is the core of the lesson. Ask: "Who should be able to insert a row here?" Write a custom migration (`drizzle-kit generate --custom`) that enables and forces RLS, adds a `SELECT`-only own-rows policy, and revokes `INSERT`/`UPDATE`/`DELETE` from `app_runtime`. Use `0001`'s default privileges to show why the `REVOKE` is needed. Pratik should be able to explain every line of it.
4. **Read it.** Build `getEnabledFeatures(tx)` in `src/features/entitlements.ts`. Ask why it takes `tx` and not `userId`, and compare their answer with the contract.
5. **Prove it.** Pratik installs PostgreSQL 17 tools if needed, reads `tests/with-test-db.sh` and `rls.test.ts`, then write `tests/integration/entitlements.test.ts`. It proves that users see only their own rows, that a context-free query sees none, that `app_runtime` can't insert, and that rows cascade on delete. Pratik breaks the policy, the `REVOKE` and the FK one at a time and watches each test fail.
6. **Apply to dev.** Pratik runs `pnpm db:migrate` against the dev Supabase project and checks the table in the Supabase dashboard.
7. **Verify and ship.**

## Check understanding

- RLS and `REVOKE` both block the insert. Why keep both?
- What would `FORCE` change if `app_runtime` owned the table?
- Why does a context-free query return zero rows instead of an error?

**Done when:** Pratik's PR is green, the migration is applied to dev, and they can answer the questions above.

**Out of scope:** seeding rows (lesson 7), the guard, and admin UI.
