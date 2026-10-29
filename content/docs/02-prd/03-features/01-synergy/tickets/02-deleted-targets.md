---
publish: true
id: prd.synergy.ticket-02
title: "What happens when a target is deleted"
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

When an entity is soft-deleted, what happens to the relationships that point at it: they stay and show a tombstone, they are soft-deleted with it, or the delete is blocked until they're resolved? Restoring the entity has to bring the answer back too.

## Resolution

Tentative (Pratik, 2026-10-27): **an entity with any incoming reference can't be deleted** (narrowed by [The starter relation vocabulary](04-starter-relation-vocabulary.md): only references block; associations never do), whether the referencer is the owner's own entity or, later, another user's. A referencing plan or essay that says "based on X" becomes unreliable the moment X disappears, and a tombstone doesn't repair that.

- To retire a referenced entity, the owner deprecates or supersedes it, which keeps it readable. Delete becomes possible once no references remain, because each referencer unlinked, accepted a replacement, or was itself deleted.
- Deleting a source soft-deletes its outgoing relationships with it (list members go with their header), which can free its targets for deletion.
- Restore brings back what was removed in the same action and never touches the version.
- "Deleted" is a lifecycle status in the entity index, so a title survives where a tombstone still appears (for example a relationship restored after its target was deleted).
- Permanent erasure (account deletion, privacy request) overrides the block. It erases incoming relationships, and the referencer shows a contentless "a linked item was permanently removed" placeholder.
- Links a viewer isn't allowed to see render redacted; see [Links into a module you can't use](06-links-into-disabled-modules.md).
- Revisit once real use shows whether blocking own references is too strict.
