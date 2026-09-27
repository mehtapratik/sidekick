---
title: Non syncable tables
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
appliesTo: []
isSection: false
docId: system-design.non-functional.database.non-syncable-tables
sourcePath: sources/docs/03-system-design/non-functional/database/non-syncable-tables.md
wordCount: 29
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Create non-syncable tables for sensitive and volatile content such as user profile or real-time sport stats.
- Do not define `updatedAt` and `deletedAt` columns
- Hard delete rows
