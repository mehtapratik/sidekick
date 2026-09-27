---
title: Middleware
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - security
  - api
  - authentication
appliesTo: []
isSection: false
docId: system-design.non-functional.security.middleware
sourcePath: sources/docs/03-system-design/non-functional/security/middleware.md
wordCount: 30
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

`proxy.ts` is responsible for…

- session refresh,
- redirecting unauthenticated users, and
- excluding API routes from redirect behavior.

It must not contain authorization logic, which strictly belongs in [[with-api-guard]].
