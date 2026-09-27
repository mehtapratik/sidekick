---
title: Centralized
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - observability
  - api
  - authentication
appliesTo: []
isSection: false
docId: system-design.non-functional.observability.centralized
sourcePath: sources/docs/03-system-design/non-functional/observability/centralized.md
wordCount: 42
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

The primary logging surface is inside [[with-api-guard]]:

- Request start: method, path, userId
- Request end: status, latency
- Auth failures: 401/403 events with reason
- Feature entitlement denials

This centralizes visibility without requiring each route handler to implement its own logging.
