---
title: Isolation
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - feature-system
appliesTo: []
isSection: false
docId: system-design.functional-design.feature-system.isolation
sourcePath: sources/docs/03-system-design/functional-design/00-feature-system/isolation.md
wordCount: 24
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Isolation of each feature is achieved at package level.
2. [[migration]] strategy even ensures that each package owns its own database migration scripts
