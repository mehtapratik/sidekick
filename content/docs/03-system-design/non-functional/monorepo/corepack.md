---
publish: true
id: system-design.non-functional.monorepo.corepack
title: Corepack
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - monorepo
   - pnpm
---

**D52** `decision` #tooling: Corepack pins the package manager version, and nobody installs pnpm globally.

To avoid package manager version drifts between developers, machines and environments, we chose Corepack over straight pnpm install (`npm install -g pnpm`). This means:

```shell
# DON’T
npm install -g pnpm

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

## Decision History

- 2026-09-19 · accepted · Use Corepack
