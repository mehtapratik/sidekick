---
publish: true
id: plan.phase-2-core-infrastructure-api-guard-feature-system
created: 2026-09-19
updated: 2026-10-23
kind: plan
version: 2.2.3
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
| 2.8  | Create `user_feature_entitlements` table in `packages/core` with `userId`, `featureKey`, RLS policy                               | 🔴         | 🗄️ 🔐    |
| 2.9  | Implement `getEnabledFeatures(tx)` in `packages/core` — reads from entitlements table under RLS                                   | 🟡         | 🗄️       |
| 2.10 | Write a seed script to enable all features for your own user account during development                                           | 🟢         | 🗄️       |
| 2.11 | Create a test API route `/api/health` using `withApiGuard` to verify the full guard chain works                                   | 🟡         | 🧩 🔐    |
| 2.12 | Verify 401 is returned when unauthenticated; 403 when a feature is disabled                                                       | 🟢         |          |

**Phase 2 Exit Criteria:** `withApiGuard` is implemented and the `/api/health` route correctly returns 401/403 in the right conditions. The feature system can enable/disable features per user.

## Lessons

Phase 2 is built piece by piece, with Pratik learning as it goes ([[contracts#How we build|how we build]]). By default the coach hands over one small, explained piece at a time, and the two discuss it before it's final. Pratik writes the steps they call core themselves, and can ask the coach to code work with no learning payoff. Lessons run one at a time, in this order, each in its own thread. A lesson starts only after the previous lesson's PR is merged. The order starts with the smallest, self-contained work and builds up to the guard.

| Lesson | Brief                | Tasks      | What Pratik learns                                          |
| ------ | -------------------- | ---------- | ----------------------------------------------------------- |
| 1 ✅   | [[task-2-6and2-7]]   | 2.6, 2.7   | TypeScript types, package exports, Vitest, branch → PR      |
| 2 ✅   | [[task-2-1]]         | 2.1        | sessions vs. Bearer tokens, discriminated unions, mocking   |
| 3 ✅   | [[task-2-8and2-9]]   | 2.8, 2.9   | schema, migrations, RLS policies, grants, integration tests |
| 4 ✅   | [[task-2-2and2-3]]   | 2.2, 2.3   | higher-order functions, generics, transactions              |
| 5      | [[task-2-4and2-5]]   | 2.4, 2.5   | structured logging, ESLint overrides                        |
| 6      | [[task-2-11and2-12]] | 2.11, 2.12 | route handlers, testing HTTP by hand                        |
| 7      | [[task-2-10]]        | 2.10       | scripts, database roles, idempotent writes                  |
| 8      | Close-out (below)    | none       | writing it up                                               |

**To start a lesson,** open a new thread and paste this, changing the lesson number:

```
Coach me through Phase 2 lesson 1, piece by piece as contracts.md describes:
hand me one explained piece at a time, and I'll say which ones I write myself. Read AGENTS.md,
docs/04-plans/phase-2-core-infrastructure-api-guard-feature-system/contracts.md
and that lesson's brief (the plan's Lessons table links each one) before we start.
```

Every brief has the same parts: what gets built, the concepts, what the coach reads first, numbered steps, which steps are good to write yourself, questions to check understanding, and when the lesson is done. The coach builds from the target design in [[contracts]], which changes when Pratik's own design wins.

**Close-out (lesson 8):** Pratik writes `05-builds/phase-2-walkthrough.md` with the coach's help, marks this plan complete the way Pre-2 was closed, updates [[with-api-guard]] from a sketch to the shipped behaviour, updates "Where things stand" in the agent guide, and records learnings in `09-notes/` (`publish: false`).

**Design decisions made while planning** (details in [[contracts]]; each can be revisited in its lesson):

- Bearer API keys resolve to no caller (401) until Phase 9 adds `api_keys`.
- `getEnabledFeatures` takes the guard's RLS transaction and returns feature keys, so `packages/core` stays feature-agnostic.
- Users can read their own entitlements but can't write any. Only the privileged role writes them.
- The guard checks scope before opening the transaction and checks the feature inside it.
- Lesson 1: features are identified by `key` (not `slug`), object shapes are `interface`s, and rollout gating stays out of the registry (post-MVP, [[backlogged-unplanned#B5 — Feature rollout gating|B5]]).
- Lesson 2: the caller variants are named interfaces with `kind: 'key'`, and any `Authorization` header resolves to no caller, even alongside a valid session.
- Lesson 3: entitlements use a composite primary key `(user_id, feature_key)` with no surrogate `id`, `user_id` references `profiles`, and `app_runtime` can only `SELECT` them.
- After lesson 3: `resolveApiCaller` returns `undefined`, not `null`, for no caller (coding standard: prefer `undefined`).
- Lesson 4: handlers read `caller.userId` (no separate `userId`), `feature` stays optional and skips the entitlements query when unset, and the shared test helpers live in `packages/core/tests/helpers/`.
- `/api/health` requires a session but no feature. The 403 path is proven by lesson 4's integration test.

---
