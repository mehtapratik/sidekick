---
publish: false
id: notes.phase-3.lesson-5
title: "Synergy Lesson 5 Notes: Outbox, Status and Versions"
created: 2026-11-24
updated: 2026-11-24
kind: notes
version: 1.0.0
tags:
   - phase-3
   - synergy
   - database
   - postgresql
   - rls
   - api
---

These notes record what lesson 5 taught: the mental models, Pratik's design calls, the questions and their answers, and the surprises. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-5-outbox/01-walkthrough|the walkthrough]].

## Mental models

- **The outbox is a delivery queue,** not a notification table (people read that, until they dismiss it) and not an event log (people ask it "who did what", forever). Programs read the outbox, and an event lives until every reader has processed it, plus 90 days. Lasting history is `version_log` and the provenance columns.
- **Same transaction or nothing.** "Save, then call search" loses the event when the call fails or the server stops in between, and nothing shows it's missing. Writing the event with the change makes both commit or neither.
- **The tables are the truth; the outbox is a to-do list.** Readers are server programs that run all the time, not devices. A phone renames a note; search processes the event in seconds; 100 days later the desktop reads the tables and sees the new name. A pruned event can't lose data.
- **Readers keep bookmarks.** Pruning deletes what is behind every bookmark and older than 90 days. A broken reader holds everything after its bookmark (on purpose), so its lag needs an alert, and retiring a reader is a deliberate migration or `ops` step. Kafka does the opposite: it deletes by age, and a reader that falls behind rebuilds.
- **Transaction ids aren't commit order.** A transaction gets its id at its first write. Transaction 100 can commit after 101, the same gap a `bigserial` has. A reader reads in `(xact_id, id)` order and only below `pg_snapshot_xmin`, the oldest transaction still running. The design docs claimed `xact_id` alone was commit order; corrected in this lesson.
- **The identity `id`** is one sequence for the whole table: it never restarts, rolled-back transactions leave gaps, and it is exact order only inside one transaction.
- **Privilege first, then policy.** Postgres asks "may this role run this command on this table?" (`GRANT`/`REVOKE`; an error if not), then "which rows?" (RLS; silently none if no policy allows). A missing policy denies. `WITH CHECK` governs rows written, `USING` rows read.
- **Why the user lock exists, and why it comes first.** It exists for check-then-write races: tab A deletes a note after checking nothing references it, tab B links to it after checking it's alive, and both commit (D202). Taking it first gives every request one lock order, so no deadlock. A deadlock doesn't hang forever: Postgres kills one transaction after about a second, which is still a failed request.
- **The lock on `recordEvent`** doesn't protect the outbox (nothing reads it, inserts don't conflict). It's there because every repository write takes it (lint), and the caller already holds it.
- **An ETag answers "is my cached copy current?"; `content_seq` answers "did the content change since my editor loaded it?"** A hash moves on renames, status changes and tags, so as a stale-write token it would refuse saves nobody needed to refuse. A content-only hash would be possible but is the wrong tool: Synergy doesn't hold the content, the hashing recipe could never change, it needs a read and a hash under the lock, and it misses A → B → A.
- **Opaque cursors** are a coat-check ticket: the client hands it back and never builds one, so the server can change what's inside. A client that built `?before=27` would break silently the day the order needs two values. Base64url isn't secret; RLS is the security.
- **Cursor, not offset:** "versions below 27" means the same thing however many rows were added since, and the database starts from the index.
- **A data migration** changes rows, not the schema, so drizzle-kit can't generate it (`--custom`). It stays a migration even when only one database needs it: recorded, reviewed, run once per database, and present in a staging copy restored from a backup. An `ops` script is for one-off operations, such as granting a feature.
- **User, actor, caller.** The user is the account that owns the data (`user_id`, RLS, the lock). The actor is who made the write for that user: `human`, `agent`, `api_key` or `system`. The caller is how a request proved who it is: a session or an API key. An agent tidying your notes at night: user you, actor the agent, no caller. "End user" adds nothing.
- **Kind or type.** A kind is a fixed set in code with a CHECK, where each value changes behaviour (`actor_kind`, outbox event kinds); a type is an open vocabulary registered as data (an entity's `type`).

## Pratik's design calls

- **Plan first.** From step 2 on, Pratik says how a step will be done, the coach corrects the plan, then Pratik writes it.
- **Event kinds, not types,** per the glossary's rule.
- **The reader role** named for what it does (`outbox_reader`), with RLS opened at table level by a policy, not by `BYPASSRLS`.
- **Base and generic interfaces for events** (`OutboxEventBase`, `OutboxEventOf<Kind>`), with the union derived from the kinds.
- **Option B for the ETag:** a hash of the response (D271).
- **`toActorColumns`**, Pratik's idea to centralize the actor's database shape, named for what it returns.
- **`EXPLICIT_ENTITY_STATUSES`:** set by a direct request; `superseded` is a side effect of a supersede.
- **Shared handler pieces in `api/entity.ts`,** after asking why a new file was needed.
- **Version 1 logged at creation,** after asking how a history UI would show the creation; the backfill stays a migration.
- **One more assertion:** the reactivation also moves no counter.
- **File names follow a rule** (plural for operations over rows, singular for a concept), recorded in the architecture invariants rather than renaming files.

## Questions answered

- **What's an outbox?** A delivery queue (above).
- **How do we know every reader has processed an event?** Bookmarks; the slowest one is the line.
- **A reader that dies without deregistering?** It holds the outbox on purpose; a lag alert finds it; retiring it is a deliberate step.
- **Renamed on the phone, desktop after 100 days?** It sees the new name, from the tables.
- **Does a reader run when a user logs in?** No: it runs on a schedule (polling, first) or on a signal (`LISTEN/NOTIFY`, a queue), for every user.
- **Does `id` restart per transaction?** No.
- **Do we need a policy for the reader?** Yes: a missing policy denies.
- **Is there code to learn the test login from?** `with-test-db.sh`'s `app_runtime` login and `createTestRuntimeDb`.
- **Will deprecate and supersede be separate functions?** One `setEntityStatus` for the explicit statuses; lesson 8's supersede sets `superseded` and records the same event.
- **A global "utils" package, `not()`, named booleans, a mapper for the actor?** A package every layer imports is foundation, and that exists; `not()` breaks TypeScript's narrowing; name a condition only when it has several parts or hides a meaning; the actor mapper was right, in Synergy.
- **Should "user" mean anyone making a request?** No: those are actors working for a user (glossary pages added).
- **Why a new handler file when `api/entity.ts` exists?** That file was the mapper; the real problem was shared pieces inside a handler's file.
- **Do we still need `content_seq`?** Yes (above). **Isn't `updated_at` alone enough for an ETag?** Not unique: transaction start time, cut to milliseconds.
- **Global page-size constants?** No: they'd tie unrelated lists together. Share the paging mechanism once a second paged list exists.
- **Can `listVersions` returning nothing replace `getEntity`?** No: a deleted entity keeps its version rows, an empty later page isn't a missing entity, and it would lean on an invariant kept elsewhere.
- **Run the backfill by hand in Supabase?** No (above).
- **One naming form for files?** No; there's a rule behind the names.

## Surprises and corrections

- **The design docs overstated `xact_id`**: storing it isn't commit order on its own.
- **The catalog test assumed every policy has a `USING`** and crashed on the outbox's insert-only policy.
- **Editor auto-imports** again: a package importing itself by its public name, a file importing itself.
- **Bugs caught at review:** a role check against the wrong name (the role was never created), `GRANT … IN SCHEMA` on one table, a lost `\` that would have stopped every integration run, a hand-written union that could drift, a route outside its `[id]` folder (Next.js's generated types caught it), a stray SQL alias.
- **drizzle-kit hides migration errors:** a failed migrate printed only a harmless NOTICE and exit 1. Suspect the newest migration; to see Postgres's message, run its statements in the Supabase SQL editor between `BEGIN;` and `ROLLBACK;`. The coach first suggested running it through `with-test-db.sh`, which can't work (the wrapper migrates first), and corrected it.
- **The coach invented a "lesson 9 history UI"** that no lesson in Phase 3a builds, and cited D209 for the versions route's entity check when the real reason was a misleading empty list. Both corrected in the thread.
- **The coach's first check raced the editor's save** and read an empty file.

## Owed after this lesson

- **Lesson 6:** record the link events through `recordEvent` (add each kind to `OUTBOX_EVENT_KINDS` and `OutboxPayloads`); extract the paging mechanism once backlinks are the second paged list; idempotency keys for creates (an existing id still answers 500).
- **Lesson 7:** a test that a roll-up change gives a new ETag; D271 already covers it.
- **Lesson 8:** refuse setting a superseded entity back to `active` by hand (B23).
- **The first outbox reader:** bookmarks, pruning and a lag alert (B24).
- **Still open from lesson 4:** the guard's error-code style (B15).
