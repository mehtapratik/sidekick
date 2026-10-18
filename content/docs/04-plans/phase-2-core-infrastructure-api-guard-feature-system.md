---
publish: true
id: plan.phase-2-core-infrastructure-api-guard-feature-system
created: 2026-09-19
updated: 2026-10-18
kind: plan
version: 1.2.0
tags:
   - plan
   - living-plan
   - phase-2
   - api-guard
   - rls
   - api
   - authentication
   - feature-system
status: planned
depends_on:
   - "[[04-plans/phase-1-1-db-level-rls-soft-delete-enforcement-complete]]"
   - "[[04-plans/pre-2-foundation-hardening-complete]]"
---

> **Milestone:** The architectural backbone is live. `withApiGuard` is implemented and tested. The feature registry exists. You could add any feature safely from here.
> **Learning payoff:** Middleware patterns, centralized auth, feature flags, the "why" behind the architecture.

> **Gate:** ✅ Met — [[pre-2-foundation-hardening-complete]] was required before beginning the original Phase 2 tasks.

| #    | Task                                                                                                                              | Complexity | Learning |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 2.1  | Implement `resolveApiCaller(req)` in `packages/core/src/api/auth.ts` — cookie sessions; Bearer API keys fail closed until Phase 9 | 🔴         | 🔐 🧩    |
| 2.2  | Implement `withApiGuard(handler, opts)` in `packages/core/src/api/guard.ts` (see [[with-api-guard]] and [[contracts]])            | 🔴         | 🔐 🧩    |
| 2.3  | Wire `withRLS` inside `withApiGuard`                                                                                              | 🔴         | 🔐 🗄️    |
| 2.4  | Add basic request logging inside `withApiGuard` (method, path, userId, latency)                                                   | 🟡         | 🧩       |
| 2.5  | Add auth failure logging inside `withApiGuard`                                                                                    | 🟡         | 🧩       |
| 2.6  | Define `FeatureManifest` type in `packages/features-registry`                                                                     | 🟡         | 📦       |
| 2.7  | Implement `ALL_FEATURES` array in `packages/features-registry/src/index.ts` — start with an empty array                           | 🟡         | 📦       |
| 2.8  | Create `user_feature_entitlements` table in `packages/core` with `userId`, `featureSlug`, RLS policy                              | 🔴         | 🗄️ 🔐    |
| 2.9  | Implement `getEnabledFeatures(tx)` in `packages/core` — reads from entitlements table under RLS                                   | 🟡         | 🗄️       |
| 2.10 | Write a seed script to enable all features for your own user account during development                                           | 🟢         | 🗄️       |
| 2.11 | Create a test API route `/api/health` using `withApiGuard` to verify the full guard chain works                                   | 🟡         | 🧩 🔐    |
| 2.12 | Verify 401 is returned when unauthenticated; 403 when a feature is disabled                                                       | 🟢         |          |

**Phase 2 Exit Criteria:** `withApiGuard` is implemented and the `/api/health` route correctly returns 401/403 in the right conditions. The feature system can enable/disable features per user.

## Handoffs

Phase 2 is split into seven handoffs, each small enough for one agent with a fresh context. Each handoff is one pull request. All of them code against [[contracts]], so handoffs in the same wave can run in parallel. Start a wave only when the one before it is merged.

| Wave | Handoff              | Tasks      | Waits for             |
| ---- | -------------------- | ---------- | --------------------- |
| 1    | [[task-2-1]]         | 2.1        | nothing               |
| 1    | [[task-2-6and2-7]]   | 2.6, 2.7   | nothing               |
| 1    | [[task-2-8and2-9]]   | 2.8, 2.9   | nothing               |
| 2    | [[task-2-2and2-3]]   | 2.2, 2.3   | 2.1, 2.8 and 2.9      |
| 2    | [[task-2-10]]        | 2.10       | 2.6, 2.7, 2.8 and 2.9 |
| 3    | [[task-2-4and2-5]]   | 2.4, 2.5   | 2.2 and 2.3           |
| 3    | [[task-2-11and2-12]] | 2.11, 2.12 | 2.2 and 2.3           |
| 4    | Close-out (below)    | none       | everything above      |

To hand one off, give the agent its brief, [[contracts]] and `AGENTS.md`, and nothing else. A brief lists what to read, the files it owns, what's decided, what "done" means and what's out of scope.

**Pratik's steps:** apply the 2.8 migration to the dev Supabase project (`pnpm db:migrate`), run the 2.10 seed, and run the manual 2.12 check. Each one needs `.env.local`.

**Close-out:** write `05-builds/phase-2-walkthrough.md`, mark this plan complete the way Pre-2 was closed, update [[with-api-guard]] from a sketch to the shipped behaviour, update "Where things stand" in the agent guide, and record learnings in `09-notes/` (`publish: false`).

**Decisions made while planning** (details in [[contracts]]):

- Bearer API keys resolve to no caller (401) until Phase 9 adds `api_keys`.
- `getEnabledFeatures` takes the guard's RLS transaction and returns slugs, so `packages/core` stays feature-agnostic.
- Users can read their own entitlements but can't write any. Only the privileged role writes them.
- The guard checks scope before opening the transaction and checks the feature inside it.
- `/api/health` requires a session but no feature. The 403 path is proven by the guard's integration test.

---
