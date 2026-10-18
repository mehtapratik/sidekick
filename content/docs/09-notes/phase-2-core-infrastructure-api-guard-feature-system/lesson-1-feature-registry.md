---
publish: false
id: notes.phase-2.lesson-1
title: "Phase 2 lesson 1 notes: feature registry"
created: 2026-10-18
updated: 2026-10-18
kind: notes
version: 1.0.0
tags:
   - phase-2
   - feature-system
   - typescript
   - monorepo
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-6and2-7]]"
---

These notes record what lesson 1 taught: the mental models, the surprises and the mistakes worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-1-feature-registry|the walkthrough]]. The decisions are recorded in [[contracts]].

The thread running through the lesson: **a check that never ran looks exactly like a check that passed.** Both of the lesson's real bugs were silent no-ops, a test that generated zero tests and an `exclude` that excluded nothing, and each was caught only by reading the output closely.

---

## What a feature is (tasks 2.6, 2.7)

### Three separate questions

"Can this user use this feature?" is really three questions, each answered in a different place:

| Question                        | Answered by                                      | When                  |
| ------------------------------- | ------------------------------------------------ | --------------------- |
| Who is calling?                 | `resolveApiCaller`, then RLS on every query      | Phase 2, lesson 2     |
| Is the feature ready to show?   | rollout gating ([[backlogged-unplanned#B5 — Feature rollout gating\|B5]]) | post-MVP |
| Is this user provisioned for it? | a row in `user_feature_entitlements`            | Phase 2, lesson 3     |

The manifest answers none of them. It only **describes** the feature, the same for every user, and changes only with a deploy. Per-user state lives in the database. Rollout gating changes without a deploy, which is why it stays out of the manifest. When it exists, it runs before the entitlement check: there's no point asking whether someone is provisioned for a feature nobody can see yet.

The usual split is three parts: a **catalog** (the registry), **entitlements** (who is provisioned) and **rollout flags** (readiness, betas, percentages). Commercial flag services exist; a basic one can be hand-rolled when needed.

### The key

An entitlement row needs to point at a feature, but features live in code, not in a table, so there's nothing for a foreign key to reference. The row stores a plain string, which must be:

- **unique**, or two features share entitlements;
- **permanent**, because renaming it silently cuts off every user with a row;
- **readable** (lowercase, hyphenated), because it appears in guard options, logs and seed scripts. A generated UUID would be unreadable, and nothing would generate it.

It's named `key` rather than the plan's `slug`, because that reads more naturally and stays neutral if a features table arrives. A stable string keeps that door open: a future `features` table can use the same key as its primary key, and `feature_key` gains the foreign key with no data migration. A UUID would have needed a mapping.

A row can switch on configuration, but it can't add code. Third-party integrations configured per client only become table rows once a generic integration engine exists to run them.

### Why `core` never imports the registry

The registry depends on every feature package, and every feature depends on `core`. If `core` imported the registry, it would depend on every feature, a cycle with no valid build order. Even without the cycle, `core` must stay feature-agnostic. The registry doesn't need `core` for entitlements either: the guard in `core` checks entitlements using only key strings and never sees a manifest. `eslint-plugin-boundaries` enforces the direction: its default is to disallow, and it gives foundation packages no allow rule.

---

## TypeScript

### `interface` or `type`

For a plain object shape they're interchangeable. The trade-offs:

- An `interface` can be reopened (declaration merging), which helps when extending a library's types and is a risk when it happens by accident. `extends` reports clearer errors and type-checks faster than `&` intersections.
- A `type` can express what an interface can't: unions, tuples, function, mapped and conditional types. `ApiCaller` in lesson 2 is a union, so it must be a `type`.

The common advice is to pick one and enforce it. Sidekick chose `interface` for object shapes and `type` only where an interface can't work, enforced by `@typescript-eslint/consistent-type-definitions: ['error', 'interface']` (sidekick#10). That rule flags only `type X = { … }`, so it already matches "prefer, with exceptions". Nothing in the repo needed converting: the only type definition, `RlsTx`, is derived with `Parameters<…>`.

### `readonly` is compile-time only

`readonly` on fields and `readonly FeatureManifest[]` stop mistakes in code, but TypeScript erases them: a cast still mutates at runtime. The runtime tool is `Object.freeze`, and it's easy to get backwards. Freezing the array stops `push`, `splice` and index assignment, but it's **shallow**: the objects inside stay mutable. Protecting both means freezing every element and the array (a deep freeze). Not needed here.

`readonly T[]` is the usual spelling; `Readonly<T[]>` means the same.

### `export type` and `verbatimModuleSyntax`

`verbatimModuleSyntax` tells TypeScript to emit imports and exports exactly as written, dropping only those marked `type`. So plain `export { FeatureManifest } from './manifest'` is a compile error (TS1205). Otherwise it would survive into `index.js` and ask `manifest.js` at runtime for an export that doesn't exist. It also matters for tools that compile one file at a time (Vitest, Next.js): they can't look into another file to learn a name is a type, so the keyword is their only signal. `import type` on a function used only as a type means its module never loads.

`export type … from` passes a name through but doesn't bring it into the file's scope, so using the type locally needs a separate `import type`.

---

## Packages and versions

### The `exports` map

Without `exports` or `main`, resolving a package falls back to `index.js` at its root, so an import fails with _Module not found_. That's Node's resolution rules, not a project setting. (The lint rule that's easy to confuse with it is `import-x/no-extraneous-dependencies`, a separate check that a package lists what it imports.) With `exports`, only listed paths are public: a deep import fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and TypeScript refuses it too under `moduleResolution: "bundler"`. A subpath's key is its **public name**, not the file path: `"./manifest": "./src/manifest.ts"`.

### `^5` vs `^5.0.5`

Both allow everything below 6.0.0; they differ only in the floor. The lockfile, not the range, decides what runs. The full form is better for a private app: it says which version was tested, guards against a downgrade if the lockfile is regenerated, and matches what pnpm writes and Renovate's `rangeStrategy: bump` maintains. `^5` suits a published library, where a low floor helps apps that use it share one copy. Now written down in [[pin-versions]].

What you type in `pnpm add` is only a selector: `vitest@5` picks the newest 5.x, which may differ from the copy another package already uses and leave two in the lockfile. `vitest@^5.0.5` reuses it.

**Surprise:** `pnpm --filter <name>` must match the package `name` exactly. A typo doesn't fail loudly; pnpm reports _No projects matched the filters_ and changes nothing.

---

## Testing

### Mistake: `it.each([])` runs zero tests

Each rule was first written with `it.each(ALL_FEATURES)` and looked green. It wasn't: Vitest reported `Tests  no tests`. `it.each` makes one test per item, so an empty list makes none, and the file only "passed" because the script had `--passWithNoTests`. Without the flag, Vitest fails with _No test found in suite_.

The fix is one `it` per rule that loops over the whole list inside it: it always runs once, and passes on an empty list because nothing in it is wrong. `--passWithNoTests` was dropped too, since a package with a test file should fail when it finds none. **Lesson: read the test count, not just the colour.**

Testing an empty list is worth it because the rules are in place before any data exists, so the first real feature is checked the day it lands.

### Shared state between tests

A `Set` shared across generated tests worked only while every test ran, in order, one at a time. Running one with `-t`, or making them concurrent, breaks it. A property of the whole list, like uniqueness, belongs in one test that checks the whole list.

### Failure messages

`expect` takes an optional message as its second argument. `expect(seen.has(key)).toBe(false)` fails with only _expected true to be false_. A message naming the key at fault tells whoever reads the CI log six months later what to fix. Name the value that's wrong: for a duplicate that's the key, not the feature's name.

### Break it on purpose

Adding two manifests with the same key, then a key like `War_Room`, showed each rule fail before trusting it green.

---

## Builds

### Mistake: tsconfig globs don't expand braces

The registry's `tsconfig.build.json` was copied from core's, which excluded `src/**/*.test.{ts,tsx}`. After a clean build, `dist` still held `index.test.js`. tsconfig patterns understand only `*`, `?` and `**/`, so the brace pattern matched a file literally named `*.test.{ts,tsx}` and excluded nothing, without any warning. It had been a latent bug in core, harmless only because core has no tests in `src`. The fix is two patterns, `src/**/*.test.ts` and `src/**/*.test.tsx`, in both packages.

`npx tsc -p <config> --listFilesOnly` shows exactly which files a config compiles. Checking it would have caught this before any build.

Compiled tests aren't needed for CI either: Vitest runs the `.ts` files directly and never reads `dist`.

### Smaller build surprises

- A new `tsconfig.build.json` does nothing until a script names it. Each config belongs to whichever script passes it with `-p`.
- `tsc` never deletes old output. Stale files in `dist` (an old `dist/src/`) hide what the current config produces, so clear `dist` before checking a build.
- `manifest.js` is emitted even though `manifest.ts` holds only an interface: `tsc` writes one file per source file. It's an 11-byte `export {};`, and nothing imports it at runtime.
- `--force` mattered again: config changes (a new tsconfig, new scripts) are exactly what a cached Turbo result can hide.

---

## Shipping

- **With squash merges, the PR title is the commit on `main`.** The branch's own commit messages disappear. PR #9 merged as `feat(features-registry) Setup …`, missing the colon Conventional Commits needs, and rewriting `main` to fix it wasn't worth it. Check the title before merging.
- Stage by path rather than `git add .`, so nothing unreviewed slips in. New files appear in `git diff` only once staged.
- A branch name never reaches `main` under squash merges, so a typo in one only shows in the PR. `git branch -m` renames it.

## Docs drift

`dependency-flow.md` still drew `apps → features → core` and listed the registry's place as an open question, while the code and lint rules had settled it. A vault note that disagrees with the code gets fixed in the same lesson, with a bumped `version`.
