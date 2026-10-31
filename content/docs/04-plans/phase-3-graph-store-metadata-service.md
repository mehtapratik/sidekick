---
publish: true
id: plan.phase-3-graph-store-metadata-service
created: 2026-09-19
updated: 2026-10-31
kind: plan
version: 1.0.3
tags:
   - plan
   - living-plan
   - phase-3
   - api-guard
   - rls
   - postgresql
   - api
   - offline
   - graph
status: planned
depends_on:
   - "[[04-plans/phase-1-1-db-level-rls-soft-delete-enforcement-complete]]"
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete]]"
---

> **Milestone:** The cross-feature relationship and metadata layer is live (architecture §5.3). Any entity can be linked to any other entity and tagged — the "power of synergies" substrate every module builds on. This is also the proof-of-architecture vertical: schema → migration → RLS → repository → guarded API.
> **Learning payoff:** Graph modeling in relational databases, recursive CTEs, polymorphic references, designing a core service that stays feature-agnostic.

| #   | Task                                                                                                                                      | Complexity | Learning |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 3.1 | Add `entityType` registration to `FeatureManifest` in `packages/features-registry` — the registry becomes the entity-type ledger          | 🟡         | 📦       |
| 3.2 | Define `edges` schema in `packages/core` — `id`, `userId`, `fromId`, `fromType`, `toId`, `toType`, `relation`, timestamps (syncable)      | 🔴         | 🗄️       |
| 3.3 | Define `tags` and `entity_tags` schemas in `packages/core` (syncable)                                                                     | 🟡         | 🗄️       |
| 3.4 | Migration: RLS (combined user-isolation + soft-delete pattern from Phase 1.1) + trigger bindings on all three tables                      | 🔴         | 🔐 🗄️    |
| 3.5 | Implement `GraphRepository` in `packages/core` — the ONLY access path: `link()`, `unlink()`, `neighbors()`, `tag()`, `untag()`, `byTag()` | 🔴         | 🗄️       |
| 3.6 | Implement traversal query with a recursive CTE — e.g., `related(entityId, depth)`                                                         | 🔴         | 🗄️       |
| 3.7 | API routes `/api/graph/*` and `/api/tags/*` using `withApiGuard`                                                                          | 🟡         | 🧩 🔐    |
| 3.8 | Validate `fromType`/`toType` against registered entity types at the repository boundary                                                   | 🟡         | 📦       |
| 3.9 | Manually test: create edges/tags via API, verify RLS isolation and soft-delete behavior                                                   | 🟢         |          |

**Phase 3 Exit Criteria:** Entities can be linked and tagged through guarded APIs. `GraphRepository` is the sole access path. Entity types are registered in the feature registry. All graph data is user-isolated and soft-deletable.

> [!note]
> **No graph database.** This is a graph _pattern_ on plain Postgres — sufficient at MVP scale. If Sidekick grows to hundreds/thousands of users, `GraphRepository` is the swap boundary for a dedicated graph engine. See architecture §5.3.

---

## Handover from system design

> [!note]
> The task table above predates the Synergy PRD and is rewritten as lessons after the system-design session. These items come out of that session and must become tasks.

- **Layer folders and the platform layer, in 3a** ([[06-decisions/technical/platform-layer|decision]], [[03-system-design/non-functional/monorepo/dependency-flow|dependency flow]] 1.3.0, [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]] 2.2.0):
   - Move `core`, `ui` and `copy` into `packages/foundation/` with `git mv`. Package names stay, so no imports change. Fix the paths that depend on depth: the three `tsconfig.json` `extends` (`../../../tsconfig.base.json`), core's `db:generate` and `db:migrate` scripts (`../../../.env.local`), the `packages/core/…` and `packages/ui/…` file globs in `eslint.config.js`, `.prettierignore` and the comment in `.env.example`. Reinstall so the lockfile follows.
   - Create `packages/platform/synergy`. Glob `packages/foundation/*`, `packages/platform/*` and `packages/features/*` in `pnpm-workspace.yaml`, and add the same folders to the import resolver's `project` list.
   - In `eslint.config.js`, add the `platform` and `foundation` element types, remove the `packages/*` catch-all, and turn on boundaries' unknown-files rule (check its v7 name) so a package in no layer fails lint. Policies: app, registry, feature and ops may import platform; platform may import only foundation; platform packages may not import each other.
   - Prove it through `pnpm lint` inside a package: one allowed import, one refused import, and one package in no layer that fails.
   - Verify the move the way things really run: `pnpm turbo run build lint test --force`, the test-database script and `pnpm db:migrate`.
   - After the move, update the live docs that name the old paths (the Synergy overview, testing layers, Lexicon highlighting, centralized copy, ESLint best-practice rules, shared tsconfig, TypeScript hoisting, the agent guide), and add a post note to the Phase 2 walkthrough. Finished walkthroughs keep their old paths.
- **Per-package migrations.** `pnpm db:migrate` runs `core`, then platform, then features and ops, each with its own Drizzle config and migrations table.
- **`provider`, not `module`,** in the entity index schema and every API field.
- **Links and mentions** ([[06-decisions/technical/mentions-and-link-lifetime|decision]]): `cited` and `mentioned` booleans on relationships, tombstone when both are false; display type stored per mention; the outgoing-reference roll-up on an entity's read response.
- **Anchors** ([[06-decisions/technical/anchors-in-content|decision]]): `to_anchor` as id plus quote, no `from_anchor`, a `(to_id, to_anchor_id)` index, and the provider save call reporting the current sets of block and anchor ids and mentioned relationship ids (built with `extractRefs`). Synergy keeps them in the `entity_anchors` and `entity_mentions` tables and computes the difference. Mock note bodies are minimal Tiptap JSON so tests can remove anchors and mentions.
- **Editor order:** passages need Tiptap, planned for Phase 5, while Taxila's passages are planned for Phase 4. Move the shared editor ahead of Taxila's passages, or move the passages to Phase 5.
- **Store choices** ([[06-decisions/technical/synergy-store-choices|decision]]): a test of the cycle check on a large synthetic graph, to decide whether a closure table is ever needed; `simple` full-text plus `pg_trgm` on display names; no outbox pruning job until the first reader.
- **Testing** ([[03-system-design/non-functional/testing/testing-layers|testing layers]]): integration tests through the guarded API are the main seam; the Rich Live Link component is tested in Vitest browser mode with Testing Library and MSW. Visual regression waits for the design system.
- **Keys, never copy:** Synergy stores and returns keys only (provider, type, relation-type key and inverse key, statuses, states, error codes); every label, including the Rich Live Link's text, comes from `packages/copy`. A test asserts that API responses carry no label text.
- **React as a peer dependency** ([[06-decisions/technical/react-as-peer-dependency|decision]]): add a pnpm catalog for `react`, `react-dom` and `@types/react`; `apps/web` uses `catalog:`; `@sidekick/ui` and `@sidekick/synergy` list React as a peer (and dev) dependency; check that `pnpm why react` resolves to one version.
- **Anchor receipt and freshness:** link create (and a save that creates links) returns `{ targetId, contentSeq, anchor }` per passage target; `GET /api/synergy/entities/:id` honours `If-None-Match` and answers 304. The "Page updated" banner (poll on focus and every 30 s while visible, `BroadcastChannel` between tabs) is built with the shared editor, not in Phase 3.
- **`content_seq`** on the entity index ([[06-decisions/technical/content-sequence|decision]]): the stale-write check (`stale_content`), the ETag and the render cache key. An anchor write moves it, never the version or revision. The editor lesson adds the automatic merge on 409 (fetch, copy in missing anchors, save again).
- **Lock first:** every Synergy write takes `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))` before anything else.
- **Restore checks:** restore, undo and relink re-run the delete block and cycle check and fail with `restore_conflict`; tombstones carry `deletion_batch_id`.
- **Tombstones** ([[06-decisions/technical/tombstone-visibility|decision]]): Synergy's RLS compares only `user_id`, the update trigger lets a restore through, the outbox and idempotency keys are hard-deleted. Follow-up outside Phase 3 lessons: revise `row-level-security.md` and `soft-delete-support.md`.
- **List links:** `type` NOT NULL with a seeded `untyped`, a `role` column (`solo`, `list`, `member`) in the composite FK, relation types keyed by `source_key` and `target_key`, lexorank positions with a unique `(parent_id, position)`.
- **Supersede:** `superseded-by` from the old entity to each replacement, a reference, any number of successors.
- **API:** the endpoint table and error-to-HTTP map in the overview, including `POST /api/synergy/links/resolve`. Freeze the resolved-link schema in zod in `@sidekick/synergy/contracts`, and ship `/server` (with `server-only`), `/react` (renders on the server and in the browser) and `/contracts` entry points.
- **Outbox:** store `pg_current_xact_id()` on every row; every event type from the overview; a read-only consumer role.
- **Race tests with two connections:** an anchor added while the target is open, a delete racing a new reference, a restore after the graph changed. Plus a test pinning spec story 71 (trigram `word_similarity`).
- **Design overview:** [[03-system-design/functional-design/04-synergy/00-overview|Synergy]] 1.1.0 (packages and entry points, type registration, tables, tombstones, write and read paths, API).
