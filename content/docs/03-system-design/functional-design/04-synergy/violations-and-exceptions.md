---
publish: true
id: system-design.functional-design.04-synergy.violations-and-exceptions
title: Violations and Exceptions
created: 2026-11-01
updated: 2026-11-08
kind: spec
version: 1.0.1
tags:
   - system-design
   - synergy
status: accepted
---

**D212** `decision` #synergy #violations: `violates` is an association and `exception-to` a reference; a violation has no status, so unlinking resolves it and retyping it to `exception-to` waives it. derived-from [[D161]] derived-from [[D162]] derived-from [[D163]] derived-from [[D164]]

## What

Two relation types join the starter vocabulary, as seeded rows with copy keys and no new code:

- **`violates` ↔ `violated-by`**, an association from the offender to the rule, principle or decision it breaks.
- **`exception-to` ↔ `has-exception`**, a reference from an exception to the rule it limits. Where the exception applies is said in its own content, not on the link.

A violation has no status. **Open** is a live `violates` link. **Resolved** is unlinking it (`DELETE /links/:id`). **Waived** is changing its type to `exception-to` (`PATCH /links/:id`), which keeps the relationship id. A type change from an association to a reference takes a fresh snapshot of the target. `GET /entities/:id/links` takes an optional `type` filter, and `GET /links?type=` lists links of one type across the whole graph. The rules as the product states them are in [[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships#Violations and exceptions|Violations and exceptions]].

## Why

- **The gap was real.** Dogfooding Synergy on Arkive needed "this breaks that" and "this holds except here". `contradicts` is symmetric, so it can't say which side is at fault, and it would mark a rule wrong when only its scope is limited.
- **`violates` is an association** because the offender's meaning doesn't come from the rule. As a reference it would refuse true facts as cycles (the Phase 3 plan is derived from the spec, and one of its decisions overrides the spec), and it would block deleting a rule while anything breaks it, though dropping the rule is one fair way to settle the violation. It gives up a dot when the rule changes; the link still shows the rule's status.
- **`exception-to` is a reference** because an exception means nothing without its rule. When the rule gets a new version, the exception's red dot prompts a check that it still holds, and the rule can't be deleted out from under it. A rule is never derived from its own exception, so the cycle rule doesn't get in the way.
- **Scope in the text, not on the link.** A scope key (a list of tables, say) would be a new field nothing reads. The optional label can name it briefly; structured scope is cheap to add later.
- **Waive by retyping.** A waiver is a standing fact you want to see on the rule ("has exception"), so it stays a live link. Keeping the id keeps its mentions working, and the outbox records the type change as history.
- **Fresh snapshot on the change.** The author looked at the rule when they waived, so the link shouldn't open with a red dot from changes made while it was a violation.
- **Rejected: tombstone reasons** (`resolved`, `waived`). A waived violation isn't gone. A tombstone would turn its mentions into "No longer linked" and drop it from the rule's backlinks.
- **Rejected: a status column** (open, resolved, waived, with who, when and why). That is issue tracking, a post-MVP candidate in [[08.prd.features.synergy.scope-and-phases#Post-MVP candidates|scope and phases]]. A nullable column is cheap to add later ([[principle.cost-to-add-later|Cost to Add Later]]). With issue tracking, a waiver would still end as an `exception-to` link, with the closed violation kept beside it.
- **The type filter in lesson 6, the graph-wide list in 3b.** The filter is one more condition on a route lesson 6 builds, covered by the `from_id` and `to_id` indexes. Violations can come from any module (plans, chats, notes), so the list of every open one is Synergy's, not one module's. It is a cross-module query like search, so it sits with search and backlinks in 3b: `GET /links?type=`, cursor-paged, with a `(user_id, type)` index. `type` is a filter, not a violations feature, so the same route lists any type (Pratik, 2026-11-01).
- **User-defined types stay deferred.** Both gaps were closed with a seeded row each, which is all a new type costs.

## Consequences

- Lesson 6 seeds both types and tests the retype (same id, fresh snapshot, cycle check) and the `type` filter. Lesson 7 tests that `violates` shows no dot and `exception-to` goes stale with its rule. Lesson 11 tests that `violates` never blocks the rule's delete and `exception-to` does.
- 3b adds `GET /links?type=` and its `(user_id, type)` index, next to search and backlinks.
- Arkive's datum markers already use both words (`apps/www/AGENTS.md` and `apps/www/src/lib/datums.mjs`), so the product and the docs that describe it share one vocabulary.

## Decision History

- 2026-11-01 · accepted · Violations and Exceptions
