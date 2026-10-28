---
id: prd.features.synergy.spec
title: "Synergy - Feature Specifications"
created: 2026-10-28
kind: prd
audience: everyone
version: 0.1.0
status: draft
tags:
   - prd
   - spec
   - synergy
applies_to:
   - "[[04-plans/phase-3-graph-store-metadata-service]]"
publish: true
---

The build-facing spec for Synergy's Phase 3. The why, and the full detail of each rule, live in the PRD starting at [[00.prd.features.synergy.overview|Overview of Synergy]]. Decisions trace to the tickets on the [[02-prd/03-features/01-synergy/map|map]].

## Problem Statement

Each Sidekick module holds a different kind of information, and the value comes from connecting them. Today nothing connects them. A War Room plan that relies on a Taxila note can't link to it in a way that survives: when the note is rewritten, deprecated or replaced, the plan keeps reading as well-founded and nobody is told. The only way to reuse a fact is to copy it, and copies drift apart. Nothing can say who relies on an entry before it is changed or deleted, and nothing finds entries across modules by title, type or tag. Bots, jobs and agents have no structured way to read or make these connections at all.

## Solution

Synergy is a substrate in `packages/core` that every module builds on. Any entity in any module can link to any other through a stored relationship, with an optional label and type. Each reference remembers the target's version and revision when it was made and reports, when read, whether the target was edited, changed, deprecated, superseded, deleted or locked. A referenced entity can't be deleted, and reference cycles are refused. Tags (flat or `key:value`) apply to entities and relationships. A Rich Live Link component shows any relationship inline, as a card, as a live preview or as a minimal label, with the owning module supplying the content through a registered renderer. Search covers titles and metadata across modules, and every entity can list who references it. People, bots, jobs and agents all use the same guarded API.

Phase 3 proves all of this on two mock modules, notes and tasks, and a playground page where the owner can see real relationships, tags, fields and links rendered on mock entities.

## User Stories

A prefix in brackets names the only actors a story applies to. A story without one applies to the user.

**Entities**

1. Every entity in every module is linkable.
2. Every field a user fills in is optional. A one-sentence note never needs more metadata than content.
3. An entity without a title appears by a short name taken from its content.
4. Mark a save as a new version when the change may invalidate what others built on it.
5. Ordinary saves (typos, formatting, additions) count as revisions only.
6. Add an optional one-line change note to a new version.
7. Deprecate an entity. It stays readable.
8. Supersede an entity with a newer one. Referencers are pointed at the replacement.
9. Superseding first confirms how many entities reference the old one.
10.   Only content edits (title, body, blurb) bump the version or revision. Status, tags and metadata never do.

**Relationships**

11. Link one entity to another. The connection is stored, never copied.
12. Give a link an optional label that says what the target answers ("Why?").
13. Give a link an optional type from the starter vocabulary.
14. An untyped link counts as a reference.
15. Associations (`related-to`, `inspired-by`, `next`, `contradicts`) never go stale and never block anything.
16. Backlinks show each type by its inverse name ("explains", "source of").
17. Link the same pair more than once, in the same direction, with different labels.
18. Make a list link: several ordered targets under one label ("Why? guilt, new ideas, perfectionism").
19. Reorder the members of a list link.
20. Tag a relationship.
21. Delete a link at any time.
22. The link picker greys out entries that would close a reference loop ("would create a loop") and offers to mention the existing link instead.
23. (bot, agent) A request that would close a reference loop is refused with the chain named.
24. Mention one link from both of its entities, as often as needed. It stays one relationship.
25. (target's author) Mentions of a link its source removed show "No longer linked" until dismissed or relinked.
26. Undoing an unlink restores the same link. Linking the pair again later creates a new one, and old mentions can be relinked to it.
27. Linking into a module the account doesn't have is refused.

**Tags**

28. Tag any entity with flat or `key:value` tags.
29. Tags are lowercased automatically. Anything else is rejected with a hint.
30. Autocomplete suggests the keys already in use and the keys Sidekick ships.
31. Rename a tag once; it changes everywhere.
32. Merge one tag into another. The old name then suggests and applies the merged tag.
33. Deprecate a tag or a relation type. Existing uses stay; new ones are refused.
34. (agent) Suggest tags. They wait for approval unless the user turns on auto-accept.

**Keeping links true**

35. A link whose target was edited since it was made shows a standard-colour dot.
36. A link whose target has a new version shows a red dot, and the change note where there's room.
37. A link shows its target's single status: active, deprecated, superseded or deleted.
38. A deleted target keeps its name as plain, unclickable text.
39. A link into a module the account no longer has shows name, type and status, and no content.
40. (source's author) Mark a changed link "still holds" to clear its dot.
41. (source's author) Point a link at the entry that superseded its target.
42. (source's author) Unlink a stale link.
43. Deleting an entity that others reference is refused with the referencer count. Deprecate or supersede it instead.
44. Deleting a source removes its outgoing links, which can free its targets.
45. Restore brings back exactly what a delete removed and never touches the version.
46. Permanent erasure overrides the delete block and leaves referencers a "permanently removed" placeholder.
47. Links into a disabled module stay as they are until it is re-enabled or the link is removed.

**Anchored links**

48. Select a word, sentence or paragraph and link it.
49. Point a link at a passage of its target: a paragraph, sentence or word.
50. The editor marks passages that others reference.
51. Deleting a referenced passage offers keep, save as a new version, or supersede.
52. Editing a referenced passage asks whether it is a new version.
53. A link whose passage was removed in a new version shows the red dot and "passage removed" until its author re-anchors it, widens it to the whole entity, or unlinks.
54. Removing a link from an entry counts as a revision of that entry.

**Rich Live Link**

55. Choose per link: inline, card or live preview.
56. Inline reads `{title} ({type}) - [{status}]`, followed by any dot.
57. A labeled or text-anchored link shows only its label, with a red dot when the target needs attention.
58. A card shows the title, an excerpt and module fields.
59. A live preview shows the whole current target in place.
60. Links inside a live preview render inline. Previews never nest.
61. (developer) Register a renderer for an entity type. The component calls it wherever that type is linked.
62. Renderers are async and batched: one call per module per page.
63. Loading, error and empty states look the same for every module.
64. Links are real links in focus order. The dots have text equivalents and differ in shape as well as colour.
65. Long lists of links or backlinks load more as the reader scrolls.
66. (third-party app) Show a Sidekick link as a card or live preview through the public API.
67. (developer) Add a new linkable type (a Twitter thread, a news article) by registering its resolver and renderer, without changing core.

**Search and backlinks**

68. Search every module by title, type, module, status and tag.
69. Search tolerates typos and partial words: "dep wor" finds "deep work".
70. See everything that references an entry, with labels and types.
71. Backlinks and search results page.

**Machines**

72. (bot, job, agent) Use the same guarded API that Sidekick's own screens use.
73. (bot, agent) Get each resolved link as structured data: relationship, target fields, state and marks.
74. (bot, agent) Retry a create safely with an idempotency key.
75. (bot, agent) Get stable error codes: `delete_blocked` with the referencer count, `passage_referenced`, `cycle`, `locked`, and stale-revision conflicts.
76. Every write records who made it (a person, the system, an agent or an API key) and why.
77. A save from a stale copy is refused, whether it comes from a second tab or, later, a second person.

**Playground (Phase 3 only)**

78. A playground page lists mock notes and tasks.
79. Create, edit, version, deprecate, supersede and delete mock entities.
80. Add relationships of every type, with labels, list links and tags.
81. Each mock entity shows its fields, tags, outgoing links and backlinks.
82. The same link shows in all four display types side by side.
83. Switch the mock modules' entitlement off and on to watch links lock and come back.
84. The playground and mock modules sit behind a `sandbox` entitlement that real users never hold.

## Implementation Decisions

**Modules**

- `packages/core` gains the Synergy store: entity index, version log, relationships (single and list in one table), relation-type vocabulary, tags and tag applications, an outbox, and a repository that is the only access path. It also gains the resolver and renderer registries and the render cache interface. It takes feature keys as data and never imports the feature registry (see [[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]]).
- A Rich Live Link component in the shared UI package, owning the frame and the states. Renderers supply content. It is host-agnostic: data and the caller's credentials come in as inputs, with no app-wide context, so third parties can use it later.
- Guarded API routes in the web app for entities' Synergy fields, relationships, tags, search, backlinks and link resolution, all through `withApiGuard`.
- Mock note and task modules in `packages/ops`, behind a `sandbox` entitlement granted with the existing ops script. Each registers an entity type, a resolver and a renderer. They retire with ops; their renderers stay as test fixtures.
- A playground page in the web app, behind the same `sandbox` entitlement, built only on the public API and the Rich Live Link component. Plain, unstyled HTML: forms, textareas, lists, buttons and the raw API response beside each result. No rich-text editor, modals, hovers or styling; just enough to test the responses and check readiness against the PRD.

**Schema**

- Entity index: id (client UUID), owner, module (feature key), type, display name, optional title, status (`active`, `deprecated`, `superseded`, `deleted`), version, revision, created, updated, deleted.
- Version log: entity, version, optional change note, actor, time.
- Relationships: id, owner, from, to (empty on a list header), parent (list members), position, optional label, optional type, version and revision snapshot, `from_anchor`, `to_anchor`, actor, timestamps, soft delete with actor and reason (a tombstone, so mentions can explain why a link is gone and undo can restore it).
- Relation types: name, inverse name, kind (reference or association), status (active or deprecated), system flag. Seeded with the starter vocabulary: `derived-from`/`source-of`, `cites`/`cited-by`, `supported-by`/`evidence-for`, `explained-by`/`explains`, `inspired-by`/`inspiration-for`, `next`/`previous`, `related-to`, `contradicts`, `supersedes`/`superseded-by`.
- Tags: id, owner, name (one optional `key:` prefix), description, status, alias-of. A check constraint enforces lowercase ASCII letters, digits, dashes and at most one colon. Tag applications link a tag to an entity or a relationship.
- Outbox: event type (entity changed, version bumped, status changed, relationship created or deleted), subject, actor, time, payload. Written in the same transaction as the change. Nothing consumes it in Phase 3.
- Every table: client-generated UUIDs, `updated_at`, soft delete, actor on writes, and RLS comparing the uuid column directly to `nullif(current_setting('app.current_user_id', true), '')::uuid`. Phase 3 also rewrites the existing policies in migrations 0002 and 0007, which cast the column to text.
- Indexes on `to` (backlinks), (`to`, `to_anchor`) for the passage check, `from`, (`parent`, `position`), tag applications by tag, index rows by owner and status, and a trigram index on display names.

**Rules**

- Staleness is computed on read by comparing the relationship's snapshot with the index row. Nothing is written to referencers when a target changes.
- A red dot when the version moved; otherwise a standard-colour dot when the revision moved. Dots follow the status, differ in shape as well as colour, and carry text equivalents. Minimal links show the red dot for changed, deprecated, superseded or deleted, and nothing for edited.
- Only title, body and blurb bump counters. Tags, metadata and status never do. Removing an association because its target passage was deleted bumps the source's revision with a system actor and reason.
- Delete is refused while any reference points at the entity. Associations don't count. Erasure overrides and leaves a placeholder.
- A reference may not close a cycle. The server checks reachability under a per-user lock in the same transaction as the insert. A recursive query is the starting point; the closure table or depth cap waits for measurements.
- Creating `supersedes` marks the target superseded after a confirmation step that reports the referencer count.
- Locked, redacted and deleted are decided on the server, before any resolver runs, using the same entitlement check as `withApiGuard`.
- A mention is a mark in an entity's content carrying one relationship id. A relationship may have any number of mentions, in its source and in its target; mentions in the target read with the inverse name. Staleness, the delete block and the cycle check follow the stored direction only. Unlinking, or removing the source's last mention, soft-deletes the relationship; removing the target's mentions never does. How modules report mentions to core is for system design.
- Mentions of a soft-deleted relationship resolve to the state "No longer linked": the text stays, the link is disabled, and the copy is neutral about why. Core never edits the target's content or counters; its author dismisses (plain text stays) or relinks. Undo restores the same relationship id. Linking the pair again later creates a new relationship, and old mentions can be relinked to it.
- A save that removes a passage with incoming references is refused with `passage_referenced` unless it is a new version. The check looks up only the anchors the save removed, against an index of references by target and anchor, so it costs the size of the change. Associations don't protect passages; they are removed with them.
- Updates carry the revision they started from, and stale writes get a conflict error. The check is per entity, not per user, so it already covers two people saving in parallel or one after another; merging instead of refusing waits for collaboration.

**Contracts**

- Linkable types, resolvers and renderers are registered by packages and never listed in core, so a new type (a Twitter thread, a news article) is a new package.
- Resolver and renderer contracts take lists and are async: one call per module per page, and `render(links) => Promise<ReactNode>`. Inline and minimal need no renderer call.
- The resolved link sent to every consumer carries the relationship (id, label, type, kind, snapshot), the target's index fields, its state, its mark, and render data when card or preview asked for it. The display type is a field consumers may ignore.

The prototype's resolved-link shape, trimmed (from the throwaway prototype in ticket 08):

```json
{
   "relationship": {
      "id": "rel_7Hq2",
      "label": null,
      "kind": "reference",
      "linkedAt": { "version": 1, "revision": 2 }
   },
   "display": "card",
   "target": {
      "id": "tx.datum.07",
      "type": "datum",
      "module": "taxila",
      "title": "Am I lying to myself?",
      "status": "active",
      "version": 2,
      "revision": 5,
      "dirty": "changed",
      "changeNote": "Reframed: the fear is of the test itself, not of the timing."
   },
   "render": { "excerpt": "…" }
}
```

- Stable error codes: `delete_blocked` (with the referencer count), `passage_referenced` (with the links), `cycle` (with the chain), `locked`, `stale_revision`, `invalid_tag`, `deprecated_vocabulary`.
- Every create accepts an idempotency key.
- Every list (backlinks, search, tags, version log, list-link members) pages by cursor.
- The render cache is keyed by entity, revision and display type, sits behind a plain get/set interface with in-process storage, and responses carry the revision as an ETag.

**Search**

- Postgres full-text search plus `pg_trgm` over display name, and exact matches on type, module, status and tags. No body text. Filters and cursors on every query.

## Testing Decisions

- **A good test checks what a consumer can observe, never how it is done.** It sends a request and asserts on the response and on what a second request then returns. It never asserts on table layout, SQL or internal function calls, so the store can be reshaped without rewriting tests.
- **Main seam: the guarded HTTP API.** Integration tests call the real route handlers wrapped in `withApiGuard` with a `Request`, against a database built from the migrations, with only the signed-in caller mocked. Prior art: the integration guard and entitlement tests in `packages/core`, which already run this way inside the test-database script, with random per-file user ids so files run in parallel.
- The exit criteria run at this seam, through the public API only:
   - a link carries a label and a type
   - a version bump with a change note shows the red dot
   - deprecate and supersede work, including the referencer count on supersede
   - deleting a referenced target is refused with `delete_blocked`
   - a reference cycle is refused with `cycle`
   - `key:value` tags work, and invalid tags are refused
   - search finds entities by title and metadata
   - turning a module's entitlement off makes its links locked, with no content in the response
   - another user's entities never appear in any response
- Further cases at the same seam: list links keep their order, restore brings back what delete removed, erasure leaves a placeholder, removing a referenced passage is refused with `passage_referenced` unless the save is a new version (then the reference shows the red dot and "passage removed"), deleting a passage removes associations into it and bumps the source's revision, a stale-revision update is refused, a retried create with the same idempotency key links once, backlinks page correctly, a relationship mentioned from both ends stays one relationship and creates no cycle, removing the source's last mention leaves the target's mentions "No longer linked", and undoing an unlink restores the same relationship id.
- **Second seam: the Rich Live Link component.** Component tests render it with a fake renderer registry and stubbed resolved links, and assert what a reader perceives (text, link roles, text equivalents of the marks) for each display type and state. Sidekick has no component tests yet. Choosing the tool (Storybook or an alternative) is a system-design decision.
- **The playground is for eyes, not assertions.** It lets the owner check the outcome by hand and doubles as the natural target for end-to-end or visual regression tests later.
- Each bug fixed later gets a regression test at the seam where it showed up.

## Out of Scope

- Any real module's entities, editor or renderer (Taxila, War Room, Zinsser, Alter Ego). They arrive in their own phases, each shipping a renderer.
- Source and target anchors in a real editor, and word and sentence anchors. Phase 3 stores the anchor fields and enforces the referenced-passage rule on save.
- Styling: type icons, status pills, hover or click detail cards.
- Notifications and digests, readers reporting broken sources, diffs and "as linked" views.
- Body-text search, search providers and embeddings.
- User-defined relation types, links to links, and nested tags.
- References between users and redaction across users.
- Bulk link and tag endpoints.
- Judging intent with AI, AI advice on version bumps, and drift detection.
- External renderers (Slack and similar) and publishing links on public posts.
- Third-party integrations of Rich Live Links (Slack unfurls, Notion embeds, oEmbed). The component is host-agnostic from the start.
- AI tag-merge suggestions (the user approves each merge).

## Further Notes

- Phase 3 splits into 3a (store and rules) and 3b (render and find). See [[08.prd.features.synergy.scope-and-phases|Scope and phases]].
- For system design: how word and sentence anchors survive edits (operation-based anchors are the bar to beat), how the referenced-passage check stays proportional to the change, how the cycle check scales, whether search uses a provider model, and which tool tests modules and components in isolation.
- A throwaway prototype of the display types and states is linked from [[02-prd/03-features/01-synergy/tickets/08-rich-live-link-draft|ticket 08]].
- Watch whether metadata on micronotes outweighs their content, and study how other tools handle it.
