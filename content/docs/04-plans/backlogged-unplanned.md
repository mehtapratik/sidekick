---
id: plan.backlogged-unplanned
created: 2026-09-19
kind: plan
version: 1.0.0
status: deferred
tags:
   - plan
   - living-plan
   - backlog
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

**Why deferred:** Explicitly out of MVP scope per the PRD. Listed in the Post-MVP phase (PM.9).
