---
title: Use navigation hook
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - nextjs
appliesTo: []
isSection: false
docId: system-design.non-functional.nextjs.use-navigation-hook
sourcePath: sources/docs/03-system-design/non-functional/nextjs/use-navigation-hook.md
wordCount: 21
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Always use `useNavigation()` instead of calling `router.push()` alone to ensure it is always followed by `router.refresh()` to prevent stale UI state.
