---
publish: true
id: system-design.non-functional.monorepo.approve-builds
title: Approve Builds
created: 2026-09-19
updated: 2026-11-05
kind: spec
version: 1.1.0
tags:
   - system-design
   - monorepo
   - nextjs
   - pnpm
---

Sidekick to maintain the `allowBuilds` map in `pnpm-workspace.yaml` to prevent any package from running a rogue script during or after installation.

As of this writing, three packages genuinely need script execution post install: `esbuild`, `sharp` and `unrs-resolver`. All are legitimate, widely used packages. Approving them is safe.

```yaml
allowBuilds:
   esbuild: true
   sharp: true
   unrs-resolver: true
```

pnpm 11 and later no longer read the `pnpm.onlyBuiltDependencies` field in `package.json`, so it must not be used (removed in sidekick#14). The workspace file covers every package, `apps/web` included, so no per-app `pnpm approve-builds` run is needed.
