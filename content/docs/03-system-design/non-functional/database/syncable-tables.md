---
publish: true
id: system-design.non-functional.database.syncable-tables
title: Syncable Tables
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 1.1.0
tags:
   - system-design
   - database
   - offline
   - soft-delete
---

- Create syncable tables for the content that needs to support [[offline-ready|offline features]].
- Must have `createdAt`, `updatedAt` and `deletedAt` columns to support conflict resolution between client and server versions.
- No hard-delete — [[soft-delete-support|only soft-delete operations]].
- Support reversal of soft-delete operations
- An amount is always stored with its ISO 4217 currency code in a column beside it, never as a bare number ([[D245]]).
