---
title: Server actions
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - nextjs
  - rls
  - api
  - authentication
appliesTo: []
isSection: false
docId: system-design.non-functional.nextjs.server-actions
sourcePath: sources/docs/03-system-design/non-functional/nextjs/server-actions.md
wordCount: 35
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Server actions are permitted as long as they honor [[request-flow]] standard. In other words, server actions must not bypass (or implement its own) auth, entitlements, RLS or scope checks. This is to ensure [[api-first]] architecture.
