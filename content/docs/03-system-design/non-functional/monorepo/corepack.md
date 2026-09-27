---
id: system-design.non-functional.monorepo.corepack
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - monorepo
   - pnpm
---

To avoid package manager version drifts between developers, machines and environments, we chose Corepack over straight pnpm install (`npm install -g pnpm`). This means:

```shell
# DON’T
npm install -g pnpm

# DO
corepack enable && corepack use pnpm@latest
```
