---
id: system-design.non-functional.database.non-syncable-tables
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - database
   - offline
---

- Create non-syncable tables for sensitive and volatile content such as user profile or real-time sport stats.
- Do not define `updatedAt` and `deletedAt` columns
- Hard delete rows
