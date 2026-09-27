---
id: system-design.non-functional.content.centralized-copy
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - content
---

[[06-decisions/technical/centralized-copy|Why?]]
To ensure consistency across the application, all user-visible strings must live in `packages/copy`. Never hardcode strings directly in source files.
