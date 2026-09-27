---
id: system-design.functional-design.feature-system.isolation
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - feature-system
---

1. Isolation of each feature is achieved at package level.
2. [[migration]] strategy even ensures that each package owns its own database migration scripts
