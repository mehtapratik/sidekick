---
publish: true
id: system-design.non-functional.api.idempotent-api
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - api
   - idempotency
---

**Idempotent** operations that produces the same result no matter how many times you apply it (after the first time). Running it once or a hundred times leaves the system in the same state.

Sidekick’s API endpoints will be idempotent. This makes system safe to retry in case of suspected failures or parallel attempts.
