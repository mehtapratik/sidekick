---
title: Signup confirmation flow
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - authentication
  - ux
  - severity-low
appliesTo: []
isSection: false
docId: opportunity.signup-confirmation-flow
sourcePath: sources/docs/03-system-design/opportunities/signup-confirmation-flow.md
wordCount: 48
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

Signup immediately navigates to the dashboard even when email confirmation can leave the user without a session.

**Risk**

The user is bounced back to login without a clear explanation of the required confirmation step.

**Recommended fix**

Handle the no-session signup result explicitly and show a confirmation-pending state.
