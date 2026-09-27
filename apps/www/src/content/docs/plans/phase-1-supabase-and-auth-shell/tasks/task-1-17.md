---
title: Task 1.17
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: built
version: 1.0.0
tags:
  - plan
  - phase-1
  - task
  - supabase
  - authentication
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-17
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-17.md
wordCount: 23
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sign-out is handled in the `AppShell` component via `supabase.auth.signOut()` followed by a push to `/login` and `router.refresh()` to clear the server-side cache.

---
