---
title: Module resolution bundler
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - nextjs
  - typescript
appliesTo:
  - >-
    03-system-design/non-functional/code-quality-checks/typescript/module-resolution--bundler
isSection: false
docId: decision.technical.module-resolution-bundler
sourcePath: sources/docs/06-decisions/technical/module-resolution--bundler.md
wordCount: 114
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**What we chose:** `"moduleResolution": "bundler"` in `tsconfig.base.json`.

**Why:** There are several moduleResolution strategies in TypeScript:

- `"node"` — the classic Node.js resolution (requires file extensions, doesn't support `exports` field in package.json). Old and increasingly incompatible with modern packages.
- `"node16"` / `"nodenext"` — strict ES module resolution. Requires `.js` extensions on all imports, even for TypeScript files. Very pedantic, lots of friction.
- `"bundler"` — designed for code that runs through a bundler (Next.js, Vite, etc.). No extension requirements, supports `exports` field, matches how bundlers actually resolve modules.

Since all our code runs through Next.js (SWC) or another bundler, `"bundler"` is the right choice. It has the least friction and the most accurate behavior.
