---
title: TypeScript
deck: ''
created: '2026-09-23'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags: []
appliesTo: []
isSection: false
docId: 08-ai-coding-harness-standards-and-guidance-typescript
sourcePath: sources/docs/08-ai-coding-harness/standards-and-guidance/typescript.md
wordCount: 48
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

A time range, as start plus duration:

// Don't: a comment holds the invariant
type TimeRange = { start: Date; end: Date }; // start <= end

// Do: a negative range can't be written; derive end when needed
type TimeRange = { start: Date; durationMs: number };
