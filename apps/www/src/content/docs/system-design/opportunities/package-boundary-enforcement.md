---
title: Package boundary enforcement
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - monorepo
  - eslint
  - architecture
  - severity-medium
appliesTo: []
isSection: false
docId: opportunity.package-boundary-enforcement
sourcePath: sources/docs/03-system-design/opportunities/package-boundary-enforcement.md
wordCount: 61
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The current boundaries configuration groups all packages into one type, so it does not enforce the documented `apps → feature packages → core` direction.

**Risk**

The first feature packages can create reverse dependencies that turn shared core infrastructure into a feature-aware dependency.

**Recommended fix**

Model app, feature-package, and core-package as separate boundary elements before adding the first cross-package feature dependency.
