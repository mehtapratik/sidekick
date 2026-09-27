---
title: Security proof and ci
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - testing
  - ci
  - security
  - severity-high
appliesTo: []
isSection: false
docId: opportunity.security-proof-and-ci
sourcePath: sources/docs/03-system-design/opportunities/security-proof-and-ci.md
wordCount: 72
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

There is no test runner or code CI for the authorization chokepoint. Schema inspection cannot prove the role used by the running application.

**Risk**

RLS and authorization regressions can be marked complete without ever executing their critical behavior.

**Recommended fix**

Add one integration test that uses the runtime connection: two users see only their own rows and a context-free query sees zero. Run it with lint, typecheck, and build in CI.
