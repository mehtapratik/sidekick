---
publish: true
id: plan.phase-3.lesson-12-tags
title: "Synergy Lesson 12: Tags"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - api
status: planned
---

> **Lesson 12 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-11-delete-and-restore/00-brief|lesson 11]]. Next: [[04-phases/03-synergy/00-lessons/lesson-13-race-tests/00-brief|lesson 13]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** tags on entities and on links. Tags can be plain (`deep-work`) or `key:value` (`status:draft`), can be aliases of another tag, can be renamed, merged and deprecated, and are applied and removed through the API.

**Implements:** the [[02-prd/03-features/01-synergy/03.prd.features.synergy.tags|tags PRD]] and [[02-prd/03-features/01-synergy/spec|spec]], the overview's Tables (`tags`, `tag_applications`) and API (`/tags`) ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]).

**Learning payoff:** a format rule as a CHECK constraint, so every writer obeys it; aliases as a self-reference; a merge that moves applications in one statement; a partial unique index that lets a tombstoned tag be created again; one applications table that points at either an entity or a link.

**Coach reads first:** the tags PRD and the spec, lesson 3's partial unique indexes, lesson 6's relationships table.

## Steps

**Good to write yourself:** the tag-name CHECK constraint (step 1).

1. **Tables.** `tags` (name as written by the user, optional description, `alias_of`, status, format CHECK) and `tag_applications` (tag, and an entity id or a relationship id, exactly one: CHECK). Partial unique indexes on live rows.
2. **Routes.** `GET /tags` (cursor), `POST /tags` (idempotency key; `invalid_tag`), `PATCH /tags/:id` (rename, description, deprecate, merge into), `PUT` and `DELETE /tags/:id/applications` (`deprecated_vocabulary` for a deprecated tag). Applying an alias applies its target. Each write emits its outbox events.
3. **Prove it.** Integration tests: tag and untag a note and a link; re-tag after a tombstone; a `key:value` tag works and a malformed one is refused with `invalid_tag`; an alias resolves to its target; a merge moves every application; a deprecated tag can't be applied; another user's tags never show.

**Exit check:** step 3 green in CI. Proves the exit criterion "`key:value` tags work".

**Unit-test candidates:** tag-name parsing, if it lives in TypeScript as well as in the CHECK.

**Out of scope:** search by tag (3b), AI tag suggestions (Phase 6).
