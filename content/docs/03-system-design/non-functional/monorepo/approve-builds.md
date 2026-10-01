---
publish: true
id: system-design.non-functional.monorepo.approve-builds
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - monorepo
   - nextjs
   - pnpm
---

Sidekick to maintain `onlyBuiltDependencies` attribute in root `package.json` to prevent any package to run a rogue script during/after installation.

As of this writing, we have two packages that genuinely need script execution post install: `urn-resolver` and `sharp`. Both are legitimate, widely-used packages. Approving them is safe.

Including `onlyBuildDependencies` in root `package.json` is not enough. Because has `apps/web` with its own install context (i.e. own `node_modules` folder) setup by Next.js. Root approval will not automatically propagate to `apps/web`. Therefore, run `pnpm approve-builds` inside `apps/web` to fix this.
