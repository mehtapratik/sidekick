---
publish: true
id: prd.synergy.ticket-11
title: "Links anchored to part of an entity"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

> **Retired 2026-10-29.** The outcome lives in the [[02-prd/03-features/01-synergy/00.prd.features.synergy.overview|Synergy PRD]] and [[02-prd/03-features/01-synergy/spec|spec]]. This page stays as the record of how it was decided.

## Question

A user can select part of an entity (a word, a sentence, a paragraph) and make it the source of a link, and a link may also point at part of its target. Where does each anchor live, and what happens to the relationship when the anchored text is edited or deleted?

## Round 1 answers (2026-10-27)

- Selecting text and linking it is the same thing as a labeled link. Both render as a fourth Rich Live Link display type, **minimal**: only the label, with a superscript dot for a critical state. No type, status, `*` or `#`. Hover or click details are post-MVP.
- Removing a link is never special. Whoever can edit the source can delete the anchored text or the link, and the relationship goes with it. (Only deleting a referenced _target_ is ever blocked; see ticket 02.)
- Target anchors: block level to start, but word and sentence anchors are in MVP scope.
- Staleness stays per entity, not per block.
- One mark, one link. Anchors can't overlap.
- Target block deleted: see Resolution.

## Resolution (2026-10-27)

- A source anchor lives in the source's content as a mark carrying one relationship id. Text-anchored and labeled links render as **minimal** (label only, plus a dot).
- The dot shows for changed, deprecated, superseded and deleted. Edited gets none. Deleted, locked and redacted labels render as plain, unclickable text. One dot, one colour, for the MVP.
- Deleting a link or its anchored text removes the relationship, whoever does it.
- **Target block deleted:** the relationship is deleted with the block. No fallback to the whole entity, because re-anchoring later is debt nobody pays. So "part gone" is never a lasting state.
   - Agreed: a source mark whose relationship no longer exists renders as plain text. The source module drops the mark the next time it saves, so core never edits anyone's content.
   - Agreed (Pratik): removing a link changes the source, so it counts as an update. When core deletes the relationship, it bumps the source's revision and `updated` in the index right away (actor: system, with the reason), never its version. Stripping the leftover mark on the next save is housekeeping and doesn't bump again.
   - Agreed: the target's editor warns before deleting a block that has incoming links ("2 links point here and will be removed"). It warns but doesn't block.
- Target anchors: block level first; word and sentence anchors are MVP scope.
- Staleness stays per entity. One mark, one link, no overlaps.
- **System design:** how a word or sentence anchor survives edits (text-quote selectors, position plus context, CRDT-relative positions, fuzzy re-matching). Pratik wants a survey of the common algorithms and how other tools handle it.

**Amended 2026-10-28 (Pratik, PRD review):** "one mark, one link" now means a mark carries one link, not that a link has one mark. A relationship can be **mentioned** any number of times, from its source and from its target (target mentions read with the inverse name), so one dependency can be cited from both sides without a second, looping reference. No two entities may reference each other, directly or indirectly; several same-direction references with different labels stay allowed. The relationship goes when unlinked or when the source's last mention is removed. The target's mentions then show a neutral "No longer linked" until their author dismisses them (plain text stays) or relinks. Deleted relationships are tombstones: undo restores the same id; linking again later creates a new relationship that old mentions can be relinked to. See the PRD's Relationships page, Mentions.

**Amended 2026-10-28 (Pratik, PRD review): referenced passages are protected.** This reverses "the relationship is deleted with the block" for references. A passage with incoming references is protected like a referenced entity: deleting it offers keep, save as a new version (referencers get `#` and "passage removed" until they re-anchor, widen to the whole entity, or unlink), or supersede. Deprecate isn't offered, because it wouldn't keep the passage readable. Editing a referenced passage asks whether it is a new version. Core checks every save, autosave included, and refuses `passage_referenced` unless the save is a new version; the check costs the size of the change. Associations still go with the passage. Anchor tracking: operation-based (editor steps, CRDT relative positions) is the bar to beat, with text-quote re-matching as the fallback; autosave is a fast-follow after the MVP.
