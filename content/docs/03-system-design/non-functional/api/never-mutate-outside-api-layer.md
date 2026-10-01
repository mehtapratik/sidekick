---
publish: true
id: system-design.non-functional.api.never-mutate-outside-api-layer
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - api
---

Never mutate data outside API layer

**Question:**
Should we also enforce `SELECT` queries as well? That way, entire `client <-> DB` channel is mediated by repository (and thus pubic API) layer.
