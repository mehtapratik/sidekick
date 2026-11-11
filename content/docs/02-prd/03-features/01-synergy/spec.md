---
id: prd.features.synergy.spec
title: "Synergy - Feature Specifications"
created: 2026-10-28
kind: prd
audience: everyone
updated: 2026-11-11
version: 1.4.1
status: accepted
tags:
   - prd
   - spec
   - synergy
applies_to:
   - "[[04-phases/03-synergy/00-plan]]"
   - "[[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief]]"
publish: true
---

The build-facing spec for Synergy's Phase 3. The why, and the full detail of each rule, live in the PRD starting at [[00.prd.features.synergy.overview|Overview of Synergy]]. Decisions trace to the tickets on the [[02-prd/03-features/01-synergy/map|map]]. [[#One Repo|One Repo]], at the end, specifies the move into one repo and the new public site.

## Problem Statement

Each Sidekick module holds a different kind of information, and the value comes from connecting them. Today nothing connects them. A War Room plan that relies on a Taxila note can't link to it in a way that survives: when the note is rewritten, deprecated or replaced, the plan keeps reading as well-founded and nobody is told. The only way to reuse a fact is to copy it, and copies drift apart. Nothing can say who relies on an entry before it is changed or deleted, and nothing finds entries across modules by title, type or tag. Bots, jobs and agents have no structured way to read or make these connections at all.

## Solution

Synergy is a substrate in `packages/platform/synergy` that every module builds on. Any entity in any module can link to any other through a stored relationship, with an optional label and type. Each reference remembers the target's version and revision when it was made and reports, when read, whether the target was edited, changed, deprecated, superseded, deleted or locked. A referenced entity can't be deleted, and reference cycles are refused. Tags (flat or `key:value`) apply to entities and relationships. A Sneak Peek Link component shows any relationship inline, as a card, as a live preview or as a minimal label, with the type's provider supplying the content through a registered renderer. Search covers titles and metadata across modules, and every entity can list who references it. People, bots, jobs and agents all use the same guarded API.

Phase 3 proves all of this on two mock modules, notes and tasks, and a playground page where the owner can see real relationships, tags, fields and links rendered on mock entities.

## User Stories

A prefix in brackets names the only actors a story applies to. A story without one applies to the user.

**Entities**

1. **D73** `requirement` #synergy #entities: Every entity in every module is linkable. derived-from [[D69]]
2. **D74** `requirement` #synergy #entities: Every field a user fills in is optional. A one-sentence note never needs more metadata than content. derived-from [[D1]]
3. **D75** `requirement` #synergy #entities: An entity without a title appears by a short name taken from its content. derived-from [[D1]]
4. **D76** `requirement` #synergy #entities: Mark a save as a new version when the change may invalidate what others built on it. derived-from [[D70]]
5. **D77** `requirement` #synergy #entities: Ordinary saves (typos, formatting, additions) count as revisions only. derived-from [[D70]]
6. **D78** `requirement` #synergy #entities: Add an optional one-line change note to a new version. derived-from [[D70]]
7. **D79** `requirement` #synergy #entities: Deprecate an entity. It stays readable. derived-from [[D70]]
8. **D80** `requirement` #synergy #entities: Supersede an entity with one or more newer ones. Referencers are pointed at a replacement. derived-from [[D70]]
9. **D81** `requirement` #synergy #entities: Superseding first confirms how many entities reference the old one. derived-from [[D70]]
10.   **D82** `requirement` #synergy #entities: Only content edits (title, body, blurb) bump the version or revision. Status, tags and metadata never do. derived-from [[D70]]

**Relationships**

11. **D83** `requirement` #synergy #links: Link one entity to another. The connection is stored, never copied. derived-from [[D69]]
12. **D84** `requirement` #synergy #links: Give a link an optional label that says what the target answers ("Why?"). derived-from [[D69]]
13. **D85** `requirement` #synergy #links: Give a link an optional type from the starter vocabulary. derived-from [[D69]]
14. **D86** `requirement` #synergy #links: An untyped link counts as a reference. derived-from [[D69]]
15. **D87** `requirement` #synergy #links: Associations (`related-to`, `inspired-by`, `next`, `contradicts`, `violates`) never go stale and never block anything. derived-from [[D69]]
16. **D88** `requirement` #synergy #links: Backlinks show each type by its inverse name ("explains", "source of"). derived-from [[D69]]
17. **D89** `requirement` #synergy #links: Link the same pair more than once, in the same direction, with different labels. derived-from [[D69]]
18. **D90** `requirement` #synergy #links: Make a list link: several ordered targets under one label ("Why? guilt, new ideas, perfectionism"). derived-from [[D69]]
19. **D91** `requirement` #synergy #links: Reorder the members of a list link. derived-from [[D69]]
20. **D92** `requirement` #synergy #links: Tag a relationship. derived-from [[D69]]
21. **D93** `requirement` #synergy #links: Delete a link at any time. derived-from [[D69]]
22. **D94** `requirement` #synergy #links: The link picker greys out entries that would close a reference loop ("would create a loop") and offers to mention the existing link instead. derived-from [[D70]]
23. **D95** `requirement` #synergy #links: (bot, agent) A request that would close a reference loop is refused with the chain named. derived-from [[D70]] derived-from [[D3]]
24. **D96** `requirement` #synergy #links: Mention one link from both of its entities, as often as needed. It stays one relationship. derived-from [[D69]]
25. **D97** `requirement` #synergy #links: (target's author) Mentions of a link its source removed show "No longer linked" until dismissed or relinked. derived-from [[D69]]
26. **D98** `requirement` #synergy #links: Undoing an unlink restores the same link. Linking the pair again later creates a new one, and old mentions can be relinked to it. derived-from [[D69]]
27. **D99** `requirement` #synergy #links: Linking into a module the account doesn't have is refused. derived-from [[D69]]
28. **D100** `requirement` #synergy #links: Define a term in the Lexicon (Taxila): an entity of type `term` with a short definition or acronym expansion, aliases and abbreviations. derived-from [[D69]]
29. **D101** `requirement` #synergy #links: Link any word to a term with a `defined-by` association. It renders as a minimal link: hovering shows the definition in the browser's native tooltip (an abbreviation element for acronyms), and clicking opens the term in Taxila. derived-from [[D69]]

**Tags**

30. **D102** `requirement` #synergy #tags: Tag any entity with flat or `key:value` tags. derived-from [[D72]]
31. **D103** `requirement` #synergy #tags: Tags are lowercased automatically. Anything else is rejected with a hint. derived-from [[D72]]
32. **D104** `requirement` #synergy #tags: Autocomplete suggests the keys already in use and the keys Sidekick ships. derived-from [[D72]]
33. **D105** `requirement` #synergy #tags: Rename a tag once; it changes everywhere. derived-from [[D72]]
34. **D106** `requirement` #synergy #tags: Merge one tag into another. The old name then suggests and applies the merged tag. derived-from [[D72]]
35. **D107** `requirement` #synergy #tags: Deprecate a tag or a relation type. Existing uses stay; new ones are refused. derived-from [[D72]]
36. **D108** `requirement` #synergy #tags: (agent) Suggest tags. They wait for approval unless the user turns on auto-accept. derived-from [[D72]] derived-from [[D1]]

**Keeping links true**

37. **D109** `requirement` #synergy #staleness: A link whose target was edited since it was made shows a standard-colour dot. derived-from [[D70]]
38. **D110** `requirement` #synergy #staleness: A link whose target has a new version shows a red dot, and the change note where there's room. derived-from [[D70]]
39. **D111** `requirement` #synergy #staleness: A link shows its target's single status: active, deprecated, superseded or deleted. derived-from [[D70]]
40. **D112** `requirement` #synergy #staleness: A deleted target keeps its name as plain, unclickable text. derived-from [[D70]]
41. **D113** `requirement` #synergy #staleness: A link into a module the account no longer has shows name, type and status, and no content. derived-from [[D70]]
42. **D114** `requirement` #synergy #staleness: (source's author) Mark a changed link "still holds" to clear its dot. derived-from [[D70]]
43. **D115** `requirement` #synergy #staleness: (source's author) Point a link at one of the entries that superseded its target. derived-from [[D70]]
44. **D116** `requirement` #synergy #staleness: (source's author) Unlink a stale link. derived-from [[D70]]
45. **D117** `requirement` #synergy #staleness: Deleting an entity that others reference is refused with the referencer count. Deprecate or supersede it instead. derived-from [[D70]]
46. **D118** `requirement` #synergy #staleness: Deleting a source removes its outgoing links, which can free its targets. derived-from [[D70]]
47. **D119** `requirement` #synergy #staleness: Restore brings back exactly what a delete removed and never touches the version. derived-from [[D70]]
48. **D120** `requirement` #synergy #staleness: Permanent erasure overrides the delete block and leaves referencers a "permanently removed" placeholder. derived-from [[D70]]
49. **D121** `requirement` #synergy #staleness: Links into a disabled module stay as they are until it is re-enabled or the link is removed. derived-from [[D70]]

**Anchored links**

50. **D122** `requirement` #synergy #anchors: Select a word, sentence or paragraph and link it. derived-from [[D69]]
51. **D123** `requirement` #synergy #anchors: Point a link at a passage of its target: a paragraph, sentence or word. derived-from [[D69]]
52. **D124** `requirement` #synergy #anchors: The editor marks passages that others reference. derived-from [[D70]]
53. **D125** `requirement` #synergy #anchors: Deleting a referenced passage offers keep, save as a new version, or supersede. derived-from [[D70]]
54. **D126** `requirement` #synergy #anchors: Editing a referenced passage asks whether it is a new version. derived-from [[D70]]
55. **D127** `requirement` #synergy #anchors: A link whose passage was removed in a new version shows the red dot and "passage removed" until its author re-anchors it, widens it to the whole entity, or unlinks. derived-from [[D70]]
56. **D128** `requirement` #synergy #anchors: Removing a link from an entry's content counts as a revision of that entry. Synergy removing a link (an association into a deleted passage) never does. derived-from [[D70]]

**Sneak Peek Link**

57. **D129** `requirement` #synergy #sneak-peek-link: Choose per direct mention: minimal, inline, card or live preview. The two ends of a link may show it differently. derived-from [[D71]]
58. **D130** `requirement` #synergy #sneak-peek-link: Inline reads `{title} ({type}) - [{status}]`, followed by any dot. derived-from [[D71]]
59. **D131** `requirement` #synergy #sneak-peek-link: A minimal mention or an alias mention shows only its label (the link's label, the target's title when there is none, or the author's words), with a red dot when the target needs attention, and a browser-default tooltip reading `{type} - {status}`. derived-from [[D71]]
60. **D132** `requirement` #synergy #sneak-peek-link: A card shows the title, an excerpt and module fields. derived-from [[D71]]
61. **D133** `requirement` #synergy #sneak-peek-link: A live preview shows the whole current target in place. derived-from [[D71]]
62. **D134** `requirement` #synergy #sneak-peek-link: Links inside a live preview render inline. Previews never nest. derived-from [[D71]]
63. **D135** `requirement` #synergy #sneak-peek-link: (developer) Register a renderer for an entity type. The component calls it wherever that type is linked. derived-from [[D71]] derived-from [[D187]]
64. **D136** `requirement` #synergy #sneak-peek-link: Renderers are async and batched: one call per provider per page. derived-from [[D71]] derived-from [[D183]]
65. **D137** `requirement` #synergy #sneak-peek-link: Loading, error and empty states look the same for every module. derived-from [[D71]] derived-from [[D182]]
66. **D138** `requirement` #synergy #sneak-peek-link: Links are real links in focus order. The dots have text equivalents and differ in shape as well as colour. derived-from [[D71]] derived-from [[D185]]
67. **D139** `requirement` #synergy #sneak-peek-link: Long lists of links or backlinks load more as the reader scrolls. derived-from [[D71]] derived-from [[D181]]
68. **D140** `requirement` #synergy #sneak-peek-link: (third-party app) Show a Sidekick link as a card or live preview through the public API. derived-from [[D71]] derived-from [[D186]]
69. **D141** `requirement` #synergy #sneak-peek-link: (developer) Add a new linkable type (a Twitter thread, a news article) by registering its resolver and renderer, without changing Synergy. derived-from [[D71]] derived-from [[D187]]

**Search and backlinks**

70. **D142** `requirement` #synergy #search: Search every module by title, type, provider, status and tag. derived-from [[D72]]
71. **D143** `requirement` #synergy #search: Search tolerates typos and partial words: "dep wor" finds "deep work". derived-from [[D72]]
72. **D144** `requirement` #synergy #search: See everything that references an entry, with labels and types. derived-from [[D69]]
73. **D145** `requirement` #synergy #search: Backlinks and search results page. derived-from [[D72]]

**Machines**

74. **D146** `requirement` #synergy #api: (bot, job, agent) Use the same guarded API that Sidekick's own screens use. derived-from [[D3]]
75. **D147** `requirement` #synergy #api: (bot, agent) Get each resolved link as structured data: relationship, target fields, state and marks. derived-from [[D71]] derived-from [[D3]]
76. **D148** `requirement` #synergy #api: (bot, agent) Retry a create safely with an idempotency key. derived-from [[D3]]
77. **D149** `requirement` #synergy #api: (bot, agent) Get stable error codes: `delete_blocked` with the referencer count, `passage_referenced`, `cycle`, `locked`, and stale-content conflicts. derived-from [[D3]]
78. **D150** `requirement` #synergy #api: Every write records who made it (a person, the system, an agent or an API key) and why. derived-from [[D168]]
79. **D151** `requirement` #synergy #api: A save from a stale copy is refused, whether it comes from a second tab or, later, a second person. derived-from [[D171]]

**Playground (Phase 3 only)**

80. **D152** `requirement` #synergy #playground: A playground page lists mock notes and tasks.
81. **D153** `requirement` #synergy #playground: Create, edit, version, deprecate, supersede and delete mock entities.
82. **D154** `requirement` #synergy #playground: Add relationships of every type, with labels, list links and tags.
83. **D155** `requirement` #synergy #playground: Each mock entity shows its fields, tags, outgoing links and backlinks.
84. **D156** `requirement` #synergy #playground: The same link shows in all four display types side by side.
85. **D157** `requirement` #synergy #playground: Switch the mock modules' entitlement off and on to watch links lock and come back.
86. **D158** `requirement` #synergy #playground: The playground and mock modules sit behind the `sandbox-notes` and `sandbox-tasks` entitlements, which real users never hold.

**Added in system design (2026-10-30)**

87. **D159** `requirement` #synergy #links: Cite a link from a field (such as `related-to`) or a links panel. It counts as a mention of the source, so the link lives until the source drops its last mention of any kind. derived-from [[D69]] derived-from [[D67]]
88. **D160** `requirement` #synergy #links: An entity's title shows a dot when any of its outgoing references needs attention, with the links as the reason. derived-from [[D70]]

**Added for violations and exceptions (2026-11-01)**

89. **D161** `requirement` #synergy #violations: Mark that an entity breaks a rule, principle or decision with a `violates` link. The rule's backlinks read "violated by". derived-from [[D69]]
90. **D162** `requirement` #synergy #violations: Record an exception to a rule with an `exception-to` link. It goes stale when the rule changes, and the rule can't be deleted while it has one. derived-from [[D70]]
91. **D163** `requirement` #synergy #violations: Resolve a violation by unlinking it. derived-from [[D70]]
92. **D164** `requirement` #synergy #violations: Waive a violation by changing its type to `exception-to`. It stays the same link, with a fresh snapshot of the rule. derived-from [[D70]]
93. **D165** `requirement` #synergy #violations: Filter an entity's links or backlinks by type: "what violates this rule?" derived-from [[D72]]
94. **D166** `requirement` #synergy #violations: List links of one type across every module: every open violation in one list. derived-from [[D72]]

## Implementation Decisions

**Modules**

- A new platform package, `packages/platform/synergy`, holds the Synergy store: entity index, version log, relationships (single and list in one table), relation-type vocabulary, tags and tag applications, an outbox, and a repository that is the only access path. It also holds the resolver and renderer contracts, the render cache interface and the Sneak Peek Link component. It takes feature keys as data and never imports the feature registry (see [[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]]).
- The Sneak Peek Link component lives in Synergy and builds on `packages/ui` primitives, owning the frame and the states. Renderers supply content. It is host-agnostic: it takes the mentions to show and a transport (`resolveLinks(requests) => Promise<ResolvedLink[]>`) that each host supplies, with no app-wide context, so third parties can use it later. It renders on the server (a page's first paint) and in the browser (the editor inserting or changing a link). The package ships `/server`, `/react` and `/contracts` entry points so database code never reaches a browser bundle.
- Guarded API routes in the web app for entities' Synergy fields, relationships, tags, search, backlinks and link resolution, all through `withApiGuard`.
- Mock note and task modules in `packages/features/_sandbox/notes` and `packages/features/_sandbox/tasks`, behind the `sandbox-notes` and `sandbox-tasks` entitlements granted with the existing ops script. Each registers an entity type (provider and entitlement `sandbox-notes` or `sandbox-tasks`), a resolver and a renderer. Checkpoint 3a names the lessons that retire them; their renderers stay as test fixtures.
- A playground page in the web app, behind the same entitlements, built only on the public API and the Sneak Peek Link component. Plain, unstyled HTML: forms, textareas, lists, buttons and the raw API response beside each result. No rich-text editor, modals, hovers or styling; just enough to test the responses and check readiness against the PRD.

**Schema**

- Entity index: id (client UUID), owner, provider, type, display name, optional title, status (`active`, `deprecated`, `superseded`), version, revision, `content_seq` (moves on every content write, anchors included; the concurrency token), `created_at`, `updated_at` (any write), `edited_at` (author content only, moves with the counters), `deleted_at`. "Deleted" is shown from `deleted_at`, not stored as a status.
- Entity anchors (the linked passages of an entity, with `removed_in_version` once a new version removes one) and entity mentions (the relationship ids its content mentions), both kept by Synergy from what each save reports.
- Version log: entity, version, optional change note, actor, time.
- Relationships: id, owner, from, to (empty on a list row), parent (list members), position, optional label, optional type, version and revision snapshot, `to_anchor` (anchor id and a quote of the passage), `cited`, `mentioned`, actor, timestamps, soft delete with actor, reason and `deletion_batch_id` (a tombstone, so mentions can explain why a link is gone and undo or restore brings back exactly what one delete removed). `type` is never empty: untyped links use the seeded system type `untyped`. A `role` (`solo`, `list`, `member`) and fractional positions with a unique `(parent, position)`. Every row with a `to` is a complete `from → to` edge: list members repeat their list row's `from` and `type`, and a composite foreign key, `(parent_id, from_id, type, parent_role)` referencing `(id, from_id, type, role)`, makes a mismatch or a nested list impossible. `from` never changes after creation.
- Relation types: source key (how the source reads it, the type's identity), target key (how the target reads it), kind (reference or association), status (active or deprecated), system flag. Their labels, like every label Synergy shows (type names, statuses, states, error messages), come from `packages/copy`; Synergy stores and returns keys only. Seeded with the starter vocabulary: `derived-from`/`source-of`, `cites`/`cited-by`, `supported-by`/`evidence-for`, `explained-by`/`explains`, `inspired-by`/`inspiration-for`, `next`/`previous`, `related-to`, `contradicts`, `defined-by`/`defines`, `violates`/`violated-by` (an association from the offender to the rule it breaks), `exception-to`/`has-exception` (a reference from an exception to the rule it limits), `superseded-by`/`supersedes` (a reference, stored from the old entity to each replacement), and the system type `untyped`.
- Tags: id, owner, name (one optional `key:` prefix), description, status, alias-of. A check constraint enforces lowercase ASCII letters, digits, dashes and at most one colon. Tag applications link a tag to an entity or a relationship.
- Outbox: event type, subject, actor, time, payload and transaction id (`pg_current_xact_id()`, so readers can follow commit order). Written in the same transaction as the change. The event types are listed in the [[03-system-design/functional-design/04-synergy/00-overview|system design]]. Read by a dedicated read-only role outside RLS. Nothing consumes it in Phase 3.
- Every table: client-generated UUIDs, `updated_at`, actor on writes, and RLS comparing the uuid column directly to `nullif(current_setting('app.current_user_id', true), '')::uuid`, and nothing else: the repository filters tombstones per query, and the update trigger lets a restore through ([[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]). Syncable tables soft-delete, and their unique indexes are partial on live rows. The outbox and idempotency keys are non-syncable and hard-deleted. Phase 3 also rewrites the existing policies in migrations 0002 and 0007, which cast the column to text.
- Indexes on `to` (backlinks), (`to`, `to_anchor` id) for the passage check, `from`, (`parent`, `position`), tag applications by tag, index rows by owner and status, and trigram and full-text indexes on display names that lead with the owner (`btree_gin`).

**Rules**

- Staleness is computed on read by comparing the relationship's snapshot with the index row. Nothing is written to referencers when a target changes.
- A red dot when the version moved; otherwise a standard-colour dot when the revision moved. Dots follow the status, differ in shape as well as colour, and carry text equivalents. Minimal links show the red dot for changed, deprecated, superseded or deleted, and nothing for edited.
- Only title, body and blurb bump counters. Tags, metadata and status never do. Removing an association because its target passage was deleted moves only the source's `updated_at`, with a system actor and reason: the source's text didn't change, so its own referencers get no false "edited" dot.
- Delete is refused while any reference points at the entity. Associations don't count. Erasure overrides and leaves a placeholder.
- Every Synergy write takes the per-user lock first, before reading anything, so the delete block and the cycle check can't race and there is one lock order.
- A reference may not close a cycle. The server checks reachability under that lock in the same transaction as the insert. A recursive query (with Postgres's `CYCLE` clause) is the starting point; the closure table waits for measurements.
- Restore and undo re-run the delete block and the cycle check, and are refused with `restore_conflict` naming each edge that now points into a tombstone or would close a cycle.
- An open violation is a live `violates` link; there is no status. Resolving it unlinks it, and waiving it changes its type to `exception-to`. A type change from an association to a reference takes a fresh snapshot of the target and runs the cycle check. See [[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships#Violations and exceptions|Violations and exceptions]].
- `superseded-by` is a reference stored from the old entity to each of its replacements, any number of them. Creating the first one marks the source superseded after a confirmation step that reports the referencer count; removing the last one sets it back to active.
- Locked, redacted and deleted are decided on the server, before any resolver runs, using the same entitlement check as `withApiGuard`.
- A mention is a place in an entity that shows a relationship: direct (the link itself, with its own display type), alias (the author's words carry it) or cited (held in a field or links panel). A relationship may have any number of mentions, in its source and in its target; mentions in the target read with the inverse name. Staleness, the delete block and the cycle check follow the stored direction only. Unlinking, or removing the source's last mention of any kind, soft-deletes the relationship; removing the target's mentions never does. On each save the provider reports the current set of relationship ids its content mentions, and Synergy works out what changed; a mention of a relationship with neither end at that entity is refused. A link made from selected text is declared by the save that carries its mark, so it starts mentioned, not cited. See [[03-system-design/functional-design/04-synergy/mentions-and-link-lifetime|Mentions and link lifetime]].
- Mentions of a soft-deleted relationship resolve to the state "No longer linked": the text stays, the link is disabled, and the copy is neutral about why. Synergy never edits the target's content or counters; its author dismisses (plain text stays) or relinks. Undo restores the same relationship id. Linking the pair again later creates a new relationship, and old mentions can be relinked to it.
- A save that removes a passage with incoming references is refused with `passage_referenced` unless it is a new version. The provider reports the current set of block and anchor ids; Synergy compares it with the entity's stored linked anchors, so the database work stays small. Associations don't protect passages; they are removed with them.
- Updates carry the `content_seq` they started from, and stale writes get a conflict error (`stale_content`). Adding an anchor moves the target's `content_seq`, so an open editor's next save is refused and the editor merges the new anchor in before saving again. The check is per entity, not per user, so it already covers two people saving in parallel or one after another; merging instead of refusing waits for collaboration.

**Contracts**

- Linkable types, resolvers and renderers are registered by packages and never listed in Synergy, so a new type (a Twitter thread, a news article) is a new package.
- Each type registers a server half (`resolve`, batched and async, returning serialisable render data, and `addAnchor`) and a React half (`render`, a pure function from render data to React that runs on the server or in the browser). One `resolve` call per provider per page; `resolve` always runs on the server, and browser code reaches it through `POST /api/synergy/links/resolve`. Third parties render from the same JSON. Inline and minimal need no resolver or renderer call.
- The resolved link sent to every consumer carries the relationship (id, label, type, kind, snapshot), the target's index fields, its state, its marks, and render data when card or preview asked for it. The display type is a field consumers may ignore. It is frozen as a zod schema in `@sidekick/synergy/contracts`; the prototype below predates it (its `dirty` field becomes the marks).
- Clients ask for card and preview data with `POST /api/synergy/links/resolve`, a list of `{ relationshipId, display }`. The full endpoint table and the HTTP status of every error code are in the [[03-system-design/functional-design/04-synergy/00-overview|system design]].

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
      "provider": "taxila",
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

- Stable error codes: `delete_blocked` (with the referencer count), `passage_referenced` (with the links), `cycle` (with the chain), `locked`, `stale_content`, `restore_conflict`, `confirmation_required`, `not_found` (also for another user's ids, so a response never reveals whether one exists), `invalid_tag`, `deprecated_vocabulary`.
- Every create accepts an idempotency key.
- Every list (backlinks, search, tags, version log, list-link members) pages by cursor.
- The render cache is keyed by entity, `content_seq` and display type, holds render data only (states are read fresh, including those of links inside a preview), sits behind a plain get/set interface with in-process storage, and responses carry `content_seq` as an ETag.

**Search**

- Postgres full-text search plus `pg_trgm` over display name, and exact matches on type, provider, status and tags. No body text. Filters and cursors on every query.

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
- Further cases at the same seam: list links keep their order, restore brings back what delete removed, erasure leaves a placeholder, removing a referenced passage is refused with `passage_referenced` unless the save is a new version (then the reference shows the red dot and "passage removed"), deleting a passage removes associations into it and moves only the source's `updated_at`, a stale-content update is refused (including after an anchor was added), restore and undo are refused with `restore_conflict` when the graph changed, a retried create with the same idempotency key links once, backlinks page correctly, a relationship mentioned from both ends stays one relationship and creates no cycle, removing the source's last mention leaves the target's mentions "No longer linked", undoing an unlink restores the same relationship id, a `violates` link neither goes stale nor blocks deleting the rule, and retyping it to `exception-to` keeps its id, takes a fresh snapshot and then blocks the rule's delete.
- **Second seam: the Sneak Peek Link component.** Component tests render it with a fake renderer registry and stubbed resolved links, and assert what a reader perceives (text, link roles, text equivalents of the marks) for each display type and state. Sidekick has no component tests yet. They run in Vitest browser mode with Testing Library and MSW ([[03-system-design/non-functional/testing/testing-layers|Testing layers]]).
- **The playground is for eyes, not assertions.** It lets the owner check the outcome by hand and doubles as the natural target for end-to-end or visual regression tests later.
- Race tests open two database connections: an anchor added while the target is open, a delete racing a new reference into the same target, and a restore after the graph changed.
- A test pins story 71 ("dep wor" finds "deep work"), tuning trigram `word_similarity` until it passes.
- Each bug fixed later gets a regression test at the seam where it showed up.

## Out of Scope

- Any real module's entities, editor or renderer (Taxila, War Room, Zinsser, Alter Ego). They arrive in their own phases, each shipping a renderer.
- Source and target anchors in a real editor, and word and sentence anchors. Phase 3 stores the anchor fields and enforces the referenced-passage rule on save.
- Styling: type icons, status pills, hover or click detail cards.
- Notifications and digests, readers reporting broken sources, diffs and "as linked" views.
- Body-text search, search providers and embeddings.
- User-defined relation types, links to links, and nested tags.
- Issue tracking on violations: a status, who resolved one and why, and a history of closed ones.
- References between users and redaction across users.
- Bulk link and tag endpoints.
- Judging intent with AI, AI advice on version bumps, and drift detection.
- External renderers (Slack and similar) and publishing links on public posts.
- Third-party integrations of Sneak Peek Links (Slack unfurls, Notion embeds, oEmbed). The component is host-agnostic from the start.
- AI tag-merge suggestions (the user approves each merge).

## Further Notes

- Phase 3 splits into 3a (store and rules) and 3b (render and find). See [[08.prd.features.synergy.scope-and-phases|Scope and phases]].
- Settled in system design ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]): how word and sentence anchors survive edits (operation-based anchors are the bar to beat), how the referenced-passage check stays proportional to the change, how the cycle check scales, whether search uses a provider model, and which tool tests modules and components in isolation.
- A throwaway prototype of the display types and states is linked from [[02-prd/03-features/01-synergy/tickets/08-sneak-peek-link-draft|ticket 08]].
- Watch whether metadata on micronotes outweighs their content, and study how other tools handle it.

## One Repo

The build-facing spec for [[09.prd.features.synergy.one-repo|One Repo]]: Arkive's docs, writings and site move into `mehtapratik/sidekick`, and the site is rebuilt as the Sidekick public site at ossidekick.com. It is built in [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief|Lesson 0]] and the site lessons of the [[04-phases/03-synergy/00-plan#Site lessons (the redesign)|Synergy plan]]. Decisions trace to the tickets on the retired [[02-prd/03-features/01-synergy/map-one-repo|one-repo map]].

### Problem Statement

Code and docs live in two repos. A change and the docs it makes false take two PRs that can land out of step, and Sidekick's install clones Arkive through a script and a `docs` symlink. The site is on arkive.blog under a retired name, carries its own npm lockfile and Node version, and is configured in a Cloudflare dashboard nobody reviews.

### Solution

One repo with `content/` beside the code and the site as a workspace app, `@sidekick/www`, deployed as a Cloudflare Worker from Sidekick's `main`. The site is then redesigned from the handover and moves, with the App, to ossidekick.com in one cutover with no downtime. No published URL changes at any step.

### User Stories

A story with no prefix is the owner's. [Reader] is anyone reading the public site.

95. **D228** `requirement` #one-repo #git: `git log --follow` on any doc or writing shows its Arkive commits. derived-from [[D213]]
96. **D229** `requirement` #one-repo #monorepo: One PR can change code and the docs that describe it. derived-from [[D214]]
97. **D230** `requirement` #one-repo #monorepo: `pnpm install` from a fresh clone installs everything, with no clone script, no symlink to set up and one lockfile. derived-from [[D214]]
98. **D231** `requirement` #one-repo #ci: CI runs the site's build with its privacy and datum gates, and its type check, on every PR. derived-from [[D214]]
99. **D232** `requirement` #one-repo #deployment: A commit that touches only `content/` builds the site and skips the App. derived-from [[D215]]
100. **D233** `requirement` #one-repo #deployment: Every branch that touches the site gets a public preview URL. derived-from [[D220]]
101. **D234** `requirement` #one-repo #urls: [Reader] Every URL that worked on arkive.blog still works, on arkive.blog after Lesson 0 and through a 301 to ossidekick.com after the cutover, with its path, query and fragment kept. derived-from [[D221]] derived-from [[D222]]
102. **D235** `requirement` #one-repo #domain: [Reader] A visitor who arrives through the arkive.blog redirect sees one line saying the site moved, once. derived-from [[D222]]
103. **D236** `requirement` #one-repo #site: [Reader] The home page shows how many phases are complete and which is up next, from the phase plans. derived-from [[D224]]
104. **D237** `requirement` #one-repo #site: [Reader] The feed brings each new Writing once, and an edit to an old one does not bring it back. derived-from [[D225]]
105. **D238** `requirement` #one-repo #content: An entry can show a component by naming it in a fenced block, and a wrong name or wrong props fail the build. derived-from [[D227]]
106. **D239** `requirement` #one-repo #site: [Reader] On a phone the header holds the wordmark, Search and Menu, and the docs tree opens from a Contents button. derived-from [[D223]]

### Implementation Decisions

**Layout and packages**

- Root: `apps/www` (`@sidekick/www`), `apps/app` (`@sidekick/app`, was `apps/web` named `web`), `content/` (`@sidekick/content`, with `content/docs/`, `content/writings/` and `content/LICENSE`), `packages/…` unchanged. The root package stays `sidekick`.
- `apps/www` is a workspace package through the existing `apps/*` glob; `pnpm-workspace.yaml` adds `content`. The site declares `"@sidekick/content": "workspace:*"`, so Turbo hashes content into the site's build. Before that landed (Lesson 0 PR 3), `turbo.json` gave `@sidekick/www#build` `inputs: ["$TURBO_DEFAULT$", "$TURBO_ROOT$/content/**"]`.
- `src/lib/vault.mjs` resolves `content/docs` and `content/writings` from the repo root. New code that scans content goes through `vault.mjs`'s helpers, so the `.md` extension stays in one place.
- The site inherits the root `.gitignore` and `.prettierrc` (plus `prettier-plugin-astro`); `.prettierignore` lists `content/` and the files the site ships as given. One format commit is listed in `.git-blame-ignore-revs`.
- Node 24 (`engines` `24.x`, `.node-version` 24) and pnpm from `packageManager`, as for every package. The site's dependency ranges become `^major.minor.patch`. Renovate needs no new rules: its recommended config groups `astro` with `@astrojs/*` and gives every major a reviewed PR. `@astrojs/check` accepts TypeScript 5 or 6, so a TypeScript 7 bump waits on it.
- Agent notes: `apps/www/AGENTS.md` (was the site's `CLAUDE.md`); the root `AGENTS.md` symlink points at `content/docs/08-ai-coding-harness/agent-guide.md`. No `CONTEXT.md` anywhere; its seven terms are glossary pages (D226).
- A small `actions/labeler` workflow adds the `content` label when every file in a PR is under `content/`. Content PRs use `docs(<area>):` titles.

**Hosting**

- Worker `sidekick-www`, `apps/www/wrangler.jsonc`: `compatibility_date`, `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"`, a `previews` block; no script, no binding. Wrangler 4.135 or later is a dev dependency of `apps/www`.
- Workers Builds: root directory the repo root; build `pnpm turbo run build --filter=@sidekick/www`; deploy `pnpm -C apps/www exec wrangler deploy`; preview `pnpm -C apps/www exec wrangler preview`; watch paths `apps/www/*`, `content/*`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`. No `NODE_VERSION` or `PNPM_VERSION`.
- `_redirects` and `_headers` carry over unchanged. `/foo` redirects to `/foo/` with a 307.
- The App's Vercel project uses Root Directory `apps/app` with Skip deployment on.

**The new site**

- The handover's routes, chrome, pages, plates and tokens, with the overrides listed in the [[09.prd.features.synergy.one-repo#The new site|PRD]]. `/writings/`, `/docs/` and `/tags/<tag>/` become real pages (their redirects to `/` go); `/index/` still redirects to `/`. The only shortcuts are `/` for search and `Esc` to close.
- Breakpoint: one `@media (width < 58rem)` block holds every chrome swap. The value is the docs row's flex bases, gap and gutters (920px) rounded up to a whole rem; if those change, it moves with them. The house rule in `apps/www/AGENTS.md` changes in the site lesson that builds the chrome.
- Milestones: one per `04-phases/NN-name/00-plan.md` with `publish: true`, one level down. Label `NN` as a number; title from `title`; status `completed` done, `deferred` deferred, first other up next, rest planned. Hidden label "Phase {n}, {title}: {status}". Sentence "{done} of {total} milestones complete. Up next: {title}", deferred phases counted in the total. "All phases" lists sub-plans indented under their phase.
- Feed: `/rss.xml`, listed Writings only, newest first by `created`, at most 50; `pubDate` is `created`; the description is the summary; `guid` is the entry `id` with `isPermaLink="false"` from the cutover on.
- Components: a fenced block with info string `sidekick:<name>` and a YAML body. A remark plugin in `apps/www` loads the component, validates the props against its schema, renders it with `renderToStaticMarkup` and replaces the block. Components ship no JS. They live in `apps/www`, or in `@sidekick/ui` (with `react` as a peer) when domain-free. `tokens.css` lives in `@sidekick/ui` and the site imports it.
- JS budget: the theme pre-paint snippet and button, search, Copy, the Menu and Contents where `popover` cannot do it alone, and, for the year after the cutover, the moved-site notice.

**The cutover**

- In order: ossidekick.com added as a second Custom Domain on the Worker; the host PR (`site: "https://ossidekick.com"`, the notice, the feed `guid`); ossidekick.com checked; arkive.blog removed from the Worker and replaced by proxied placeholder records (`AAAA 100::`) for `arkive.blog` and `www.arkive.blog` and two Single Redirect rules; `www.ossidekick.com` redirected to the apex; `app.ossidekick.com` attached; the GitHub homepage set to `https://ossidekick.com` and the old `arkive` Pages project deleted.
- arkive.blog rules, both 301 with preserve query string off: no query, `concat("https://ossidekick.com", http.request.uri.path, "?from=arkive.blog")`; with a query, `concat("https://ossidekick.com", http.request.uri.path, "?", http.request.uri.query, "&from=arkive.blog")`. The tag goes in the query because a fragment in `Location` would replace the visitor's own.
- Notice: one hidden line in the layout, shown by the site script only when the URL has `from=arkive.blog`, which it then removes with `history.replaceState`. The canonical link is always the clean URL. The rules, the notice and its script are removed together when arkive.blog lapses, one year after the cutover.
- App on the same day: DNS-only `app` CNAME to Vercel, the domain on the Vercel project, `NEXT_PUBLIC_APP_URL=https://app.ossidekick.com`, Supabase Site URL `https://app.ossidekick.com` with the `vercel.app` URL, localhost and the preview pattern kept in the Redirect URLs.

### Testing Decisions

- **The sitemap diff is the URL test.** The paths in a new build's `sitemap.xml`, diffed against the live site's, print nothing. It runs at the end of Lesson 0 PR 1, on the Worker's `workers.dev` URL before arkive.blog moves, after each site lesson, and on ossidekick.com before arkive.blog becomes a redirect.
- **History:** `git log --follow` on a doc shows its Arkive commits.
- **CI:** Prettier, lint, typecheck (`astro check` for the site), build with the gates, tests, all green on every Lesson 0 PR.
- **Skips:** a throwaway content-only PR gets the `content` label and Vercel skips the App.
- **404:** a made-up path shows the site's 404 page, on `workers.dev` and on each domain.
- **Redirect check after the cutover:** a script reads the old sitemap and, for every path, expects a 301 from arkive.blog to the same path on ossidekick.com with `from=arkive.blog`, then a 200. It also checks a URL with a query, `www.arkive.blog`, `www.ossidekick.com` and `app.ossidekick.com`.
- **The new site:** the handover's acceptance checklist, with "3 of 13 milestones complete. Up next: Synergy" from today's plans, and Lighthouse accessibility 100 on Home, Writing, Doc and Folder pages in both themes.

### Out of Scope

- App features, and any change to the App beyond `apps/app` and its address.
- A docs feed, MDX, interactive islands in content, and Mantine on the site.
- `ossidekick.com/app` as a route.
