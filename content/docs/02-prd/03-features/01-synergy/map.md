---
publish: true
id: prd.synergy.map
title: "Synergy: wayfinder map"
created: 2026-10-25
kind: plan
version: 0.1.0
status: draft
tags:
   - prd
   - synergy
   - global-tagging-and-linking
   - wayfinder
---

## Destination

A PRD in `02-prd/03-features/01-synergy/` for global linking and tagging, the substrate every Sidekick module builds on. It states what to build and why across four goals (connect, keep true, render, find), and breaks the work into phases with an MVP cut. Rewriting the Phase 3 implementation plan from it is a separate effort that starts once this map is clear.

## Notes

Sidekick's modules each hold a different kind of information: Taxila holds knowledge, War Room holds plans, Alter Ego holds conversations, Core Drive holds values. Each is useful alone. The value Pratik is after comes from the connections between them, the same way an iPhone, a Mac and a pair of AirPods are worth more together than apart. Connections bring a second problem with them, though. A plan that cites a datum is only as good as that datum, and when the datum changes or goes out of date, the plan has no way to know. Synergy exists to make connections cheap and keep them honest.

The nine motivations behind this effort, grouped:

- **Connect:** deep integration between modules (1); knowing who uses or references a document (8).
- **Keep true:** keeping multiple sources accurate (2); knowing when a referenced document is gone or has changed so the reference no longer holds (3); keeping sources that tell the same truth from diverging (6); communicating that a document is deprecated or superseded (9).
- **Render:** a concise form for machines and bots (4) and a narrative form for people (5).
- **Find:** making information easier to search for machines and people (7).

Pratik shares the whole vision first and scopes it afterwards. Phase 3 builds only part of this map, but its design has to stay open to all of it. Taxila's datums and knowledge graph are the main future tenant, and Phase 3 does not link documents or parts of documents itself.

Workflow: `wayfinder`, then `grill-with-docs`, then `to-specs`. Every artifact lives in `02-prd/03-features/01-synergy/`. Grilling tickets consult the `grilling` and `domain-modeling` skills. The PRD's narrative "why" sections use the full `earned-conviction` voice. Maps, tickets and specs use only its sentence-level rules (no hedging, active voice, its banned words, naming a claim's limits) and stay terse. Settled terms go to `07-glossary/`. Tickets live in `tickets/`, one file each, with `type`, `blocked_by`, `status` and `assignee` in frontmatter until an issue tracker is chosen. A session claims a ticket by setting `assignee` before any work.

Reference material: the Margins essay (`writings.margins`) split into about twenty datums, an Obsidian folder Pratik shared on 2026-10-25. It shows datums, labelled links and list links in practice. It has no cycles.

## Decisions so far

Settled while charting, before any ticket existed:

- **Scope:** one PRD with two layers. Links and metadata come first; integrity (version-aware references, change alerts, deprecation) builds on the same substrate later.
- **Outside things:** links to URLs and other external sources exist and belong to Taxila.
- **Machine consumers:** bots, scheduled jobs and agents in the MVP. Crawlers arrive later, when Taxila publishes content as a blog.
- **Who uses this:** internal referencers only. Any entity in any module can be a referencer or a target: a blog post references a War Room plan, a War Room plan references a scheduled job to judge whether it needs optimizing, an Alter Ego conversation references a datum. External readers of a published post can't be tracked.
- **Staleness:** a reference remembers the target's version when it was made and flags when the target moves past it. Judging whether a change still supports the reference's intent (by AI or otherwise) is tentative and later.
- **Lifecycle:** one shared status in core (active, deprecated, superseded). "Superseded by" is a `supersedes` relationship.
- **Notifications:** later, most likely in Taxila, configurable per user. The default notifies the author (how many referencers are affected) and each referencer. Anyone opening a referrer sees the target marked deprecated or superseded.
- **Handoff:** automation between modules belongs to Factory, not to Synergy.
- **No copies:** a document is never copied when referenced. It appears as a Rich Live Link.
- **Rich Live Link:** the component that renders a relationship inside a document. Display type (inline, card, live preview) is a prop chosen where it renders, so one document can show several in different types. A draft of the component belongs to Synergy so every module can use it.
- **Entity:** anything linkable in any module (a datum, a War Room plan, a scheduled job, an Alter Ego conversation). "Datum" stays the name of Taxila's compact entry.
- **Datum:** Taxila's smallest meaningful piece of knowledge, one fact per entry. The user picks a compact entry (datum) or a narrative entry. A narrative can be generated from datums, or datums split from a narrative, and either way the result links to its sources with `derived-from`.
- **Relationship:** the stored link, a first-class row with its own id, tags and metadata. Its free-text label says what the target answers from this source, so the same pair can be linked more than once ("Am I lying to myself?" and "Why?" both lead to the same datum). Linking to a relationship waits until it's needed.
- **Relation types:** Sidekick ships a starter vocabulary. User-defined types are out of the MVP (narrowed by ticket 04).
- **List relationships:** one table. A single link is one row. A list link is a header row (label, type, tags, no target) plus one member row per target with its own position and version snapshot. Revisit if it grows clumsy.
- **Entity index:** core keeps one thin row per linkable entity, created with the entity: id, type, owner, title, version, status and updated time. Tags live in core beside it. Its job is cross-module questions (staleness, backlinks, everything deprecated, search) and real foreign keys for relationships. Richer render data comes from a resolver each module registers, called when a Rich Live Link renders.
- [What counts as a change](tickets/01-what-counts-as-a-change.md): two counters. The author flags a version for changes that might invalidate references, with a required change note; every other save bumps the revision. Only title, body and blurb count.
- [Where the resolver contract lives](tickets/05-resolver-contract-home.md) (research): facts in `research/05`. Three options fit today's boundaries; the contract in core with the app wiring resolvers in matches the `withApiGuard` precedent.
- [Search across modules](tickets/07-search-across-modules.md) (research): facts in `research/07`. Full text plus `pg_trgm` covers the MVP; new RLS policies compare `uuid` to `uuid` so indexes stay usable.
- [What happens when a target is deleted](tickets/02-deleted-targets.md) (tentative): an entity with any incoming reference can't be deleted; deprecate or supersede instead. Erasure overrides and leaves a contentless placeholder.
- [What makes two tags the same](tickets/03-tag-identity.md): lowercase letters, digits and dashes with one optional `key:value` colon; tags are per-user records, renamed and merged by id; AI tags wait for approval unless the user opts in.
- [The starter relation vocabulary](tickets/04-starter-relation-vocabulary.md): references (derive meaning from the target; stale warnings; block delete) and associations (only connect). Untyped links are references. Eight starter types plus `supersedes`, each with an inverse. User-defined types are out of the MVP; types and tags can be deprecated.
- [Links into a module you can't use](tickets/06-links-into-disabled-modules.md): locked links show title, type and status with a lock and no content; redacted links (other users, later) show nothing. One server-side entitlement check where a link resolves.
- [Cycles between links](tickets/12-cycles.md): references can't form a cycle, associations can. The picker greys out entities that would close a loop, and the server checks again on create. Scaling the lookup is for system design.
- [Rich Live Link draft](tickets/08-rich-live-link-draft.md): a labeled link is always inline (`{type} - {label} [{status}]`); an unlabeled one is inline, card or live preview. One status, plus a `*` (edited) or `#` (changed) mark. Inline reads only the index; card and preview call the resolver.
- [Links anchored to part of an entity](tickets/11-anchored-links.md): selected text becomes a minimal link (label plus a dot). Deleting a target block deletes the links into it. Word and sentence target anchors are MVP; how they survive edits is for system design.
- [What Phase 3 can prove](tickets/09-what-phase-3-can-prove.md): mock note and task modules in `packages/ops`. The only UI is the Rich Live Link component, on a provider model (each package renders its own content inside the component's frame). Exit is integration tests through the public API. Search covers title and metadata only.
- [Scope and phases](tickets/10-scoping-and-phases.md): judge by cost to add later. Phase 3 is 3a (store and rules) and 3b (render and find) with the backend and frontend foundations; the rest of the MVP lands with Taxila, Zinsser, the AI layer and War Room. All user metadata is optional.
- **Tags:** flat (`finance`) and `key:value` (`domain:spending`) both work. People, AI and jobs can all apply them, and each tag records who applied it.

## Not yet specified

- **Events between modules.** A real event bus for notifications and Factory automations. The version bump on every write is the seed; the shape waits until notifications are designed.
- **Anchors that survive edits.** How a word or sentence target anchor keeps pointing at the right text as the target changes. System design surveys the common algorithms and how other tools do it.
- **Search providers.** Whether core passes a query to each module and merges the matches, like Rich Live Link renderers.
- **Testing modules in isolation.** Storybook or something better for mocks and component tests.
- **Judging intent.** Whether AI or something more deterministic decides that a changed target no longer supports a reference.
- **Drift between near-duplicates.** Detecting two entries that tell the same truth differently, beyond the no-copies rule.
- **Publishing.** What a Rich Live Link becomes on a public Taxila post, where readers can't follow private links.

## Post-MVP

- **References between users.** Four or more years out under Individual First. `owner` on every row and the redacted state keep the door open. The "allow references" setting and the npm-unpublish delete rule wait until then.

## Out of scope

- **Tracking external readers.** No one can know who cites a published post from outside Sidekick.
