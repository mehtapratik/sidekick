---
publish: true
id: system-design.non-functional.api.idempotent-api
title: Idempotent API
created: 2026-09-19
updated: 2026-11-22
kind: spec
version: 1.1.0
tags:
   - system-design
   - api
   - idempotency
---

**Idempotent** operations that produces the same result no matter how many times you apply it (after the first time). Running it once or a hundred times leaves the system in the same state.

Sidekick’s API endpoints will be idempotent. This makes system safe to retry in case of suspected failures or parallel attempts.

**Where it stands (Synergy lesson 4):** saves are already safe to retry, because a save carries its baseline `content_seq` and a repeat of the same save gets 409 `stale_content` instead of a second write. Creates aren't yet: creating with an id that already exists answers 500 (a duplicate key). Idempotency keys arrive with links in Synergy lesson 6, and the sandbox create handlers are where they plug in.
