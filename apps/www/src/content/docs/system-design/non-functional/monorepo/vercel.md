---
title: Vercel
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - monorepo
  - turborepo
  - pnpm
  - vercel
appliesTo: []
isSection: false
docId: system-design.non-functional.monorepo.vercel
sourcePath: sources/docs/03-system-design/non-functional/monorepo/vercel.md
wordCount: 40
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Vercel to be host provider of Sidekick.

## Setup

- Root directory: `apps/web`
- Install command: `pnpm install` (run from `apps/web`, which resolves to the workspace root)
- Build Command: Vercel auto-detects `turbo run build` due to [[turborepo]] detection

[[06-decisions/technical/vercel|reasoning]]
