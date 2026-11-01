---
publish: true
id: plan.backlogged-unplanned
title: Backlogged / Unplanned
created: 2026-09-19
updated: 2026-10-24
kind: plan
version: 1.2.0
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

**Why deferred:** Explicitly out of MVP scope per the PRD. Tracked as PM.9 in [[#B9 — Post-MVP]].

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
