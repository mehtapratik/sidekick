---
publish: true
id: prd.synergy.ticket-06
title: "Links into a module you can't use"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: [05]
status: closed
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

What does a user see when a relationship points into a module they are no longer entitled to: the title from the index, a locked placeholder, or nothing? Does the relationship still count for staleness and backlinks?

## Resolution

Decided 2026-10-27.

- **Locked** (the viewer's own entity, in a module their account doesn't have): the link shows title, type and status from the entity index with a lock, and no preview, card body or live content. Later, the message says _why_ it's locked, because "not enabled" and "payment overdue" call for different actions; an overdue account gets a friendly prompt to renew, not a permission error.
- **Redacted** (an entity the viewer isn't allowed to see, once references between users exist): nothing about the target is shown. Long-term vision, beyond the MVP.
- **While locked, nothing changes on its own.** The relationship stays. The target can't change or be deleted while nobody can open it, so staleness and the delete block are moot. The user can unlink from the side they can still open, which removes the relationship for good, so re-enabling the module doesn't bring it back.
- **No new links** into a module the account doesn't have; the API refuses too.
- **One server-side check** where a link is resolved: the index gives the target's type, the type maps to its feature key, and the same entitlement check `withApiGuard` runs decides between calling the resolver and returning "locked". Core takes the feature key as data and never imports the registry. The browser never receives content it shouldn't.
- **API keys** follow the same rule, and a key's scopes narrow it further.
