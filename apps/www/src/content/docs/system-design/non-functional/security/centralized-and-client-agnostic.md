---
title: Centralized and client agnostic
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - security
  - rls
  - api
  - authentication
  - cli
appliesTo: []
isSection: false
docId: system-design.non-functional.security.centralized-and-client-agnostic
sourcePath: >-
  sources/docs/03-system-design/non-functional/security/centralized-and-client-agnostic.md
wordCount: 86
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Auth, permissions, entitlement and scope checks must be centralized
- Auth to be done at API level to centrally authorize requests for every client, such as cli, direct API access, and Web UI.
- Every request goes through [[with-api-guard]], which takes care of auth, feature entitlement check, api scope validation, and RLS context setup before honoring the request.
- This in line with our philosophy of [[enforced-conventions]]. We make secure behavior easy to implement and difficult to bypass with help of linter rules and [[with-api-guard]].
