---
publish: true
id: prd.synergy.ticket-01
title: "What counts as a change"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: []
status: closed
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

Staleness compares a target's version with the version a reference recorded. Does every save bump that version, or only an edit the author marks as material? A typo fix shouldn't flag thirty references as stale, and a silent rewrite shouldn't flag none.

## Resolution

Two counters on every entity. The **version** goes up only when the author flags a change that might invalidate one or more references. The **revision** goes up on every other save: new content, grammar, formatting. References record both and compare the version.

- The author decides. An AI assistant may advise on the impact for dependents, but the author has the final say. Marking material changes automatically on save is a non-MVP option kept open.
- A version bump requires a one-line change note, stored in a version log in core. The stale flag on each reference shows it.
- If nobody flags a rewrite, readers of a referrer still see "edited since you linked" from the revision.
- Only author content counts: title, body and blurb. Metadata, tags and status never bump either counter. A status change (deprecated, superseded) is a separate signal that always alerts.
- A referencer can accept a change, which moves the stored version to the current one and clears the flag.
- Versions are plain integers, shown as "v3 · rev 12".
- Diffs are non-MVP. Keeping full content snapshots per version, which diffs need, is each module's job in its own PRD.
