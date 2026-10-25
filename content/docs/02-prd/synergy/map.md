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

A PRD in `02-prd/synergy/` for global linking and tagging, the substrate every Sidekick module builds on. It states what to build and why across four goals (connect, keep true, render, find), and breaks the work into phases with an MVP cut. Rewriting the Phase 3 implementation plan from it is a separate effort that starts once this map is clear.

## Notes

Sidekick's modules each hold a different kind of information: Taxila holds knowledge, War Room holds plans, Alter Ego holds conversations, Core Drive holds values. Each is useful alone. The value Pratik is after comes from the connections between them, the same way an iPhone, a Mac and a pair of AirPods are worth more together than apart. Connections bring a second problem with them, though. A plan that cites a datum is only as good as that datum, and when the datum changes or goes out of date, the plan has no way to know. Synergy exists to make connections cheap and keep them honest.

The nine motivations behind this effort, grouped:

- **Connect:** deep integration between modules (1); knowing who uses or references a document (8).
- **Keep true:** keeping multiple sources accurate (2); knowing when a referenced document is gone or has changed so the reference no longer holds (3); keeping sources that tell the same truth from diverging (6); communicating that a document is deprecated or superseded (9).
- **Render:** a concise form for machines and bots (4) and a narrative form for people (5).
- **Find:** making information easier to search for machines and people (7).

Pratik shares the whole vision first and scopes it afterwards. Phase 3 builds only part of this map, but its design has to stay open to all of it. Taxila's datums and knowledge graph are the main future tenant, and Phase 3 does not link documents or parts of documents itself.

Workflow: `wayfinder`, then `grill-with-docs`, then `to-specs`. Every artifact lives in `02-prd/synergy/`. Grilling tickets consult the `grilling` and `domain-modeling` skills. The PRD's narrative "why" sections use the full `earned-conviction` voice. Maps, tickets and specs use only its sentence-level rules (no hedging, active voice, its banned words, naming a claim's limits) and stay terse. Settled terms go to `07-glossary/`. Tickets live in `tickets/`, one file each, with `type`, `blocked_by`, `status` and `assignee` in frontmatter until an issue tracker is chosen. A session claims a ticket by setting `assignee` before any work.

Reference material: the Margins essay (`writings.margins`) split into about twenty datums, an Obsidian folder Pratik shared on 2026-10-25. It shows datums, labelled links, list links and cycles in practice.

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
- **Relation types:** Sidekick ships a starter vocabulary. Each user can add their own, which become presets for that user only.
- **List relationships:** one table. A single link is one row. A list link is a header row (label, type, tags, no target) plus one member row per target with its own position and version snapshot. Revisit if it grows clumsy.
- **Entity index:** core keeps one thin row per linkable entity, created with the entity: id, type, owner, title, version, status and updated time. Tags live in core beside it. Its job is cross-module questions (staleness, backlinks, everything deprecated, search) and real foreign keys for relationships. Richer render data comes from a resolver each module registers, called when a Rich Live Link renders.
- **Tags:** flat (`finance`) and `key:value` (`domain:spending`) both work. People, AI and jobs can all apply them, and each tag records who applied it.

## Not yet specified

- **Events between modules.** A real event bus for notifications and Factory automations. The version bump on every write is the seed; the shape waits until notifications are designed.
- **Block-level links.** Linking to a paragraph or a claim inside a document, once the editor exists (Phase 5).
- **Judging intent.** Whether AI or something more deterministic decides that a changed target no longer supports a reference.
- **Drift between near-duplicates.** Detecting two entries that tell the same truth differently, beyond the no-copies rule.
- **Publishing.** What a Rich Live Link becomes on a public Taxila post, where readers can't follow private links.

## Out of scope

- **Sharing between users.** Synergy is single-user. Multi-user references would be a fresh effort with a redrawn destination.
- **Tracking external readers.** No one can know who cites a published post from outside Sidekick.
