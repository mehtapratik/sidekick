---
publish: true
id: plan.phase-2.task-2-6and2-7
title: "Tasks 2.6 and 2.7: FeatureManifest and ALL_FEATURES"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - feature-system
   - typescript
   - monorepo
status: planned
---

> **Handoff:** wave 1, runs alongside [[task-2-1]] and [[task-2-8and2-9]]. Depends on nothing. [[task-2-10]] waits for it.

**Goal:** give `packages/features-registry` its real public surface: the `FeatureManifest` type and an empty `ALL_FEATURES` list ([[contracts#Feature manifest|contract]]).

**Read first:** [[contracts]], [[registry]], [[03-system-design/non-functional/monorepo/dependency-flow|dependency flow]].

## Build

1. Create `packages/features-registry/src/manifest.ts` with the `FeatureManifest` type.
2. Replace the placeholder in `packages/features-registry/src/index.ts` with `ALL_FEATURES: readonly FeatureManifest[] = []`, and re-export the type with `export type`.
3. Add `"exports": { ".": "./src/index.ts" }` to `packages/features-registry/package.json`, the same way `@sidekick/core` points at source.
4. Add Vitest the way `packages/core` has it: a `devDependency`, a `"test": "vitest run src --passWithNoTests"` script, and a `vitest.config.ts` if needed. Then add `src/index.test.ts`. It asserts that every slug is kebab-case and unique, and that `ALL_FEATURES` is frozen or `readonly` at the type level. Prove the test catches problems by temporarily adding two manifests with the same slug and watching it fail. Don't commit them.

## Done when

- `pnpm --filter @sidekick/features-registry test` passes, and `pnpm turbo lint typecheck build test --force` passes.
- Nothing imports the registry yet. That's expected.

## Out of scope

The `packages/features/*` glob in `pnpm-workspace.yaml` (it's added with the first feature package, in Phase 4), any feature manifests, and UI copy for feature names.

**Learning focus:** `readonly` arrays, `export type` with `verbatimModuleSyntax`, and how a package's `exports` map decides what others can import.
