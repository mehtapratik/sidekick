---
title: Never mutate outside API layer
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - api
appliesTo: []
isSection: false
docId: system-design.non-functional.api.never-mutate-outside-api-layer
sourcePath: >-
  sources/docs/03-system-design/non-functional/api/never-mutate-outside-api-layer.md
wordCount: 30
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Never mutate data outside API layer

**Question:**
Should we also enforce `SELECT` queries as well? That way, entire `client <-> DB` channel is mediated by repository (and thus pubic API) layer.
