---
title: Corepack
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - monorepo
  - pnpm
appliesTo: []
isSection: false
docId: system-design.non-functional.monorepo.corepack
sourcePath: sources/docs/03-system-design/non-functional/monorepo/corepack.md
wordCount: 40
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

To avoid package manager version drifts between developers, machines and environments, we chose Corepack over straight pnpm install (`npm install -g pnpm`). This means:

```shell
# DON’T
npm install -g pnpm

# DO
corepack enable && corepack use pnpm@latest
```
