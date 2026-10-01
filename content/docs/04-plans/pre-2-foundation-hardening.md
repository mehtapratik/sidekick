---
id: plan.pre-2-foundation-hardening
created: 2026-09-20
kind: plan
version: 1.0.0
status: planned
tags:
   - plan
   - pre-2
   - foundation
   - security
   - database
   - testing
depends_on:
   - "[[04-plans/phase-1-1-db-level-rls-soft-delete-enforcement-complete]]"
---

> **Milestone:** The Phase 1 foundation is reproducible, runtime-safe, and behaviorally proven before the first API guard or feature-system query is written.
>
> **Learning payoff:** Database roles, RLS verification, PostgreSQL pooling, migrations, automated security tests, and enforcement through linting and CI.

| #        | Task                                                                                                                            | Complexity | Review source                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- |
| Pre-2.1  | Version creation of `app_runtime` as a non-superuser role; keep only its password out of Git.                                   | 🔴         | [[runtime-role-reproducibility]]              |
| Pre-2.2  | Correct `postgres.js` configuration for Supavisor transaction pooling: `prepare: false`, `max_pipeline: 0`.                     | 🟡         | [[pooler-client-configuration]]               |
| Pre-2.3  | Version the `auth.users` profile trigger and add the `profiles.id → auth.users(id)` foreign key with explicit delete semantics. | 🔴         | [[profile-trigger-and-referential-integrity]] |
| Pre-2.4  | Make the RLS-aware access path safer than raw database access; restrict unsafe imports and exports.                             | 🔴         | [[db-access-chokepoint]]                      |
| Pre-2.5  | Add an end-to-end RLS proof test: each user sees only their own row, and a context-free query sees zero rows.                   | 🔴         | [[security-proof-and-ci]]                     |
| Pre-2.6  | Add CI for lint, typecheck, build, and the RLS proof test.                                                                      | 🟡         | [[security-proof-and-ci]]                     |
| Pre-2.7  | Reconcile `.env.example` with code and document runtime versus direct database connection roles.                                | 🟢         | [[environment-contract-drift]]                |
| Pre-2.8  | Tighten ESLint package-boundary types to enforce `apps → feature packages → core`.                                              | 🟡         | [[package-boundary-enforcement]]              |
| Pre-2.9  | Add an ESLint rule requiring API route handlers to use `withApiGuard`.                                                          | 🟡         | [[api-route-fail-open]]                       |
| Pre-2.10 | Choose a portable vault distribution strategy before cloud agents or CI require the external docs symlink.                      | 🟡         | [[portable-documentation-vault]]              |
| Pre-2.11 | Handle signup without a session by displaying the pending-confirmation state.                                                   | 🟢         | [[signup-confirmation-flow]]                  |

**Pre-2 Exit Criteria**

- A fresh environment can create the restricted runtime role and apply database migrations.
- `DATABASE_URL` uses the verified `app_runtime` transaction-pool connection; `DATABASE_DIRECT_URL` remains privileged and migration-only.
- The RLS proof runs automatically and demonstrates both isolation and fail-closed behavior.
- The auth profile trigger and foreign key are versioned migrations.
- CI protects the code and security checks on every change.
- Package, API-route, and database access boundaries are machine-enforced.
