---
title: Use corepack
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
  - pnpm
  - vercel
appliesTo: []
isSection: false
docId: decision.technical.use-corepack
sourcePath: sources/docs/06-decisions/technical/use-corepack.md
wordCount: 141
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Use Corepack to setup package manager instead of installing pnpm manually.

```shell
# DON’T
npm i -g pnpm@latest

# DO
corepack enable && corepack use pnpm@latest
```

Corepack is Node's built-in package manager manager. It reads the `packageManager` field in `package.json` and enforces the exact version (including a SHA512 hash) every time someone installs packages in the repo. This means:

- Every developer uses the exact same pnpm version
- CI uses the exact same pnpm version
- Vercel uses the exact same pnpm version
- Version drift is impossible

A globally installed pnpm via `npm install -g pnpm` has no enforcement — different machines silently use different versions.

**The SHA512 hash:** The `packageManager` field stores a cryptographic fingerprint of the pnpm binary. Corepack verifies this on download, preventing tampered binaries from being used even if the package registry is compromised.
