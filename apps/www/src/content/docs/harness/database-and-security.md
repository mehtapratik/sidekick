---
title: Database and security
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: guidance
status: draft
version: 1.0.0
tags:
  - ai-coding
  - database
  - security
  - agent-guidance
  - api-guard
  - rls
  - drizzle
  - api
  - react
  - repository-pattern
appliesTo: []
isSection: false
docId: harness.database-and-security
sourcePath: sources/docs/08-ai-coding-harness/database-and-security.md
wordCount: 34
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Use the repository client for database access, preserve RLS, and route mutations through the API layer. Drizzle never runs in client components.

- [[03-system-design/non-functional/database/repository-client|Repository client]]
- [[03-system-design/non-functional/security/row-level-security|Row-level security]]
- [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Mutation boundary]]
- [[03-system-design/non-functional/security/with-api-guard|API guard]]
