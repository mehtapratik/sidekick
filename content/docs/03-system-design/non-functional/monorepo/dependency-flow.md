---
publish: true
id: system-design.non-functional.monorepo.dependency-flow
title: Dependency Flow
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.4.0
tags:
   - system-design
   - monorepo
   - cli
---

Dependencies flow one way, from apps down to the foundation. A package never imports an app, and a lower layer never imports a higher one. A layer may skip the layers between: an app may import a feature, a platform or a foundation package directly, and a feature may import a foundation package directly.

![[dependency-flow.svg|700]]

An arrow means "may import". Packages in the same layer never import each other.

## Which layer a package belongs to

Foundation says _how_, platform says _what_, features say _which_.

| Layer      | Holds                                                                                                                                             | Packages                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Foundation | Domain-free machinery: DB client and RLS, auth, the API guard, logging, design-system primitives, copy. Knows nothing about entities or features. | `packages/foundation/*`: `core`, `ui`, `copy` |
| Platform   | A shared domain concept, with its data and rules, that more than one feature uses. Owns its own tables and migrations.                            | `packages/platform/*` (first: `synergy`)      |
| Feature    | One product area.                                                                                                                                 | `packages/features/*` (from Phase 4)          |

To place a new package, ask in order:

1. Does it know about a specific feature? Then it is that feature, or the registry.
2. Does it own shared domain data or rules? Then it is a platform package.
3. Otherwise it is pure mechanism: a foundation package.

Every layer has its own folder, so the path tells you the layer: `packages/foundation/*`, `packages/platform/*`, `packages/features/*`. `core`, `ui` and `copy` move into `packages/foundation/` in Phase 3a (Pratik, 2026-10-31); their package names (`@sidekick/core` and so on) don't change, so no import changes. The registry, tooling (`packages/eslint-plugin-sidekick`) and ops (`packages/ops`) are singletons and stay at the root of `packages/`.

A design system (tokens, theme, primitives such as buttons and inputs) is domain-free, so it is foundation and lives in `packages/foundation/ui`. A component that knows a platform concept, such as the Sneak Peek Link (resolved links, states, dots), lives in that platform package and builds on `ui`.

## Who may import whom

- **Apps** (`apps/web`, later `apps/cli`) may import the registry, feature, platform and foundation packages.
- **`packages/features-registry`** is the catalog of every feature. It may import feature, platform and foundation packages.
- **Feature packages** may import platform and foundation packages. They never import each other or the registry.
- **Platform packages** may import only foundation packages. They never import each other, a feature or the registry; loosen that deliberately, with a new rule, when a real need appears. They take feature keys and entity types as data.
- **`packages/ops`** may import the registry, platform and foundation packages.
- **Foundation packages** stay feature-agnostic ([[03-system-design/functional-design/00-feature-system/core|core]]) and never import the registry, a feature, a platform package or each other. If `core` imported the registry, it would depend on every feature, and every feature already depends on `core`: a cycle with no valid build order.

`eslint-plugin-boundaries` enforces this in `pnpm lint` (`eslint.config.js` in the Sidekick repo). Its default is to disallow, and it lists only the allowed directions above. Each layer and singleton has an explicit element pattern (`packages/foundation/*`, `packages/platform/*`, `packages/features/*`, and one per singleton), with no `packages/*` catch-all, and a package that matches no pattern fails lint. Without that, a package created in the wrong place would silently count as foundation. `pnpm-workspace.yaml` globs each layer folder. All of this lands in Phase 3a with the first platform package. See [[06-decisions/technical/platform-layer|Platform layer]] and [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]].

The questions this note used to leave open are settled: features live in `packages/features/*`, platform packages in `packages/platform/*`, the registry in `packages/features-registry`, and the boundaries rule enforces the layers instead of folder depth.
