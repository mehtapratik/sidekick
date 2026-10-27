---
publish: true
id: prd.synergy.ticket-10
title: "Scope and phases"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: [01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12]
status: closed
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

Which decisions on this map land in Phase 3, which in the MVP and which later, and how the work breaks into phases. Closing this ticket clears the way to the PRD.

## Resolution: the cut (agreed 2026-10-27)

### The rule behind the cut

The test for every item is how much it costs to add later, not whether it is frontend or backend. Something that is cheap to add after the MVP can wait, wherever it lives: type icons, status pills, a bulk endpoint. Something that forces a migration of data real modules depend on, or a rewrite of components every module already uses, ships now even if nothing uses it yet: a missing column, a query that can't scale, a component that can't page. So the MVP can look primitive, but its foundations can't be.

### Backend foundations (from Phase 3)

Each of these is cheap to build now and expensive to retrofit.

**Data model**

1. **Every field the vision needs, from day one.** This covers the entity index (owner, module, type, title, status, version, revision, timestamps, tombstone), the version log (change notes), relationships (single and list, label, type, version snapshot, `from_anchor`, `to_anchor`), tags (with key, aliases and deprecation), and the relation-type vocabulary (with its inverse name and reference/association kind). Columns for later features, like anchors and the "allow references" setting, exist now even while unused. Adding a nullable column later is easy. Backfilling meaning into rows that were written without it is not.
2. **Provenance on every write.** Each write records who made it: a person, the system, an agent or an API key, and why. AI tag approval, "removed by system" revisions and any future audit all depend on it.
3. **Client-generated UUIDs, `updated_at` and soft delete on every table.** This is what lets the PWA in Phase 8 sync offline without redesigning the tables.

**Correctness**

4. **Rules live in the database, not only in code.** Foreign keys, unique constraints, a check constraint for the tag format, and one transaction for each rule that spans rows. "Block delete while referenced" and "reject cycles" run under a per-user lock in the same transaction as the write. Bots and agents call the API concurrently. A rule checked in app code alone breaks under a race.
5. **Optimistic concurrency.** An update carries the revision it started from, and a stale write gets 409. Two tabs, or a person and an agent, editing the same entity must not silently overwrite each other.

**Security**

6. **RLS on every table, comparing the uuid column directly** (`col = nullif(current_setting(...), '')::uuid`, never `col::text = ...`). The cast form converts every row's uuid to text, so Postgres can't use the uuid index and scans the whole table. The right form converts the setting once and lets the index find the user's rows directly. Every Synergy query filters by owner. **Phase 3 also fixes the existing policies** in sidekick migrations 0002 and 0007, which use the cast form today (Pratik, 2026-10-27).
7. **Locked, redacted and deleted states are decided on the server, before any resolver runs.** No content leaves a module the reader can't see.

**Scale**

8. **Indexes for every hot path.** Backlinks (`to_id`), outgoing links (`from_id`), list order (`parent_id, position`), by tag, by owner and status, and a trigram index on titles. Popular entities will have thousands of backlinks.
9. **Staleness is computed when it's read, never fanned out on write.** It comes from a join of the relationship's snapshot with the index row. Flagging every referencer when a popular entity changes turns one edit into thousands of writes. Post-MVP digests ("you reference stale or deprecated entries") fit this: the digest job is the reader and runs one indexed query per user. Instant alerts fan out asynchronously from the outbox, never inside the save.
10.   **Batched resolution.** A document with 50 links makes one resolver call per module (`resolveMany`), not 50. The resolver and renderer contracts take lists from the start.
11.   **Cache keys that carry the revision.** Rendered card and preview data is cached under (entity, revision, display type), and HTTP responses carry the revision as an ETag. A new revision means a new key, so invalidation is never a purge problem. The cache sits behind an interface: in-process or Postgres now, a shared cache (Redis) later without changing callers.
12.   **Cursor pagination on every list.** This covers backlinks, search, tags and the version log. Offset pagination collapses at the sizes Synergy is meant for.

**Change tracking**

13. **An outbox from day one.** Every change writes an event row in the same transaction: entity changed, version bumped, status changed, relationship created or deleted. Nothing consumes the outbox in Phase 3. Notifications, Factory automations, cache warming and search reindexing all start from it later, and an event log can't be reconstructed for writes that never recorded one.

**API**

14. **One public contract.** Typed request and response schemas, stable error codes (`delete_blocked` with the referencer count, `cycle`, `locked`) and idempotency keys on create, so a retried bot request doesn't link twice. Everything goes through `withApiGuard`, which also logs. Bulk endpoints can wait: adding them later changes nothing that exists.

### Frontend foundations (from Phase 3)

Styling can wait. These can't, because every module will build on the component's contract.

15. **Lists that page from the start.** Any list the component shows (backlinks, list-relationship members, search results) loads incrementally by cursor and can scroll to load more, with virtualization for long lists. A component built for "load everything" gets rewritten at the first popular entity.
16. **Async renderers with every state.** A renderer returns its content asynchronously, and the frame owns loading, error, empty, locked, redacted and deleted. The contract is `render(links) => Promise<ReactNode>`. A renderer with everything in hand returns straight away, one that needs data awaits it, and the component always awaits. A synchronous contract would force a signature change on every caller and renderer the first time one renderer needs a fetch.
17. **Batched fetching in the component.** Links on one page are collected, grouped by the module that owns them (Taxila, War Room, Alter Ego; note and task in Phase 3), and resolved in one request per module (pairs with essential 10). A plan page with 20 datums, 8 tasks and 2 chat sessions makes 3 calls, not 30. Fetching per link can't be fixed without changing how every caller mounts the component.
18. **Display type and states as props and data attributes.** The four display types and the states are explicit props, exposed to styling as attributes and tokens. That's what keeps icons, pills and hover cards purely additive later.
19. **Accessible semantics.** Real links, focus order, and a text equivalent for the `*`, `#` and dot marks. Retrofitting accessibility means touching every renderer.

### Phase 3: the substrate (in `packages/core`, proven by mock note and task modules)

**3a. Store and rules**

- Entity index, version log, relationships (single and list), relation vocabulary, tags with key:value, aliases and deprecation.
- Every backend foundation: RLS, constraints, provenance, outbox, indexes, concurrency.
- Rules: staleness snapshot, `*`/`#` derivation, delete blocked while referenced (references only), erasure override, no reference cycles, supersede marks the target, deleting a target block deletes the links into it (`to_anchor` stored, editor use comes later), revision bump on link removal.
- Repository as the only access path. Guarded API with the error codes and bulk endpoints.

**3b. Render and find**

- Resolver registry and renderer registry, both batched.
- The Rich Live Link component, MVP-complete in all four display types and every state, in plain text (no icons, no pills, no hover), built on the frontend foundations.
- Note and task renderers. Render cache.
- Backlinks API ("who references me").
- Search over title and metadata (type, status, tags, module), with filters and cursors.
- Exit: the integration tests in ticket 09, all through the public API.

### Rest of the MVP (lands with the modules that need it)

- **Rule for every module:** each entity type that can appear as a Rich Live Link (datum, narrative, plan, chat session, and so on) ships its own renderer, registered for any consumer that needs to show that type.

- **Phase 4, Taxila:** datums and narratives as the first real tenant. Labeled list links, `derived-from` between narratives and datums, supersede confirmation flow. Source anchors (selected text becomes a minimal link) and block-level target anchors in Taxila's editor.
- **Phase 5, Zinsser:** word and sentence target anchors, using the algorithm system design chooses.
- **Phase 6, AI layer:** AI tag suggestions waiting for approval (with the auto-accept setting), AI-generated narratives that link their sources, and AI advice on whether a change deserves a version bump (the author still decides).
- **Phase 7, War Room:** plans referencing datums and jobs, which proves cross-module links and locked states with a real second module.
- **Phase 9, API keys:** bots and agents use the same API. Scopes only narrow access.

### Post-MVP

- Styling: type icons, status pills, hover and click details on links.
- Bulk link and tag endpoints.
- Readers reporting broken or obsolete sources. Notifications to authors and referencers (via the outbox).
- Diffs and "as linked" views of a changed target.
- Body-text search, and search providers if system design picks them.
- User-defined relation types. Linking to a link.
- References between users, with redaction and the npm-unpublish delete rule.
- Judging intent with AI. Drift detection between near-duplicates.
- External renderers (Slack and similar). Publishing links on a public Taxila post.
- A "payment overdue" message for locked links. A closure table if cycle checks get slow.

### Questions for Pratik

1. ❓ Is Phase 3 both 3a and 3b? ➡️ Yes. Without 3b, the component and the resolver contract would first meet in Taxila, and their mistakes would surface there.
2. ❓ Do the outbox, provenance and idempotency keys ship in Phase 3 with no consumer yet? ➡️ Yes. **Agreed (Pratik):** for the learning value and as a foundation.
3. ❓ Where do anchors land? ➡️ Phase 3 has the columns and the delete rule, Taxila (Phase 4) adds source and block anchors, and Zinsser (Phase 5) adds word and sentence anchors.
4. ❓ Where does the render cache live? ➡️ In-process or Postgres in Phase 3, behind an interface, with Redis only when measurements ask for it.
5. ❓ Is anything above in the wrong bucket? **Agreed (Pratik):** 1, 3 and 4 as recommended; the clarifications are folded in above.

### Settled before closing

- **Pratik (2026-10-27): every field is optional and the user's call.** The user, or the bot or agent producing the entity, picks which fields matter. Proposed split, to confirm: _system fields_ (id, owner, module, type, status defaulting to active, version and revision counters, timestamps) always exist but the user never fills or sees them. _User metadata_ (title, label, relation type, tags, change note, anchors) is all optional. A missing title falls back to a short display name the module derives at write time, so inline links still need no resolver call.
- **Watch: metadata on micronotes.** Many Taxila datums are one or two sentences, and their metadata can outweigh their content. Observe the pattern and study how other tools handle properties on small notes (Obsidian, Tana, Logseq, Roam) before deciding whether to scale metadata with the size of the entry.

- **Pratik (2026-10-27):** don't build what has no planned use in the near future. Before closing the PRD, go through every foundation item and keep it in Phase 3 only if a near-term phase uses it. The items to check first are the ones nothing in Phase 3 consumes: the outbox (no consumer until notifications), unused columns such as anchors and "allow references" (no editor until Taxila), provenance for agents (AI arrives in Phase 6), and the shared-cache interface (Redis has no date). For each one, the choice is to build it, reserve it cheaply, or drop it with a note on what adding it later costs.

- **Near-term review, settled (Pratik, 2026-10-27):** keep `from_anchor` and `to_anchor` (a Phase 3 rule and Taxila in Phase 4 use them). Drop the "allow references" setting: references between users are four or more years away under Individual First, and the column costs a one-line migration later. Keep `owner` on every row and the redacted state in the component. Keep the render cache as a plain interface with in-process storage, and add no Redis until measurements ask for it.
- **Everything optional, settled:** system fields always exist and stay invisible. All user metadata is optional. A missing title falls back to a module-derived display name, and the version change note is optional (the `#` still shows).
