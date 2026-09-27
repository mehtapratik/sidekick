---
title: Force dynamic
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - nextjs
  - supabase
appliesTo: []
isSection: false
docId: system-design.non-functional.nextjs.force-dynamic
sourcePath: sources/docs/03-system-design/non-functional/nextjs/force-dynamic.md
wordCount: 24
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase cookies to prevent static pre-rendering failures.

[[06-decisions/technical/force-dynamic|more information]]
