---
title: Installation at workspace level
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - code-quality-checks
  - typescript
  - pnpm
appliesTo: []
isSection: false
docId: >-
  system-design.non-functional.code-quality-checks.typescript.installation-at-workspace-level
sourcePath: >-
  sources/docs/03-system-design/non-functional/code-quality-checks/typescript/installation-at-workspace-level.md
wordCount: 24
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

To ensure every package in monorepo use same Typescript version, install typescript as a `devDependency` at workspace root (`pnpm add -D -w typescript`).

[[typescript-hoisting]]
