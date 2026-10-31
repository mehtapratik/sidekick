---
publish: true
id: decision.technical.anchors-in-content
created: 2026-10-30
kind: decision
updated: 2026-10-31
version: 1.1.0
tags:
   - decision
   - technical
   - architecture-decision
   - synergy
   - anchors
status: accepted
applies_to:
   - "[[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships]]"
   - "[[03-system-design/functional-design/04-synergy/anchors-survey]]"
---

## What

A link can point at a **passage** of its target: a block, or some words inside one. The passage is identified by an **anchor** stored in the target's own content, with a quote as the safety net. The [[03-system-design/functional-design/04-synergy/anchors-survey|survey]] has the algorithms compared and the full reasoning.

- **Block passages.** Every block node carries a stable `id` attribute (Tiptap's UniqueID extension, MIT). Splitting keeps the id on the first half. Merging keeps the first id and drops the second, which removes that passage. Moving a block keeps its id.
- **Word and sentence passages.** An invisible, non-inclusive `anchor` mark with an `id`, added to the target's content by the target's provider when the first link to that passage is made. Later links to the same passage reuse it. Anchors may overlap. Adding one moves the target's `content_seq` and `updated_at`, never its version or revision ([[06-decisions/technical/content-sequence|Content sequence]]).
- **No pre-assigned ids below the block.** Ids on every word or sentence would bloat the content, slow the editor and churn as sentences split. A passage that isn't linked yet is addressed as block id plus quoted text (`doc:<id>/block:<id>?text=<words>`, like browser text fragments) and becomes an anchor when a link is made from it.
- **The link stores** `to_anchor = { id, quote: { exact, prefix, suffix } }`, or nothing when it targets the whole entity. The quote is captured at link time; it shows what was linked after a removal, re-attaches anchors when Refresh replaces captured external content, and lets the API suggest a repair to a bot that dropped an anchor.
- **`from_anchor` is dropped.** The source side is covered by mentions in the source's content ([[06-decisions/technical/mentions-and-link-lifetime|Mentions and link lifetime]]).
- **One save call, reporting the current set** (Pratik, 2026-10-31). On every save the provider sends, inside its own transaction, every block and anchor id in the new content and every relationship id it mentions, extracted with the shared `extractRefs` helper. Synergy keeps the linked passages in `entity_anchors` and the mentions in `entity_mentions`, and works out what is gone itself. It refuses with `passage_referenced` when a reference targets a gone passage and the save isn't a new version; on a new version it records `removed_in_version` on the anchor row, which is what makes the reference show "passage removed". It removes associations into gone passages, moving only their sources' `updated_at` (actor system, with the reason; the source's text didn't change, so no revision and no false "edited" dot for the source's own referencers). It tombstones links their source no longer mentions or cites, bumps the counters and writes the outbox event.

## Why

- **Current set, not changes.** With each provider computing the changes, a missed call (an ops script that writes content directly) or a bug in one provider's comparison would leave `mentioned` and passage protection wrong forever, with nothing to repair them. The current set heals on the next save, is safe to retry, and is compared once, in Synergy. It runs in the same request and transaction as the provider's save, so it adds no service hop: one indexed read of the stored set, and writes only when something changed.
- Every tool that owns its content anchors inside it (Notion, Google Docs, Word, Obsidian, Logseq); tools that don't (Hypothesis, browser text fragments) fall back to quotes. Sidekick owns every target, including captured external copies.
- ProseMirror carries marks and attributes through every edit step, so anchors are as exact as operation-based mapping in the editor. Unlike operation mapping, they also survive whole-document saves from bots and the API (One Interface), and they move into Yjs unchanged when offline sync or collaboration arrives.
- The quote can't be backfilled once the text changes, so it ships in Phase 3 (Cost to Add Later).

## Consequences

- A server-added anchor makes an open editor's next save stale (409). The editor fetches the latest content, copies in the anchors it lacks by block id and quote, and saves again; a task for the editor lesson.
- The save payload carries every block id, so it grows with the number of blocks; still small next to the content it accompanies.
- Passages need Tiptap. The plans put Tiptap in Phase 5 and Taxila's passages in Phase 4; planning resolves the order.
- Markdown export drops anchors; importing re-attaches them by quote.
- A bot that drops an anchor mark gets `passage_referenced` with the quotes, never silent loss. Sending whole Tiptap documents with marks it doesn't understand is hard for a language model; a block-level patch endpoint is a post-MVP candidate.
- The quote re-matcher lives in `@sidekick/synergy/contracts`. When the best match is weak, it asks the user instead of guessing.
- Cut and paste as two separate saves looks like a removal in between; the editor holds the save until the paste lands.
- References between users (post-MVP) rely on the quote alone, because nobody writes an anchor into another person's content.
