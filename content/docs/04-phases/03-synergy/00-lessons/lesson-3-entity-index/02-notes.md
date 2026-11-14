---
publish: false
id: notes.phase-3.lesson-3
title: "Synergy Lesson 3 Notes: Entity Index and Version Log"
created: 2026-11-14
updated: 2026-11-14
kind: notes
version: 1.0.0
tags:
   - phase-3
   - synergy
   - database
   - rls
   - postgresql
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-3-entity-index/00-brief]]"
---

These notes record what lesson 3 taught: the mental models, Pratik's questions and their answers, the surprises and the corrections. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-3-entity-index/01-walkthrough|the walkthrough]].

## Mental models

- **Type versus kind** (Pratik asked which word the project uses). Both, with different meanings, and the docs are consistent. A **type** is an open vocabulary that is registered or stored as rows: an entity's type (`note`), a relation type (`cites`). A **kind** is a small fixed set built into the code that changes behaviour: a relation type's kind (reference or association), the three kinds of mention, the actor kind. Recorded in the glossary ([[07-glossary/kind|Kind]]).
- **Open sets stay out of the database's CHECKs.** Pratik asked whether `provider` and `type` should be constant arrays like `ACTOR_KINDS`. No: providers own them, so a CHECK would change Synergy and need a migration for every new type, and Synergy would know its providers by name, upside down from the dependency direction. Lesson 4's registry hands Synergy the map; the repository checks each write against it.
- **`user_id` and `actor_id` answer different questions** (Pratik asked whether `user_id` should become `actor_id` to trace bots and agents). `user_id` is whose data it is: RLS and the lock use it, and it never changes. `actor_kind` and `actor_id` are who made the last write. The full history is `version_log` per bump and, from lesson 5, an outbox event per write, each with its actor. A batch job is `system` when it's Sidekick's own housekeeping, `api_key` when it's the user's job run with a key, and `agent` for an AI working for the user; `automation` is one word and one regenerated CHECK away if user automations become their own thing.
- **`edited_at` is about what changed, not who changed it** (correcting Pratik's first reading: "touched directly or indirectly by the user"). It moves only with author content, with the version or revision. A user's own status change moves only `updated_at`; an agent rewriting the body moves `edited_at`; another entity's link adding an anchor moves `content_seq` and `updated_at` but not `edited_at`.
- **RLS is a condition Postgres adds to every query.** `USING` filters what a query sees (invisible, not an error); `WITH CHECK` filters what it writes (an error). `withRLS` sets `app.current_user_id` local to its transaction. After the transaction ends, the pooled connection reads the setting back as `''`, not NULL, so the policy wraps it in `nullif` before casting; `current_setting(…, true)` returns NULL on a connection that never set it.
- **An advisory lock is a number only our code gives meaning to.** `_xact_` releases it at commit or rollback, which matters on a transaction pooler that hands one connection to many requests. Collisions between two users' hashes only make them wait for each other.
- **The race the lock prevents** (Pratik: "essentially a race condition?"). Right. It isn't only a multi-user problem: one person has tabs, devices and later agents writing as them. RLS confines every conflict to one user's data, which is why one lock per user is enough.
- **Shared workspaces would need finer locks** (Pratik: a law firm sharing one workspace, hundreds of writers through one lock?). One lock per workspace would queue everyone. Instead: lock the rows involved (a delete takes its index row `FOR UPDATE`, a link takes its target `FOR SHARE`), in a fixed order by id; the cycle check, which follows a path across many entities, would need `SERIALIZABLE` with retries or a workspace lock just for reference creates. Workspaces would also need `workspace_id` everywhere, membership policies with roles, and a data migration. What already helps: one policy helper, the user in two helpers, the repository as the only path, and provenance separating who acted from whose it is. Not built; recorded as backlog item B13.
- **The lock must come first in the whole transaction, not just in Synergy** (from Pratik's idea to put the lock in `withRLS`). A provider writes its row before calling Synergy, so in lesson 10 two tabs could deadlock:

   | Time | Tab 1: save note N                                                        | Tab 2: link plan P to a passage in N                                                |
   | ---- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
   | 1    | `UPDATE taxila.notes … WHERE id = N`: holds N's row lock                  |                                                                                     |
   | 2    |                                                                           | `UPDATE war_room.plans … WHERE id = P`                                              |
   | 3    |                                                                           | Synergy's link create takes the user lock                                          |
   | 4    | Synergy's save asks for the user lock: waits for tab 2                    |                                                                                     |
   | 5    |                                                                           | Synergy calls Taxila's `addAnchor`: `UPDATE taxila.notes … WHERE id = N`: waits for tab 1 |
   | 6    | Postgres detects the cycle and aborts one transaction (*deadlock detected*) |                                                                                     |

   The two tabs take the same two locks in opposite orders. Taking the user lock at the start of every user write transaction (`withRLS(userId, fn, { lockUser: true })`, with the lock moved to core) makes the order the same everywhere. `withUserLock` stays in Synergy, because a flag can be forgotten and taking the lock twice in a transaction is free. Handed to lesson 4, where providers first write.
- **Optimistic concurrency with a counter.** The editor sends the `content_seq` it started from; one `UPDATE … WHERE content_seq = $base` checks and bumps together. An integer beats a timestamp (JavaScript has milliseconds, Postgres microseconds; `now()` is the transaction's start time, so two saves can share it).
- **Three delete models** (Pratik asked why core's corrected message says rows can't be updated, when restores exist). Hard delete: gone. Soft delete with tombstones hidden, the default for syncable tables: every query hides the row (D11), core's trigger freezes it, and it exists only so offline devices learn about the deletion; nothing restores it. Soft delete with tombstones visible: for restore, undo or a Trash, with a restore-aware trigger and a repository as the only path; Synergy's tables. So `restoreEntity` (lesson 11) is Synergy's, and the old "Restore it first" message promised something model 2 forbids. See [[03-system-design/non-functional/database/delete-models|Delete models]].
- **A drizzle-kit migration is three files**: the `.sql`, `meta/NNNN_snapshot.json` and its `_journal.json` entry. drizzle-kit generates from the newest snapshot; the migrator reads the journal.

## Pratik's design calls

- **`utcTimestamp`, `sqlList` and `tombstone`** in `columns.ts`, and **`increment`** for counter bumps (first put in core, moved to Synergy: everything `@sidekick/core/db` exports is public API).
- **A surrogate `id` on `version_log`** after weighing `(entity_id, version)` as the primary key (a primary key can't be partial; one `id` per row across Synergy).
- **`human`** as the actor kind.
- **`saveEntityContent`**, not `saveContent` or `updateEntity`: the entity noun, with a verb that says which update it is.
- **`withUserLock`** as a wrapper, and **`sidekick/require-user-lock`** to enforce it (the coach wrote the rule at Pratik's request).
- **Interfaces over inferred type aliases** (`EntityIndexRow`, `RlsTx`, `GetEntityOptions`) for compact tooltips, with the lint option that allows them.
- **Strict restore**, on the coach's recommendation.
- **Naming across layers**: a database row is `<Table>Row`, the contract keeps the plain noun (lesson 4's zod schemas), UI types are `<Component>Props`, and a mapper sits between row and contract. In [[08-ai-coding-harness/coding-standards|Coding standards]].

## Questions answered

- **Why `defaultRandom()` on `version_log` but not `entity_index`?** Client-generated ids are for rows a client creates and refers to before the server sees them (an offline create, a retry). Only Synergy writes log rows, inside the save, and nothing refers to them; `RETURNING id` hands back the id if it's ever needed.
- **Why doesn't registering an entity write a `version_log` row?** The log records bumps with their notes, and version 1 has neither. Logging version 1 would make the log describe versions rather than changes; a fair choice, not taken.
- **Why `?? null` in some columns?** Drizzle reads `undefined` as "leave the column out" and `null` as "write NULL". In an update, leaving out keeps the old value. It caught a real bug: `actorId` passed bare in `saveEntityContent`'s update would have kept a human's id under `actor_kind = 'system'`.
- **Why `entity ?? undefined`?** It isn't needed: a missing first row already destructures to `undefined`. Columns stay `null` inside rows, because that's how the database reports an empty column (the project prefers `undefined` in its own code).
- **A TypeScript `enum` for `ActorKind`?** No: a string-literal union is checked and autocompleted the same, `enum` emits runtime code that Node's type stripping rejects, and nothing in the repo uses one. A `const` object gives the dotted style if wanted.
- **A lint rule for strict restore?** The trigger stays, since it guards every writer (psql, ops scripts, other packages). The design-time guard is `restoreEntity(tx, id, actor)` taking no edit fields (lesson 11); a lint rule couldn't see inside a spread or a variable.
- **Is ESLint getting slow?** Our own rules cost almost nothing: on Synergy, `import-x/no-cycle` took 450 ms (67% of the run), the type-aware rules about 170 ms, `require-user-lock` 0.1 ms. The rules to watch resolve imports or need types. CI has no Turbo cache and lints everything every run.

## Surprises and corrections

- **A lost pair of quotes** in the policy (`current_setting(app.current_user_id, true)`) typechecks and lints; only the migration would have failed, rolling back `0001` with it. SQL inside a string is invisible to TypeScript.
- **Half-deleting a migration** (only the `.sql`) made the regenerate write an `ALTER POLICY` against a policy that never existed, and left a journal entry for a missing file.
- **A self-import** (`import { versionLog } from './version-log'` inside `version-log.ts`) caused two TypeScript errors and `import-x/no-self-import`.
- **`id: never`** makes a property required with no possible value; `id?: never` means "must be left out".
- **An editor's file move** added Synergy's `utils.ts` to core's `tsconfig.json` `include`, crossing the dependency direction. Reverted.
- **Tests sharing a row only pass in one order.** The strict-restore case reused a row an earlier test had already restored.
- **Drizzle wraps database errors** (`DrizzleQueryError`, *Failed query: …*), with the trigger's message on `cause`.
- **The editor's ESLint server keeps the old plugin** after a rebuild and silently stops linting files a new rule covers. Documented in [[08-ai-coding-harness/commands-and-environment|Commands and environment]].
- **A core migration generated into Synergy** with the wrong `--filter`, and a core comment placed in `features/entitlements.ts` instead of the schema file. Both caught in review.

## Owed after this lesson

- A repo-wide JSDoc sweep: every exported member gets a short line saying what it does (Pratik, 2026-11-14), then the standard for all lessons.
- A discussion, then possibly a PR, on formatting SQL (`prettier-plugin-embed`, `prettier-plugin-sql`).
