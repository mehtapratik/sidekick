---
publish: true
id: plan.phase-2.task-2-6and2-7
title: "Lesson 1 (tasks 2.6, 2.7): FeatureManifest and ALL_FEATURES"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.0.0
tags:
   - plan
   - phase-2
   - task
   - feature-system
   - typescript
   - monorepo
status: planned
---

> **Lesson 1 of 8.** Before this: nothing. Next: [[task-2-1|lesson 2]]. The coach follows [[contracts#Coaching rules|the coaching rules]]. The answer key is [[contracts#Feature manifest|Feature manifest]].

**What Pratik builds:** the public surface of `packages/features-registry`, meaning a `FeatureManifest` type and an empty `ALL_FEATURES` list, plus a test that guards it.

**Why it's first:** it's small, it touches no database or auth, and it teaches the TypeScript, package and Git moves that every later lesson reuses.

**Concepts:** TypeScript type aliases and object types, `readonly` arrays, `export type` and `verbatimModuleSyntax`, a package's `exports` map, Vitest basics, and the branch → commit → PR flow.

**Coach reads first:** [[contracts]], [[registry]], [[03-system-design/non-functional/monorepo/dependency-flow|dependency flow]], `packages/features-registry/` and `packages/core/package.json` in the Sidekick repo.

## Steps

1. **Orient.** Pratik opens `packages/features-registry/src/index.ts` and `package.json` and explains what's there today, which is a placeholder. The coach explains what the registry is for, and why `packages/core` must never import it.
2. **Branch.** Pratik creates a branch from an up-to-date `main`. The coach explains why `main` is PR-only.
3. **Design the manifest.** Ask: "What does Sidekick need to know about a feature to switch it on for a user?" Pratik proposes fields, then writes `FeatureManifest` in `src/manifest.ts`. Compare with the answer key, which keeps the shape minimal for now.
4. **The list.** Pratik exports `ALL_FEATURES` from `src/index.ts` and re-exports the type. Teach `readonly FeatureManifest[]`, and why `export type` is required here.
5. **Make it importable.** Pratik adds an `exports` map to `package.json`, pointing at source the way `@sidekick/core` does. Ask them to predict what happens without it.
6. **Test it.** Pratik adds Vitest the way `packages/core` has it, then writes `src/index.test.ts`, which checks that slugs are kebab-case and unique. Pratik then adds two manifests with the same slug, watches the test fail, and removes them.
7. **Verify like CI.** Pratik runs `pnpm prettier:check` and `pnpm turbo lint typecheck build test --force`. Explain why `--force` matters, using the TypeScript 6 story from `AGENTS.md`.
8. **Ship.** Pratik commits, pushes and opens the PR. The coach walks through each Git step and reviews the diff first.

## Check understanding

- Why can `packages/features-registry` import `packages/core`, but not the other way round?
- What breaks at compile time if you write `export { FeatureManifest }` instead of `export type`?
- Why test an empty list?

**Done when:** Pratik's PR is green, and they can answer the questions above in their own words.

**Out of scope:** the `packages/features/*` workspace glob (Phase 4), real feature manifests, and UI copy.
