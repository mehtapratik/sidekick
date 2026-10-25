---
publish: true
id: prd.synergy.ticket-02
title: "What happens when a target is deleted"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: []
status: open
assignee:
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

When an entity is soft-deleted, what happens to the relationships that point at it: they stay and show a tombstone, they are soft-deleted with it, or the delete is blocked until they're resolved? Restoring the entity has to bring the answer back too.
