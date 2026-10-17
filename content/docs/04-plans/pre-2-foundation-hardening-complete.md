---
publish: true
id: plan.pre-2-foundation-hardening-complete
created: 2026-09-20
updated: 2026-10-16
kind: plan
version: 2.0.0
status: completed
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
>
> **Completed:** October 2026 — walkthrough in [[05-builds/pre-2-foundation-hardening]]

| #        | Task                                                                                                                            | Complexity | Review source                                 | Status |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- | ------ |
| Pre-2.1  | Version creation of `app_runtime` as a non-superuser role; keep only its password out of Git.                                   | 🔴         | [[runtime-role-reproducibility]]              | ✅     |
| Pre-2.2  | Correct `postgres.js` configuration for Supavisor transaction pooling: `prepare: false` (not `max_pipeline: 0`).                | 🟡         | [[pooler-client-configuration]]               | ✅     |
| Pre-2.3  | Version the `auth.users` profile trigger and add the `profiles.id → auth.users(id)` foreign key with explicit delete semantics. | 🔴         | [[profile-trigger-and-referential-integrity]] | ✅     |
| Pre-2.4  | Make the RLS-aware access path safer than raw database access; restrict unsafe imports and exports.                             | 🔴         | [[db-access-chokepoint]]                      | ✅     |
| Pre-2.5  | Add an end-to-end RLS proof test: each user sees only their own row, and a context-free query sees zero rows.                   | 🔴         | [[security-proof-and-ci]]                     | ✅     |
| Pre-2.6  | Add CI for lint, typecheck, build, and the RLS proof test.                                                                      | 🟡         | [[security-proof-and-ci]]                     | ✅     |
| Pre-2.7  | Reconcile `.env.example` with code and document runtime versus direct database connection roles.                                | 🟢         | [[environment-contract-drift]]                | ✅     |
| Pre-2.8  | Tighten ESLint package-boundary types to enforce `apps → feature packages → core`.                                              | 🟡         | [[package-boundary-enforcement]]              | ✅     |
| Pre-2.9  | Require `withApiGuard` on route handlers (ESLint); ban other entry points; verify built endpoints from Next.js manifests.       | 🟡         | [[api-route-fail-open]]                       | ✅     |
| Pre-2.10 | Choose a portable vault distribution strategy before cloud agents or CI require the external docs symlink.                      | 🟡         | [[portable-documentation-vault]]              | ✅     |
| Pre-2.11 | Handle signup without a session by displaying the pending-confirmation state.                                                   | 🟢         | [[signup-confirmation-flow]]                  | ✅     |
| Pre-2.12 | Pre-commit Prettier on staged files (`husky` + `lint-staged`); `prettier:check` in CI; pin Node 22 locally (`.nvmrc`).          | 🟢         | [[prettier-at-repo-level]]                    | ✅     |
| Pre-2.13 | Protect `main` with a ruleset: changes arrive via branch + PR; the CI `checks` job must pass to merge.                          | 🟢         | [[security-proof-and-ci]]                     | ✅     |

**Pre-2 Exit Criteria:** ✅ All met.

- A fresh environment can create the restricted runtime role and apply database migrations.
- `DATABASE_URL` uses the verified `app_runtime` transaction-pool connection; `DATABASE_DIRECT_URL` remains privileged and migration-only.
- The RLS proof runs automatically and demonstrates both isolation and fail-closed behavior.
- The auth profile trigger and foreign key are versioned migrations.
- CI protects the code and security checks on every change.
- Package, API-route, and database access boundaries are machine-enforced.
- Formatting is applied before every commit and verified in CI.
- `main` accepts changes only through pull requests that pass CI.

**Implementation notes:**

- **Pre-2.2 was corrected by Pre-2.5.** `max_pipeline: 0` was added as a precaution and broke every `postgres.js` transaction (`UNSAFE_TRANSACTION`), including `withRLS`. The RLS proof test caught it before any code depended on `withRLS`. Only `prepare: false` remains.
- **Pre-2.1 deliberately edited an applied migration.** `0001` now creates `app_runtime NOLOGIN` if missing. Safe because Drizzle never re-runs an applied migration and the block is a no-op wherever the role exists.
- **Pre-2.3 also pinned `search_path = ''`** on the `SECURITY DEFINER` profile trigger function.
- **Pre-2.5/2.6 pin PostgreSQL 17** (Supabase's major) in tests and CI; `tests/with-test-db.sh` fails loudly on any other major. Principle recorded in [[pin-versions]].
- **Pre-2.9 grew beyond one lint rule:** Server Actions, the Pages Router and `pageExtensions` are banned, and `apps/web`'s build verifies Next.js's endpoint manifests ([[server-actions]], [[with-api-guard]]).
- **Pre-2.10 deleted a dead workflow** (`trigger-arkive-deploy.yml`) and runs `scripts/setup-docs.mjs` on `pnpm install`.
- **Added beyond the original list:** an ESLint best-practice rule set with `verbatimModuleSyntax` ([[eslint-best-practice-rules]]), Vitest as the monorepo test framework ([[vitest]]), and Node 22 pinned through `.nvmrc` + `engineStrict`.
- **GitHub Pages** for the Sidekick repo was publishing `docs/` and failing since `docs/` became a symlink; it should stay disabled.

