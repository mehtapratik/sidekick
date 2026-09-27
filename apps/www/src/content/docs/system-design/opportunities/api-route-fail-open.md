---
title: API route fail open
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - api
  - security
  - eslint
  - severity-low
appliesTo: []
isSection: false
docId: opportunity.api-route-fail-open
sourcePath: sources/docs/03-system-design/opportunities/api-route-fail-open.md
wordCount: 54
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The proxy deliberately does not authenticate API routes, but nothing prevents a new route from omitting `withApiGuard`.

**Risk**

A future route can be publicly reachable because its author follows the shortest path instead of the intended guard.

**Recommended fix**

Extend the existing custom ESLint plugin to require API route handlers to use `withApiGuard`.
