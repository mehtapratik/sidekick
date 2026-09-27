---
title: Centralized copy
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - content
appliesTo: []
isSection: false
docId: system-design.non-functional.content.centralized-copy
sourcePath: sources/docs/03-system-design/non-functional/content/centralized-copy.md
wordCount: 21
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

[[06-decisions/technical/centralized-copy|Why?]]
To ensure consistency across the application, all user-visible strings must live in `packages/copy`. Never hardcode strings directly in source files.
