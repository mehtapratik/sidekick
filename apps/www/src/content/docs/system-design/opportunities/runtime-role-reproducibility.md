---
title: Runtime role reproducibility
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - database
  - security
  - severity-critical
appliesTo: []
isSection: false
docId: opportunity.runtime-role-reproducibility
sourcePath: sources/docs/03-system-design/opportunities/runtime-role-reproducibility.md
wordCount: 56
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The `app_runtime` role is granted privileges in migrations but its existence is assumed to have been created manually.

**Risk**

Fresh databases, staging environments, and recovery workflows cannot reproduce the intended security boundary.

**Recommended fix**

Create `app_runtime NOLOGIN` idempotently in a migration. Keep only the login password out of Git and configure it out of band.
