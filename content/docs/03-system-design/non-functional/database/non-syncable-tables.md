---
publish: true
id: system-design.non-functional.database.non-syncable-tables
title: Non-Syncable Tables
created: 2026-09-19
updated: 2026-11-14
kind: spec
version: 1.2.0
tags:
   - system-design
   - database
   - offline
---

- Create non-syncable tables for sensitive and volatile content such as user profile or real-time sport stats.
- Do not define `updatedAt` and `deletedAt` columns
- Hard delete rows: the hard-delete [[03-system-design/non-functional/database/delete-models|delete model]]. Name it in the table's schema file.
- An amount is always stored with its ISO 4217 currency code in a column beside it, never as a bare number ([[D245]]).
