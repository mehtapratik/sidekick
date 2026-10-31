---
publish: false
id: system-design.functional-design.synergy.anchors-survey
title: "Survey: anchors that survive edits"
created: 2026-10-30
updated: 2026-10-31
kind: research
tags:
   - system-design
   - synergy
   - anchors
---

Research for system-design question 3: how a link into part of an entity (a paragraph, a sentence, a word) keeps pointing at the right text while that text is edited. It ends with a recommendation; the decision is Pratik's.

## What the anchors must do

From the PRD ([[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships|Relationships]], anchored links) and the spec:

1. **Source anchors.** Selected text in the source becomes a mention: a mark carrying one relationship id.
2. **Target anchors.** A relationship can point at a block (paragraph, heading, list item) or at words and sentences inside one, stored on the relationship as `to_anchor`.
3. **Survive edits.** Typing before, after or inside the passage keeps the anchor on the same words. A block keeps its anchor when moved. A merge counts as a delete.
4. **Know when a passage is gone.** A save that removes a referenced passage is refused with `passage_referenced` unless it is a new version. Associations into it are removed with it.
5. **Cost the size of the change,** so the check can run at autosave rates.
6. **Work for every consumer.** The editor sends a document after many small steps; a bot or the API sends a whole new document in one request (One Interface).
7. **Survive offline and concurrent edits** once the PWA (Phase 8) and, much later, collaboration arrive.

Sidekick's editor is Tiptap ([[03-system-design/technology-stack|technology stack]]), which is ProseMirror underneath, and content is stored as its JSON.

## The common algorithms

### 1. Character offsets

Store "characters 120 to 145 of the body". The W3C Web Annotation model calls this a `TextPositionSelector`.

- Exact and tiny.
- Any edit before the passage shifts it, so it breaks at the first typo fix. Nobody uses offsets alone.

### 2. Text quote with context

Store the quoted text plus a few words before and after it, and find it again by searching (W3C `TextQuoteSelector`: `exact`, `prefix`, `suffix`). Hypothesis stores this alongside a position and a DOM range, tries the position first, then searches for the quote with fuzzy matching, and shows the annotation as "orphaned" when nothing matches well enough. Browsers' text fragments (`#:~:text=prefix-,start,end,-suffix`) are the same idea in a URL.

- Works on content you don't control and can't change. That is why annotation tools use it.
- Survives most edits around the passage and needs nothing from the editor.
- Guesses. Repeated phrases are ambiguous, a reworded passage may re-attach to the wrong place or orphan, and you can't tell "edited" from "deleted" reliably.
- The search costs the size of the document on every check.

### 3. Stable block ids

Give every block a persistent id and link to the id. Notion (every block is a UUID-addressed record, "copy link to block"), Roam (`((uid))`), Logseq (writes `id:: <uuid>` into a block the first time it is referenced) and Obsidian (appends `^blockid` to a paragraph when you link to it) all work this way. Tiptap has a UniqueID extension that keeps an id attribute on chosen node types.

- Exact, cheap, and indifferent to edits inside or around the block.
- Moving the block keeps the id. Splitting keeps it on the first half. Merging keeps only one id, so the other block's anchor is gone, which matches "a merge counts as a delete".
- Only as fine as a block. It doesn't cover words or sentences.

### 4. Operation-based mapping

Store a position and move it through every edit operation. ProseMirror's `Mapping` maps a position through each step and reports whether the content around it was deleted. Google Docs keeps comment ranges attached the same way, through operational transformation on its servers.

- Exact for every edit the editor makes, including detecting deletion.
- Needs every change to arrive as operations. A bot that sends a whole new document has no operations, so the server falls back to a diff and loses the exactness.
- The server has to store positions and re-map them on every save, so each save touches every anchor in the document.

### 5. CRDT relative positions

In a CRDT document every character has a permanent id. Yjs `RelativePosition` stores "just after character X" instead of an index, and resolves it against the current document, even after concurrent or offline edits. Automerge cursors and the Peritext rich-text CRDT (Ink & Switch) anchor formatting marks to character ids in the same way.

- The strongest option for concurrent and offline editing.
- Only works if the document is stored as a CRDT: a storage decision for every module, made today for a collaboration feature that is four to five years out.
- A whole-document save from a bot still has to be diffed into the CRDT to keep the character ids.

### 6. Anchors stored in the content

Put the anchor in the target's content itself: an invisible marker that travels with the text. Word bookmarks (`bookmarkStart` and `bookmarkEnd` around a range), HTML `id` fragments, Obsidian's `^blockid` and Logseq's `id::` are this, and so are inline comments in Notion and Google Docs, where the comment's id sits in the text model as an annotation on the range.

- The anchor moves with the text through every edit, by every tool, because it _is_ the text's formatting. In ProseMirror a mark is carried through every step for free: no mapping code to write.
- Survives whole-document saves, as long as the sender keeps the markers. A sender that drops one has removed the passage, which is exactly what the referenced-passage rule should catch.
- Works with a CRDT later without change: marks and node attributes are part of the Yjs document.
- Costs a write to the target's content when the anchor is first made, and only works on content you own.

## How the tools split

| Tool                          | Owns the content? | Block anchors           | Text anchors              |
| ----------------------------- | ----------------- | ----------------------- | ------------------------- |
| Notion                        | yes               | block UUID              | annotation in the text    |
| Google Docs                   | yes               | headings and bookmarks  | ranges kept by OT         |
| Word                          | yes               | bookmarks               | bookmarks, comment ranges |
| Roam, Logseq, Obsidian        | yes               | block id in the content | none                      |
| Hypothesis, browser fragments | no                | none                    | text quote with context   |

The pattern is consistent: where the tool owns the content, the anchor lives in the content; where it doesn't, it re-finds a quote.

## Recommendation: anchors in the content, with a text quote as the safety net

Sidekick owns every target's content, including captured external content ([[06-decisions/technical/capture-external-content|decision]]). So:

1. **Block anchors are block ids.** Every block node in the Tiptap schema carries an `id` attribute, generated on the client. Split keeps it on the first part; merge keeps the first id and drops the second (a delete); drag-and-drop keeps it. Pasted duplicates get fresh ids.
2. **Word and sentence anchors are an `anchor` mark** with an `id` attribute, added to the target's content when the first link is made into that passage. It is non-inclusive (typing at its edges doesn't extend it) and doesn't exclude itself, so overlapping anchors (a sentence, and a word inside it) can coexist. A second link to the same passage reuses the same anchor.
3. **The relationship stores the anchor id and a quote.** `to_anchor` is `{ id, quote: { exact, prefix, suffix } }`, with the quote taken when the link is made. The quote shows what was linked when a passage is removed ("passage removed: …"), re-attaches anchors when Refresh replaces a captured external copy, and lets the API suggest a repair to a bot that dropped a marker. It can't be backfilled later, because the text it records will have changed, so it ships in Phase 3.
4. **Source mentions are already in the content** (a link mark carrying the relationship id). `from_anchor` isn't needed, so I'd drop it from the schema.
5. **One save call reports everything.** On every save the provider calls Synergy inside its own transaction with the base `content_seq`, revision or version, the optional change note, and the **current sets** in the new content: every block and anchor id, and every mentioned relationship id. Synergy stores the last sets (`entity_anchors`, `entity_mentions`) and works out the difference itself, so a missed or buggy save is corrected by the next one (revised 2026-10-31; this first said the provider would send the changes). Then, in that transaction: checks `content_seq` (409 on a stale one); refuses with `passage_referenced` if a reference points at a gone anchor and this isn't a new version; soft-deletes associations into gone anchors, moving only their sources' `updated_at`; soft-deletes relationships whose source lost its last content mention and doesn't cite them (target mentions change nothing); bumps the counters and `edited_at`; writes the outbox event.
6. **Cost.** Extracting the ids is one walk over the new JSON, which the save already parses. The database work is one indexed read of the stored sets, plus writes only for what changed, through the `(to_id, to_anchor_id)` index.
7. **Making an anchor is the target provider's write,** not Synergy's: it adds the mark and moves `content_seq` and `updated_at`, never the version or revision ([[06-decisions/technical/content-sequence|Content sequence]]). An editor that has the target open gets 409 on its next save, fetches the latest content, copies in the anchors it lacks by block id and quote, and saves again. In the MVP the linker always owns the target. References between users (post-MVP) fall back to the quote alone, because nobody writes into another person's document.
8. **Offline and concurrent edits:** nothing extra. When the PWA or collaboration brings Yjs, marks and node attributes live in the Yjs document and survive concurrent edits. Yjs relative positions are only needed for live cursors.

### Why this beats the bar in the handover

Operation-based anchors (option 4, or 5 with Yjs) are exact only for edits that arrive as operations, and bots and the API send whole documents. Anchors in the content are just as exact for the editor, because ProseMirror carries marks and attributes through every step for free. They also hold for whole-document saves, and they move to Yjs later unchanged. The text quote covers the one case anchors can't: content replaced from outside.

### Costs and risks

- The target's JSON carries anchor ids: a few dozen bytes per anchor.
- Markdown export drops anchors (no syntax for them). Importing markdown back re-attaches them by quote.
- A bot must send back marks it doesn't understand. One that doesn't gets `passage_referenced` with the quotes, never silent loss.
- Cut and paste as two separate saves looks like a removal in between. The editor should hold the save, or autosave gets refused until the paste lands. Handle it in the editor lesson.

## Link shapes

One relationship row covers every combination of where a link starts and where it lands. On the source side the link is held by a cited mention (a field or links panel) or by a direct or alias mention in the source's content. The target side is either the whole entity (`to_anchor` empty) or a passage (`to_anchor` set).

| Shape              | Example                                                                                        | Source side                        | Target side                       |
| ------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| Entity to entity   | A plan's links panel lists a PRD                                                               | cited mention                      | `to_anchor` empty                 |
| Mention to entity  | "In continuation to my friend's previous article" in Doc A links Doc B                         | link mark in A carrying the rel id | `to_anchor` empty                 |
| Mention to passage | "identified in response to the conclusion made in" in Doc A links the conclusion sentence of B | link mark in A carrying the rel id | anchor mark in B, `to_anchor` set |
| Entity to passage  | Doc A's `related-to` field links a passage of Doc B                                            | cited mention                      | anchor mark in B, `to_anchor` set |

**Three kinds of mention** (Pratik, 2026-10-30): a **direct mention** shows the link itself (minimal, inline, card or preview; display type belongs to the mention); an **alias mention** lets the author's own words carry the link; a **cited mention** holds the link in a field or a links panel, outside the content. A link lives while its source mentions it in any of the three ways, and is soft-deleted when the source drops its last one. Target mentions never keep a link alive.

Synergy tracks this with two booleans on the relationship: `cited` (the source cites it; set and cleared by the field, the links panel or the API) and `mentioned` (the source's content holds at least one direct or alias mention; maintained by Synergy from the current set of mentions each save reports). The link is soft-deleted when both are false. A source field such as `related-to` is a view of the source's cited links of that type, so the provider stores nothing extra. Creating a link through the API without a content mention creates a cited one.

## Consequences for the plan

- Phase 3 stores `to_anchor` as id plus quote, adds the `(to_id, to_anchor_id)` index, and adds `cited` and `mentioned` to relationships, and builds the save call with the current sets of anchors and mentions. A minimal direct mention of a link with no label shows the target's title. Mock note bodies are minimal Tiptap JSON, so the tests can remove anchors and mentions.
- Text anchors need Tiptap, but the current plans put Tiptap in Phase 5 and Taxila's anchors in Phase 4 (on a plain textarea). Planning must either move the shared editor ahead of Taxila's anchors, or move Taxila's anchors to Phase 5.
