---
title: Environment contract drift
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - configuration
  - security
  - developer-experience
  - severity-medium
appliesTo: []
isSection: false
docId: opportunity.environment-contract-drift
sourcePath: sources/docs/03-system-design/opportunities/environment-contract-drift.md
wordCount: 65
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

`.env.example` does not match the Supabase keys or direct database URL consumed by code.

**Risk**

A new developer or environment follows the documented bootstrap path and gets a broken app or migration workflow; the runtime/direct role distinction is forgotten.

**Recommended fix**

Match every variable name used by code and document that `DATABASE_URL` uses the restricted runtime role while `DATABASE_DIRECT_URL` uses the migration owner role.
