---
publish: true
id: prd.synergy.ticket-04
title: "The starter relation vocabulary"
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

Which relation types Sidekick ships with, which of them count as references (staleness applies) and which as associations (no alerts), and whether each type carries an inverse name ("explains" / "explained by") for backlinks.

## Resolution

Decided 2026-10-27.

- **Two kinds.** A **reference** derives its work or meaning from its target, so a change to the target matters and deleting the target is blocked. An **association** only connects ("we spoke to Princeton's Economic Study Team"): the source keeps its meaning without the target, so it never goes stale and never blocks a delete. The type decides the kind; an untyped link is a reference.
- **Direction.** A link always points from the dependent entity to what it relies on. A plan built from a PRD links `plan derived-from PRD`. A PRD that mentions the plan implementing it uses an association, so deleting the plan stays possible.
- **Starter set (MVP):**
   - References: `derived-from` ↔ `source-of`, `cites` ↔ `cited-by`, `supported-by` ↔ `evidence-for`, `explained-by` ↔ `explains`
   - Associations: `inspired-by` ↔ `inspiration-for` (the new idea keeps its meaning without its inspiration; added by Pratik), `next` ↔ `previous`, `related-to` (symmetric), `contradicts` (symmetric)
   - Special: `supersedes` ↔ `superseded-by`. Creating it marks the target superseded after one confirmation that names how many entities reference it.
   - `depends-on` is dropped from the starter set: it overlapped `derived-from` and read as the wrong direction.
- **Inverse names:** every system type has one, shown on backlinks.
- **User-defined types:** out of the MVP. Revisit with what the MVP teaches. (This narrows the earlier "users can add their own types".)
- **Managing types and tags:** rename and merge by id, a merge leaves an alias, a type in use can't be deleted. Both tags and types can be **deprecated**: existing uses stay, new uses are refused. System types can be hidden from suggestions.
