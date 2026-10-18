---
publish: true
id: system-design.non-functional.monorepo.dependency-flow
created: 2026-09-19
updated: 2026-10-18
kind: spec
version: 1.1.0
tags:
   - system-design
   - monorepo
   - cli
---

Dependencies flow one way, from apps down to the foundation. A package never imports an app, and a lower layer never imports a higher one.

```markdown
apps/* -> packages/features-registry -> packages/features/* -> foundation (packages/core, packages/ui, packages/copy)
```

- **Apps** (`apps/web`, later `apps/cli`) may import the registry, feature packages and foundation packages.
- **`packages/features-registry`** is the catalog of every feature. It may import feature packages and foundation packages.
- **Feature packages** (`packages/features/*`, from Phase 4) may import only foundation packages. They never import each other or the registry.
- **Foundation packages** stay feature-agnostic ([[03-system-design/functional-design/00-feature-system/core|core]]) and never import the registry or a feature. If `core` imported the registry, it would depend on every feature, and every feature already depends on `core`: a cycle with no valid build order.

`eslint-plugin-boundaries` enforces this in `pnpm lint` (`eslint.config.js` in the Sidekick repo). Its default is to disallow, and it lists only the allowed directions above.

The questions this note used to leave open are settled: features live in `packages/features/*`, the registry lives in `packages/features-registry`, and the boundaries rule enforces the layers instead of folder depth.
