---
publish: true
id: system-design.non-functional.monorepo.vercel
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - monorepo
   - turborepo
   - pnpm
   - vercel
---

Vercel to be host provider of Sidekick.

## Setup

- Root directory: `apps/web`
- Install command: `pnpm install` (run from `apps/web`, which resolves to the workspace root)
- Build Command: Vercel auto-detects `turbo run build` due to [[turborepo]] detection

[[06-decisions/technical/vercel|reasoning]]
