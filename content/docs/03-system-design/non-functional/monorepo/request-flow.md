---
id: system-design.non-functional.monorepo.request-flow
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - monorepo
   - api
   - offline
---

All request must flow from `UI -> Repository -> API -> DB`. No exceptions.

**Why:**
To support [[offline-ready]] requirement. When we’re ready to support offline features this flow will switch to `UI -> Local DB -> Sync Engine -> API -> Database`. In this manner, UI will remain agnostic of request flow.
