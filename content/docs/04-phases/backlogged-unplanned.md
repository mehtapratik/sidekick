---
publish: true
id: plan.backlogged-unplanned
title: Backlogged / Unplanned
created: 2026-09-19
updated: 2026-11-22
kind: plan
version: 1.5.0
status: deferred
tags:
   - plan
   - living-plan
   - backlog
   - feature-system
   - taxila
   - zinsser
   - alter-ego
   - parrot
   - rls
   - supabase
---

These items are known, intentional gaps — deferred, not forgotten.

### B1 — Hard-Delete Erasure Job (GDPR / Account Deletion)

**What:** A scheduled or on-demand job that permanently erases user data rows after soft-delete, to satisfy GDPR right-to-erasure or account deletion requests.

**Why deferred:** No external users yet. Compliance obligation does not apply at MVP scale. Tombstones exist via soft-delete; the erasure step is not yet wired up.

**Why it cannot use conventional channels:**

- `DATABASE_URL` connects as `app_runtime` — hard deletes are blocked by the BEFORE DELETE trigger.
- `DATABASE_DIRECT_URL` is reserved for schema migrations — using it for runtime data operations conflates two distinct concerns.
- `createAdminClient().from(...).delete()` bypasses RLS but not triggers — still rejected.

**What it needs:** A dedicated pathway that opens an explicit transaction, sets `SET LOCAL app.allow_hard_delete = 'true'`, executes targeted DELETEs, and records an audit event.

**Options to evaluate when the time comes:**

- **Supabase `pg_cron`** — a scheduled SQL job running inside the database itself, no external process needed
- **Edge Function with privileged connection** — invoked on-demand via a secure internal endpoint, direct database access
- **Dedicated admin Drizzle client** in `packages/core` scoped exclusively to erasure operations, distinct from the runtime `db` instance

**When to implement:** When onboarding external users, or when a compliance review requires a documented erasure process.

### B2 — Zinsser AI Coach (after Phase 6)

**What:** The AI half of Zinsser: a style profile trained on the user's own drafts, point-by-point feedback, repeated-mistake tracking, and "release-ready" copy that sounds like the user — with the coaching goal of needing fewer corrections over time.

**Why deferred:** Depends on the AI foundation (model router, embeddings, structured responses) from Phase 6. The editor (Phase 5) delivers standalone value first.

**When to implement:** After Phase 6, once Alter Ego has proven the AI patterns. Write the Zinsser coach section of the PRD first.

### B3 — Bookmarks / Recipes / Budget (rejected as standalone features, 2026-07-27)

**What:** Three content features from the original plan, cut during the PRD realignment.

- **Bookmarks** — absorbed into Taxila: a bookmark is a knowledge source of `sourceType: 'link'`. Not coming back as a standalone feature.
- **Recipes / Budget** — candidates for future "minions" (PRD: build-vs-buy consolidation features). Revive only if a PRD is written for them.

### B4 — Parrot (voice dictation)

**What:** Voice dictation with gesture support for punctuation and formatting — accent-friendly, replacing $100+/yr subscription services.

**Why deferred:** Explicitly out of MVP scope per the PRD. Tracked as PM.9 in [[#B9 — Post-MVP: Factory extensions, bots and agents|B9 — Post-MVP]].

### B5 — Feature rollout gating

**What:** A switch that decides whether a feature is ready to be seen at all (for everyone, a beta group or a share of users) before anyone's entitlement is checked. Hand-rolled at first; commercial flag services (or the Vercel Flags SDK) are an option once incremental rollout is needed.

**Why deferred:** Decided in Phase 2 lesson 1 (2026-10-18). The feature registry is only a catalog of what exists and changes with a deploy; rollout changes without one, so it doesn't belong in `FeatureManifest`. Entitlements (who is provisioned) still ship in Phase 2.

**When to implement:** Post-MVP. It becomes a check in `withApiGuard` that runs before the entitlement check.

### B6 — Ops command follow-ups

**What:** Three additions to `packages/ops` ([[04-phases/02-gatekeeper/01-contracts#Ops|contracts]]), each waiting on its own trigger:

- **A `revoke` command** (`entitlements revoke`), the mirror of `entitlements grant`. Until then, disabling a feature is a `DELETE` on `user_feature_entitlements` with the privileged role.
- **A dispatcher**, `pnpm ops <noun> <verb>` with `--help`, wrapping the existing scripts rather than rewriting them.
- **A `--target` check**, so a script states which database it means to write and refuses to run against any other.

**Why deferred:** Decided in Phase 2 lesson 7 (2026-10-24). One command doesn't need a dispatcher, nothing needs revoking while `ALL_FEATURES` is empty, and there's one Supabase project, so a script has no second environment to confuse with dev.

**When to implement:** The dispatcher with the second `ops` command (`revoke` is the likely one, once Phase 4 registers Taxila). The `--target` check before any `ops` script runs against a second environment, and with the first break-glass script at the latest.

### B7 — Public liveness probe

**What:** An unauthenticated endpoint a host or uptime monitor can call. `/api/health` requires a session, so it can't serve as one.

**Why deferred:** Decided in Phase 2 lesson 6 (2026-10-23). Every route is guarded by construction, and lint rejects anything else. A public probe means a deliberate exception to `sidekick/require-api-guard`: a security decision for Pratik, recorded in [[04-phases/02-gatekeeper/01-contracts]] with its reason and set in `eslint.config.js`, never an inline disable.

**When to implement:** When a host or monitoring service needs it, at the latest with [[04-phases/10-watchtower/00-plan|Phase 10]].

### B8 — Faster session checks

**What:** Verify the session with `supabase.auth.getClaims()`, which checks the JWT locally against Supabase's signing keys, instead of `getUser()`, which asks Supabase Auth on every request.

**Why deferred:** Found in Phase 2 lesson 6 (2026-10-23). It's the known latency lever for signed-in requests, but a revoked session would keep working until its access token expires. Latency measured from a laptop isn't a reason to take that trade; the proxy's own `getUser()` call on `/api` is part of the same question.

**When to implement:** When production latency, measured next to the database, shows the Auth round trip matters.

### B9 — Post-MVP: Factory extensions, bots and agents

**What:** Factory grows beyond push-button workflows: triggered and recurring automations, inbox management and IoT integrations. External agents interact with your data through the public API. Parrot (B4) is the last item.

**Why deferred:** Exploratory and open-ended; it follows the MVP ([[04-phases/07-war-room/00-plan|War Room]] ships only push-button Factory workflows).

**When to implement:** When you are ready; no phase depends on it. Learning payoff: agent interoperability, webhook-driven automation, workflow design patterns.

| #    | Task                                                                                             | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | -------- |
| PM.1 | Extend the Factory `workflows` schema with trigger types (schedule, event) beyond manual buttons | 🔴         | 🗄️       |
| PM.2 | Implement a simple recurring workflow — e.g., weekly digest of knowledge sources emailed to self | 🟡         | 🧩       |
| PM.3 | Add webhook ingest endpoint — external services can push events to the app                       | 🔴         | 🔐 🧩    |
| PM.4 | Document the public API surface for agents — OpenAPI spec or equivalent                          | 🟡         | 🖥️       |
| PM.5 | Evaluate Inngest for durable workflows if complexity warrants it                                 | 🟡         |          |
| PM.6 | Add agent-friendly scoped API keys for automation use cases                                      | 🟡         | 🔐       |
| PM.7 | Inbox management automations (email/message triage) per the Factory PRD                          | 🔴         | 🧩       |
| PM.8 | IoT integrations (blinds, garage door) per the Factory PRD                                       | 🔴         | 🧩       |
| PM.9 | **Parrot** — voice dictation with gesture support for punctuation/formatting (own PRD first)     | 🔴         | 📱       |

### B10 — CI runs only what a PR affects

**What:** CI's `checks` job runs `turbo run … --affected`, so Turbo compares the PR with `main` and runs only the tasks of changed packages and their dependents. A content-only PR then builds just the site (with its gates) and runs `check:content`; a code PR runs what it touched. `checks` stays the one required job.

**Why deferred:** Found in Synergy lesson 0 (2026-11-11). CI has no Turbo cache, so every PR lints, type-checks, tests and builds everything. Splitting CI into a content pipeline and a code pipeline, or banning mixed PRs, was rejected: two required checks would block each other's PRs, and D229 wants code and its docs in one PR.

**When to implement:** When CI time on content PRs becomes annoying, or with the first feature package, whichever comes first.

### B12 — Too many `app`s in `apps/app/src/app`

**What:** Revisit the App's folder names. Next.js fixes the routes folder's name (`app`, at the package root or in `src/`), so the options are dropping `src/` (no fewer `app`s), renaming the package folder (against D214), or living with it.

**Why deferred:** Pratik, 2026-11-08, during the rename to `apps/app`: worth a decision, not in lesson 0.

**When to implement:** A future lesson that touches the App's structure, at the latest before Open House.

### B13 — Shared workspaces

**What:** Let several people share one Sidekick workspace (Pratik's example: attorneys at a law firm sharing knowledge). Every table gets a `workspace_id`; policies become "member of this workspace", with a membership table and a role per member (viewer, editor); one user lock per workspace would queue everyone, so writes lock the rows they touch (a delete takes its index row `FOR UPDATE`, a link its target `FOR SHARE`, in a fixed order) and the cycle check runs at `SERIALIZABLE` with retries or keeps a workspace lock for reference creates; a data migration gives each existing user a personal workspace.

**Why deferred:** Pratik asked during Synergy lesson 3 (2026-11-13). No PRD has it. What already helps: one RLS policy helper (`ownRowsPolicy`), the user in two helpers (`currentUserId`, the lock), the repository as the only path, and provenance separating who acted (`actor_id`) from whose data it is (`user_id`).

**When to implement:** When users ask for it; it gets its own decision and phase first.

### B14 — A central ownership function for RLS policies

**What:** Every policy calls one SQL function for its ownership check, `USING (app_owns_row(user_id) AND deleted_at IS NULL)`, so a single `CREATE OR REPLACE` changes ownership for every table. A TypeScript helper that writes each table's `pgPolicy` (`deleteModelPolicy(table, self, model)`, generalizing Synergy's `ownRowsPolicy`) was discussed alongside it.

**Why deferred:** [[D267]] (Synergy lesson 4, 2026-11-17). The check hasn't changed since Phase 1, the likely changes (sharing, workspaces, agents) differ per table, switching later costs the same, and a policy written out in its migration is easier to know. A procedure that writes policies from parameters was rejected outright: a rebuilt database would replay old migrations against its newest version. Core's catalog test is what catches a table missing its policy.

**When to implement:** When an ownership rule must change across most tables at once, or the same change is about to be made to three or more tables' policies.

### B15 — One style for every error response

**What:** `withApiGuard`'s own errors are `{ error, code }` with an English `error` and an UPPER_CASE code (`FEATURE_DISABLED`), while every other error is `{ code }` in snake_case (`stale_content`, `validation_failed`). Core's codes also have no inventory like Synergy's `SYNERGY_ERROR_CODE`. Also discussed: an `HttpErrorStatus` type (statuses of 400 and above) so `errorResponse` can't be given a 200.

**Why deferred:** Raised in Synergy lesson 4 (2026-11-20). No client reads error codes yet, and changing the guard's codes changes a contract Phase 2 documented.

**When to implement:** Before the first client reads error codes (the 3b playground or lesson I1, whichever comes first), as one decision for every package.

### B16 — Writes that survive an error response

**What:** An explicit opt-in for a handler write that must commit even though the response is an error: a failed-attempt counter behind a 429, or an audit row for a denied request. Since [[D268]], any response of 400 or above rolls back the whole transaction.

**Why deferred:** Nothing needs it yet (Synergy lesson 4, 2026-11-19). The default must stay "an error changed nothing".

**When to implement:** With the first such write, likely API-key rate limiting in Phase 9: a guard option, or a write on its own connection.

### B17 — The API's own deployment

**What:** Move the API out of `apps/app` into its own app at its own address, so the UI is structurally just another client.

**Why deferred:** [[D270]] (Synergy lesson 4, 2026-11-20). It would cost cross-origin auth, a network hop for every Server Component that needs data, and two deployments that can drift, with no gain a user feels. [[D269]] already keeps the UI off the data layer, and handlers live in their packages, so a move is one line per route.

**When to implement:** At Phase 9 (Terminal), when the CLI and a public API need their own address and versioning, or earlier if the API must deploy, scale or run separately from the UI.

### B18 — A typed client for the API

**What:** One helper the App's client code uses for every call, such as `apiFetch(url, schema)`, which parses each response with its `/contracts` schema instead of trusting it, and handles conditional requests: it keeps each entity's ETag itself and fetches with `cache: 'no-store'` and its own `If-None-Match`, because the browser's HTTP cache otherwise turns a 304 into a 200. "Page updated" polls on focus, visibility and every 30 seconds and shows a banner, never an automatic reload ([[D210]]).

**Why deferred:** Discussed in Synergy lesson 4 (2026-11-20); no UI calls the API yet.

**When to implement:** With the first UI that calls the API (the 3b playground).

### B19 — Dates in the user's time zone

**What:** Server-rendered dates in the user's zone, so server and browser render the same time: the browser sets a time-zone cookie from `Intl`, a profile preference overrides it, and Vercel's `x-vercel-ip-timezone` covers the first request; next-intl's `timeZone` request setting takes it. Also: a calendar date (a task's due date) is a `date` column, not a timestamp, so "Friday" never becomes Thursday west of UTC. The API accepts only ISO 8601 with a zone and answers in UTC.

**Why deferred:** Discussed in Synergy lesson 4 (2026-11-19); nothing renders dates yet.

**When to implement:** Time zones with i18n in lesson I1; `date` columns with the first entity that has a due date (War Room, Phase 7).

### B20 — Validate large request bodies before the transaction

**What:** `parseRequestBody` runs inside the guard's transaction, under the user lock, so a slow or large body holds up the user's other writes. A route that accepts large bodies (uploads) should validate before the transaction opens.

**Why deferred:** Small JSON bodies parse in microseconds (Synergy lesson 4, 2026-11-18).

**When to implement:** With the first route that accepts large bodies.

### B21 — Test plumbing repeated per package

**What:** `signInAs` is copied into each package's `tests/helpers.ts` (the two sandbox providers and Synergy), because it is typed against core's Supabase client and `@sidekick/test-utils` imports no workspace package ([[D261]]). Route tests also rebuild each route's guard options by hand, which can drift from the route file.

**Why deferred:** Three small copies are cheaper than a new rule for test-utils (Synergy lesson 4, 2026-11-22).

**When to implement:** When a fourth package needs it, or if a route file's options drift from its tests: a test entry in core (`@sidekick/core/testing`), or route definitions exported from each package and mounted by the app.

### B22 — Feature names and descriptions in catalogs

**What:** A feature's `MANIFEST` holds its `name` and `description` as English strings, not keys in the feature's catalog, which every other user-visible word must be.

**Why deferred:** Only the ops grant script reads them today; no user sees them (Synergy lesson 4, 2026-11-15).

**When to implement:** When a screen first shows a feature's name or description, or in lesson I1 when catalogs arrive, whichever comes first.
