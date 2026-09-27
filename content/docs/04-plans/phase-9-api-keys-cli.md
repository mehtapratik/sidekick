---
id: plan.phase-9-api-keys-cli
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-9
   - taxila
   - api-guard
   - rls
   - api
   - authentication
   - cli
status: planned
depends_on:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system]]"
---

> **Milestone:** You can use your own app from the terminal. API keys are manageable from the UI. The CLI is a real working tool.
> **Learning payoff:** CLI tooling (commander.js or similar), API key security patterns, Bearer auth flows, streaming in a terminal context.

| #    | Task                                                                                             | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 9.1  | Create `api_keys` table in `packages/core` (see §8.3 canonical schema)                           | 🟡         | 🗄️ 🔐    |
| 9.2  | Migration + RLS for `api_keys`                                                                   | 🟡         | 🗄️ 🔐    |
| 9.3  | Implement API key generation — secure random bytes → raw key returned once → SHA-256 hash stored | 🔴         | 🔐       |
| 9.4  | Wire Bearer API key lookup into `resolveApiCaller()` in `packages/core`                          | 🔴         | 🔐       |
| 9.5  | Implement `POST /api/api-keys` — create key, return raw key once                                 | 🔴         | 🔐 🧩    |
| 9.6  | Implement `GET /api/api-keys` — list keys (no raw key values, show label/scopes/last-used)       | 🟡         | 🧩       |
| 9.7  | Implement `DELETE /api/api-keys/[id]` — revoke key by setting `revokedAt`                        | 🟡         | 🧩       |
| 9.8  | Update `withApiGuard` to track `lastUsedAt` on successful API key auth                           | 🟡         | 🔐       |
| 9.9  | Build API key management UI — list keys, create key (show raw key once), revoke                  | 🟡         | 🎨       |
| 9.10 | Build `apps/cli` as a Node.js CLI tool — authenticate with API key from env/config file          | 🟡         | 🖥️       |
| 9.11 | Implement `cli taxila list` command                                                              | 🟡         | 🖥️       |
| 9.12 | Implement `cli taxila create` command (from stdin or file)                                       | 🟡         | 🖥️       |
| 9.13 | Implement `cli chat` command with streaming output to terminal                                   | 🔴         | 🖥️ 🤖    |
| 9.14 | Document CLI usage in README                                                                     | 🟢         |          |

**Phase 9 Exit Criteria:** You can generate an API key in the UI, set it as an env var, and run `cli taxila list` and `cli chat` from your terminal.

---
