---
title: Syncable tables
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - database
  - offline
  - soft-delete
appliesTo: []
isSection: false
docId: system-design.non-functional.database.syncable-tables
sourcePath: sources/docs/03-system-design/non-functional/database/syncable-tables.md
wordCount: 43
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Create syncable tables for the content that needs to support [[offline-ready|offline features]].
- Must have `createdAt`, `updatedAt` and `deletedAt` columns to support conflict resolution between client and server versions.
- No hard-delete — [[soft-delete-support|only soft-delete operations]].
- Support reversal of soft-delete operations
