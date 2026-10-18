---
publish: true
id: build.phase-2.lesson-1
title: "Phase 2 lesson 1 walkthrough: feature registry"
created: 2026-10-18
updated: 2026-10-18
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-2
   - feature-system
   - typescript
   - monorepo
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-6and2-7]]"
---

# Phase 2 Lesson 1 Walkthrough — Feature Registry

This guide reproduces lesson 1 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system|Phase 2]] step by step: tasks 2.6 and 2.7, which give `packages/features-registry` its public surface. It assumes Pre-2 is complete ([[pre-2-walkthrough]]) and that `packages/features-registry` still holds only the Phase 0 placeholder (`export const placeholder = true;`).

The result shipped as [sidekick#9](https://github.com/mehtapratik/sidekick/pull/9), with a lint rule added afterwards in [sidekick#10](https://github.com/mehtapratik/sidekick/pull/10). The decisions behind it are recorded in [[contracts]].

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Step 1 — Orient and Branch

> **What and why:** The registry is the catalog of every feature Sidekick offers. It sits between the apps and the feature packages, so it must exist before anything can refer to a feature by name. `main` accepts changes only through a pull request, so the work starts on a branch.

Dependencies flow one way ([[03-system-design/non-functional/monorepo/dependency-flow|dependency flow]]): `apps/* → packages/features-registry → packages/features/* → foundation (core, ui, copy)`. The registry may import feature and foundation packages. `packages/core` must never import the registry: the registry depends on every feature, every feature depends on `core`, so the import would create a cycle with no valid build order, and `core` would stop being feature-agnostic. `eslint-plugin-boundaries` disallows anything not explicitly allowed, and gives foundation packages no allow rule, so such an import fails `pnpm lint`.

1. Bring `main` up to date and create a branch:

```bash
git switch main
git pull origin main
git switch -c feature/P2L1-feature-registry-manifest
```

Every PR must pass the CI `checks` job, and merges are squash-only, so `main` gets one commit per PR. A direct push would skip both.

---

## Step 2 — Define `FeatureManifest` (task 2.6)

> **What and why:** A manifest describes a feature: what it is, the same for every user. Per-user state (whether someone is provisioned) lives in the database, and whether a feature is ready to show anyone at all (rollout gating) is a separate, post-MVP system ([[backlogged-unplanned#B5 — Feature rollout gating|B5]]).

Two other parts of the system need a feature's metadata:

- **The entitlements table** (lesson 3) stores one row per user and feature. Features live in code, not in a table, so the row can't hold a foreign key. It stores a plain string: the feature's `key`. That string must be unique, must never change once rows reference it (renaming it cuts every user off), and must be readable, since it appears in guard options, logs and seed scripts.
- **A settings page** needs a `name` and a `description` to show each feature.

The shape stays minimal until a real feature needs more (Phase 4, Taxila).

Object shapes in Sidekick are `interface`s; `type` is only for what an interface can't express (unions, tuples, function, mapped and conditional types). Step 8 enforces this with a lint rule.

1. Create `packages/features-registry/src/manifest.ts`:

```ts
/**
 * A feature’s metadata
 */
export interface FeatureManifest {
  /**
   * The unique identifier for the feature - lowercase, hyphenated.
   *
   * CAUTION: Once set, never change it, as it is used to map user's access to the feature.
   */
  readonly key: string;
  /**
   * The human-readable name of the feature.
   */
  readonly name: string;
  /**
   * The human-readable description of the feature.
   */
  readonly description: string;
}
```

`readonly` stops code from reassigning a manifest's fields. It exists only at compile time: TypeScript erases it, so nothing stops a determined cast at runtime. That is enough for a list nobody should edit.

---

## Step 3 — Export `ALL_FEATURES` (task 2.7)

> **What and why:** One list of every manifest, exported from the package root, so consumers import the type and the list from `@sidekick/features-registry` and nowhere deeper. It starts empty.

1. Replace the placeholder in `packages/features-registry/src/index.ts`:

```ts
import type { FeatureManifest } from './manifest';

export type { FeatureManifest } from './manifest';

/**
 * A list of all features' manifest in the system.
 */
export const ALL_FEATURES: readonly FeatureManifest[] = [];
```

Both lines are needed. `export type … from` passes the name through to consumers but doesn't bring it into this file's scope, so the annotation on `ALL_FEATURES` needs its own `import type`.

The `type` keyword on the re-export is required, not decoration. `tsconfig.base.json` sets `verbatimModuleSyntax`, which tells TypeScript to emit imports and exports exactly as written, dropping only those marked `type`. A plain `export { FeatureManifest } from './manifest'` fails to compile (TS1205): it would survive into `index.js` and ask `manifest.js` for an export that doesn't exist at runtime. It also matters for tools that compile one file at a time (Vitest, Next.js), which can't look into `manifest.ts` to learn that `FeatureManifest` is a type.

`readonly FeatureManifest[]` (rather than `Readonly<FeatureManifest[]>`) is the usual spelling. It removes `push`, `splice` and index assignment from the type.

2. Check it compiles:

```bash
pnpm --filter @sidekick/features-registry typecheck
```

---

## Step 4 — Make the Package Importable

> **What and why:** Without an `exports` map (or a `main` field), resolving `@sidekick/features-registry` falls back to an `index.js` at the package root, which doesn't exist, so every import fails with _Module not found_. With one, only the paths it lists are public.

1. Add an `exports` map to `packages/features-registry/package.json`, pointing at source the way `@sidekick/core` does. The full file, including the test setup from step 5, is shown there.

`exports` also blocks deep imports. `import … from '@sidekick/features-registry/src/manifest'` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` in Node, and TypeScript refuses it too, because `moduleResolution: "bundler"` reads `exports`. To make a subpath public you would add a public name as the key, for example `"./manifest": "./src/manifest.ts"`, the same pattern as core's `"./supabase/server"`.

Pointing `exports` at `.ts` source works because the workspace consumes packages as TypeScript (`moduleResolution: "bundler"`, Next.js), so no package needs building before another can import it. Nothing imports the registry yet; the lesson 7 seed script is the first consumer.

---

## Step 5 — Test the Registry

> **What and why:** No database table can check a feature key, so the rules on keys must be checked in code. The test runs on the empty list today, so the first real feature is checked the day it lands.

### Add Vitest

1. Add Vitest at the same range core uses, so the lockfile keeps one copy:

```bash
pnpm --filter @sidekick/features-registry add -D vitest@^5.0.5
```

The filter must match the package's `name` exactly (`features-registry`). A typo makes pnpm report _No projects matched the filters_ and change nothing. The range is the full `^5.0.5`, not `^5`: ranges record the oldest version actually tested, and Renovate's `rangeStrategy: bump` keeps them current ([[pin-versions]]). `@5` would pick the newest 5.x, which may differ from the copy core already uses.

2. The finished `packages/features-registry/package.json`:

```json
{
  "name": "@sidekick/features-registry",
  "private": true,
  "license": "MIT",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run src"
  },
  "devDependencies": {
    "vitest": "^5.0.5"
  }
}
```

The `test` script has no `--passWithNoTests`. The package has a test file, so a run that finds no tests must fail. No `vitest.config.ts` is needed: core has one only to stub `server-only`, which the registry doesn't import.

### Keep tests out of the build

`tsconfig.json` compiles everything in `src`, so once a test file lives there, `build` would compile it into `dist`. Vitest runs `.ts` files directly and never reads `dist`, so a compiled test is dead weight. Core solves this with two configs: `tsconfig.json` for `typecheck`, which should cover tests, and `tsconfig.build.json` for `build`, which excludes them.

3. Create `packages/features-registry/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

tsconfig patterns understand only `*`, `?` and `**/`. They don't expand braces, so a single `src/**/*.test.{ts,tsx}` pattern matches nothing and silently excludes nothing. List the two patterns separately.

4. Give `packages/core/tsconfig.build.json` the same `exclude`. It had the brace pattern, which was harmless only because core has no tests in `src` yet:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

5. Check which files the build compiles. The list should show only `index.ts` and `manifest.ts`:

```bash
cd packages/features-registry
npx tsc -p tsconfig.build.json --listFilesOnly | grep -v node_modules
cd ../..
```

### Write the test

The test checks three rules: keys are lowercase, alphanumeric and hyphenated (`war-room`, `v2-notes`; not `War-Room`, `war_room`, `-war`, `war-` or `war--room`), keys are unique, and every manifest has a name and description.

Each rule is one `it` that loops over the whole list. `it.each(ALL_FEATURES)` would generate one test per manifest, so an empty list generates **zero** tests, and the rules would never run. Uniqueness is a property of the whole list, so its `Set` lives inside the one test, not shared between generated tests that would have to run in order. Each `expect` carries a message naming the key at fault, so a CI failure says which feature to fix.

6. Create `packages/features-registry/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ALL_FEATURES } from './index';

describe('Feature manifest list', () => {
  it('keys must be alphanumeric, lowercase, and hyphenated', () => {
    for (const feature of ALL_FEATURES) {
      expect(
        feature.key,
        `Invalid key for feature: ${feature.name}. Keys must be alphanumeric, lowercase and hyphenated.`,
      ).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('keys must be unique', () => {
    const seenKeys = new Set<string>();
    for (const feature of ALL_FEATURES) {
      expect(seenKeys.has(feature.key), `Duplicate key found for feature: ${feature.key}`).toBe(
        false,
      );
      seenKeys.add(feature.key);
    }
  });

  it('name and description must be non-empty', () => {
    for (const feature of ALL_FEATURES) {
      expect(feature.name, `Name is required for feature: ${feature.key}`).toBeTruthy();
      expect(
        feature.description,
        `Description is required for feature: ${feature.key}`,
      ).toBeTruthy();
    }
  });
});
```

7. Run it. The output must say `Tests  3 passed (3)`, not `no tests`:

```bash
pnpm --filter @sidekick/features-registry test
```

8. Prove the test guards something. Temporarily add two manifests with the same `key` to `ALL_FEATURES` and run the test: it fails and names the duplicate key. Try again with a key like `War_Room`: the format test fails. Remove the fake manifests, so `ALL_FEATURES` is `[]` again and the tests pass.

---

## Step 6 — Verify Like CI

> **What and why:** CI starts with no Turbo cache. Locally, Turbo can replay a cached result after a config change it doesn't treat as an input; a cached `build` once hid a broken TypeScript 6 upgrade. `--force` makes your machine run everything the way CI does.

1. Clear old build output first. `tsc` never deletes files, so stale output in `dist` would hide what the current config produces:

```bash
rm -rf packages/features-registry/dist
pnpm prettier:check
pnpm turbo lint typecheck build test --force
ls packages/features-registry/dist
```

Every task should succeed with `0 cached`. `dist` should hold `index.js` and `manifest.js`, and no `index.test.js`. `manifest.js` is expected and tiny (`export {};`): `tsc` emits one file per source file, and the interface inside it is erased. If Prettier complains, run `pnpm format`.

---

## Step 7 — Ship It

> **What and why:** The PR is the only way into `main`. With squash merges, the PR title becomes the single commit on `main`, so it follows Conventional Commits like every commit in `git log`.

1. Review, stage by path, commit, push:

```bash
git status
git diff
git add packages/features-registry packages/core/tsconfig.build.json pnpm-lock.yaml
git commit -m "feat(features-registry): add FeatureManifest and ALL_FEATURES" -m "Also fixes the tsconfig.build.json test exclude in core and the registry: tsconfig globs don't expand {ts,tsx}."
git push -u origin feature/P2L1-feature-registry-manifest
```

New files appear in `git diff` only once staged. Naming paths, rather than `git add .`, keeps anything you didn't review out of the commit. Husky runs `lint-staged`, which formats the staged files with Prettier before the commit is written. `-u` links the local branch to the remote one, so later pushes are just `git push`.

2. Open the PR with a Conventional Commits title, `type(scope): summary` with a lowercase summary, for example `feat(features-registry): add FeatureManifest and ALL_FEATURES`:

```bash
gh pr create --fill
```

Without `gh`, use the compare page: `https://github.com/mehtapratik/sidekick/compare/main...feature/P2L1-feature-registry-manifest?expand=1`.

3. Wait for the `checks` job to pass, then squash-merge.

---

## Step 8 — Enforce `interface` for Object Shapes

> **What and why:** A follow-up PR (#10) makes the `interface` convention from step 2 a lint rule, so it doesn't depend on reviewers remembering it. `interface` reports clearer errors when extended and type-checks faster than `&` intersections; `type` stays for what an interface can't express.

1. On a new branch from `main`, add this block to `eslint.config.js`, after the `consistent-type-imports` block:

```js
  {
    // Object shapes are interfaces: `extends` reports clearer errors and
    // type-checks faster than `&` intersections. The rule flags only
    // `type X = { … }`, so unions, tuples, function, mapped and conditional
    // types stay `type`, which is where an interface can't express them.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
```

2. Run lint without the cache. Nothing in the repo violates the rule: the only type definition, `RlsTx` in `packages/core/src/db/rls.ts`, is derived with `Parameters<…>`, which an interface can't express.

```bash
pnpm turbo lint --force
```

3. Prove the rule fires. Plant a violation and a union, lint from the package, then delete the probe:

```bash
printf "export type Probe = { a: string };\nexport type Ok = { a: string } | null;\n" > packages/features-registry/src/probe.ts
pnpm --filter @sidekick/features-registry lint
rm packages/features-registry/src/probe.ts
```

Lint reports one error, on `Probe`, and none on the union.

4. Commit, push and open the PR as in step 7, titled `chore(eslint): prefer interface for object type definitions`.

---

## What you have now

- `@sidekick/features-registry` exports `FeatureManifest` and an empty, readonly `ALL_FEATURES`, and nothing deeper.
- A test that checks key format, key uniqueness and required fields, and that runs even on an empty list.
- Builds that keep test files out of `dist`, in the registry and in core.
- A lint rule that keeps object shapes as interfaces.

Next: [[task-2-1|lesson 2]], `resolveApiCaller`.
