---
id: plan.phase-2-core-infrastructure-api-guard-feature-system
created: 2026-09-19
kind: plan
version: 1.1.0
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
   - "[[04-plans/pre-2-foundation-hardening]]"
---

> **Milestone:** The architectural backbone is live. `withApiGuard` is implemented and tested. The feature registry exists. You could add any feature safely from here.
> **Learning payoff:** Middleware patterns, centralized auth, feature flags, the "why" behind the architecture.

> **Gate:** Complete [[pre-2-foundation-hardening]] before beginning the original Phase 2 tasks.

| #    | Task                                                                                                                | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 2.1  | Implement `resolveApiCaller(req)` in `packages/core/api/auth.ts` — handles both cookie sessions and Bearer API keys | 🔴         | 🔐 🧩    |
| 2.2  | Implement `withApiGuard(handler, opts)` in `packages/core/api/guard.ts` (see §10.2 canonical implementation)        | 🔴         | 🔐 🧩    |
| 2.3  | Wire `withRLS` inside `withApiGuard`                                                                                | 🔴         | 🔐 🗄️    |
| 2.4  | Add basic request logging inside `withApiGuard` (method, path, userId, latency)                                     | 🟡         | 🧩       |
| 2.5  | Add auth failure logging inside `withApiGuard`                                                                      | 🟡         | 🧩       |
| 2.6  | Define `FeatureManifest` type in `packages/features-registry`                                                       | 🟡         | 📦       |
| 2.7  | Implement `ALL_FEATURES` array in `packages/features-registry/index.ts` — start with an empty array                 | 🟡         | 📦       |
| 2.8  | Create `user_feature_entitlements` table in `packages/core` with `userId`, `featureSlug`, RLS policy                | 🔴         | 🗄️ 🔐    |
| 2.9  | Implement `getEnabledFeatures(userId)` in `packages/core` — reads from entitlements table                           | 🟡         | 🗄️       |
| 2.10 | Write a seed script to enable all features for your own user account during development                             | 🟢         | 🗄️       |
| 2.11 | Create a test API route `/api/health` using `withApiGuard` to verify the full guard chain works                     | 🟡         | 🧩 🔐    |
| 2.12 | Verify 401 is returned when unauthenticated; 403 when a feature is disabled                                         | 🟢         |          |

**Phase 2 Exit Criteria:** `withApiGuard` is implemented and the `/api/health` route correctly returns 401/403 in the right conditions. The feature system can enable/disable features per user.

---
