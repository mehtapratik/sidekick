---
publish: true
id: build.phase-3.lesson-1
title: "Synergy Lesson 1 Walkthrough: Layer Folders and Lint"
created: 2026-11-11
updated: 2026-11-11
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-3
   - monorepo
   - eslint
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief]]"
---

# Synergy Lesson 1 Walkthrough — Layer Folders and Lint

This guide reproduces [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief|lesson 1]] of [[04-phases/03-synergy/00-plan|Phase 3]] step by step. Every layer gets its own folder: `core`, `ui` and `copy` move into `packages/foundation/`, an empty `@sidekick/synergy` appears in `packages/platform/synergy`, and lint fails a package that sits in no layer. The public site becomes a `site` element that may import foundation except `core`, with a minimal lint of its own. It implements [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]] 1.8.0 and [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]] 2.4.0.

It shipped as [sidekick#48](https://github.com/mehtapratik/sidekick/pull/48), one squash-merged PR. What was learned along the way is in [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/02-notes|the notes]].

Every step explains what you are doing and why. Run everything from the Sidekick repo root unless a step says otherwise.

## Where the build differs from the brief

- **The foundation workspace glob comes in step 1, not step 3.** The reinstall at the end of step 1 needs it: `packages/*` matches one level only, so without `packages/foundation/*` pnpm drops `core`, `ui` and `copy` from the workspace and every `workspace:*` dependency on them fails to install.
- **`packages/*` stays in `pnpm-workspace.yaml`.** It is what picks up the singletons. Naming them instead would leave a package created outside the layer folders outside the workspace, where Turbo never lints, type-checks or tests it. With the glob it joins the workspace and fails lint. The catch-all that goes is the boundaries one.
- **The site may import foundation except `core`.** D258 said "only foundation", but `core` is a foundation package, so that policy let the site import it. The policy now denies `core` by name, and D258's wording says what it meant.
- **The Next.js rules need no `ignores`.** They already target `apps/app/**`. Only the Pages Router ban, which targets every app's `src/pages/`, reached the site.
- **Two additions the brief didn't foresee:** a global ignore for Astro's generated `.astro/` folder, and an exemption from the no-layer rule for repo-root files, which editors lint.

---

## Step 1 — Move foundation

### 1.1 Branch and move

```bash
git switch -c refactor/layer-folders
mkdir -p packages/foundation
git mv packages/core packages/ui packages/copy packages/foundation/
git status --short | head
```

Every line should be a rename (`R`). `git mv` stages the delete and the add together, so the commit is pure renames with identical content: Git's rename detection matches them with certainty, and `git log --follow` and blame keep each file's history. Keep the edits of step 1.2 small for the same reason: a file changed past Git's 50% similarity threshold shows up as a new file.

The move takes the untracked `dist/` and `node_modules/` along. pnpm's links inside `node_modules` are relative, so they now point one level too shallow; the reinstall in 1.2 rebuilds them. Package names don't change, so no `import` changes anywhere.

### 1.2 Fix what counted folder levels

Each package now sits one level deeper, so every `../../` that climbed to the repo root needs a third `../`.

- `packages/foundation/core/tsconfig.json`, `ui/tsconfig.json` and `copy/tsconfig.json`: `"extends": "../../../tsconfig.base.json"`.
- `packages/foundation/core/package.json`:
   ```json
         "db:generate": "dotenv -e ../../../.env.local -- drizzle-kit generate",
         "db:migrate": "dotenv -e ../../../.env.local -- drizzle-kit migrate",
   ```
- `eslint.config.js`: the three file globs that name a package path become `packages/foundation/core/src/observability/log.ts`, `packages/foundation/ui/**/*.{ts,tsx}` (the React hooks block) and `packages/foundation/core/src/db/rls.ts`, plus the `root-path` comment. These globs only choose where a rule block applies, so a stale one fails silently: the logger's `console.log` exemption and the Rules of Hooks on `ui` would just stop applying.
- `.prettierignore`: `packages/foundation/core/src/db/migrations/meta/`.
- `.env.example`: the comment naming `packages/foundation/core/src/db/unsafe.ts`.
- `pnpm-workspace.yaml`: add `'packages/foundation/*'` under `packages:`.

Then reinstall:

```bash
pnpm install
grep -n "packages/foundation" pnpm-lock.yaml | head
```

The lockfile's `importers:` section is keyed by folder, so `packages/core:` becomes `packages/foundation/core:` and every `link:` to it follows (`link:../../packages/foundation/core` from `apps/app`, `link:../foundation/core` from `ops`). No version changes.

`core`'s `with-test-db.sh`, `drizzle.config.ts` and `vitest.config.ts` use paths relative to `core` itself, so they need nothing.

## Step 2 — Create the platform package

`packages/platform/synergy/package.json`:

```json
{
   "name": "@sidekick/synergy",
   "private": true,
   "license": "MIT",
   "version": "0.0.0",
   "type": "module",
   "exports": {
      ".": "./src/index.ts"
   },
   "scripts": {
      "typecheck": "tsc -p tsconfig.json --noEmit",
      "lint": "eslint .",
      "test": "vitest run src --passWithNoTests"
   },
   "devDependencies": {
      "vitest": "^5.0.5"
   }
}
```

`packages/platform/synergy/tsconfig.json`:

```json
{
   "extends": "../../../tsconfig.base.json",
   "include": ["src"]
}
```

`packages/platform/synergy/src/index.ts`:

```ts
// Synergy's public entry point. The /server, /react and /contracts entry
// points arrive in lesson 4; until then the package exports nothing.
export {};
```

- **`exports` points at TypeScript source and there is no `build`,** like `core` and the registry: Next.js and Vitest compile workspace TypeScript themselves. `exports` is a closed list, so a path not in it can't be imported; lesson 4 adds `./server`, `./react` and `./contracts`.
- **`--passWithNoTests`:** `vitest run` exits 1 when it finds no test file, which would fail CI's `test` job on an empty package.
- **`export {}`:** a file with no import or export is a global script to TypeScript, which `verbatimModuleSyntax` (it implies `isolatedModules`) refuses. `export {}` makes it a module that exports nothing.
- **No `outDir` or `rootDir`:** nothing is emitted.

Don't reinstall yet: nothing in `pnpm-workspace.yaml` matches `packages/platform/*` until step 3.

## Step 3 — Globs

`pnpm-workspace.yaml`:

```yaml
packages:
   - 'apps/*'
   - 'packages/*'
   - 'packages/foundation/*'
   - 'packages/platform/*'
   - 'packages/features/*'
   - 'content'
```

`eslint.config.js`, the import resolver's project list:

```js
const tsProjects = [
   'tsconfig.base.json',
   'apps/*/tsconfig.json',
   'packages/*/tsconfig.json',
   'packages/foundation/*/tsconfig.json',
   'packages/platform/*/tsconfig.json',
   'packages/features/*/tsconfig.json',
];
```

```bash
pnpm install
pnpm ls -r --depth -1 | grep sidekick
```

Eleven `@sidekick/*` packages and the root `sidekick` should be listed, with `@sidekick/synergy` under `packages/platform/`.

Three tools find packages three ways, which is why two files change:

- **pnpm** reads `pnpm-workspace.yaml`: a folder matching a glob and holding a `package.json` is a workspace package, linked into `node_modules` and run by Turbo. A glob that matches nothing yet (`packages/features/*`) is harmless; a match without a `package.json` (`packages/foundation` under `packages/*`) is skipped.
- **The ESLint import resolver** reads `tsProjects` to turn an import such as `@sidekick/core/db` into a file path. boundaries and `import-x/no-cycle` both need that path: boundaries can only judge an import once it knows which element the target file sits in.
- **boundaries** matches file paths against its own `elements` patterns (step 4).

## Step 4 — Boundaries

### 4.1 Elements and the no-layer rule

In `eslint.config.js`'s first block, the elements:

```js
         // A file belongs to the first element whose pattern matches: `site`
         // must come before `app`, because apps/* also matches apps/www. There
         // is no packages/* catch-all; a package in no element fails lint
         // (boundaries/no-unknown-files).
         'boundaries/elements': [
            { type: 'site', pattern: 'apps/www' },
            { type: 'app', pattern: 'apps/*' },
            { type: 'registry', pattern: 'packages/features-registry' },
            { type: 'feature', pattern: 'packages/features/*' },
            { type: 'platform', pattern: 'packages/platform/*' },
            {
               type: 'foundation',
               pattern: 'packages/foundation/*',
               capture: ['package'],
            },
            { type: 'tooling', pattern: 'packages/eslint-plugin-sidekick' },
            // Privileged scripts (dev seeds, provisioning, break-glass); nothing imports them
            { type: 'ops', pattern: 'packages/ops' },
         ],
```

and, next to `boundaries/no-unknown-dependencies`:

```js
         'boundaries/no-unknown-files': 'error',
```

- **An element is a folder with a type.** In the default `folder` mode, `packages/platform/*` makes each matching folder one element and every file inside belongs to it. Policies name types only, so a new platform package needs no config change.
- **First match wins,** so `site` comes before `app`. Otherwise the public site would be an `app` and could import `core`'s database client.
- **`capture: ['package']`** records which folder the `*` matched (`core`, `ui`, `copy`), so a policy can name one foundation package (4.2).
- **Two "unknown" rules:** `no-unknown-dependencies` reports an *import* whose target is in no element; `no-unknown-files` reports a *file* in no element, so a package created outside the layer folders fails. Before this lesson the `packages/*` catch-all called any such package foundation. In boundaries 7.4, `no-unknown` and `element-types` are deprecated aliases of `no-unknown-dependencies` and `dependencies`.

Editors lint repo-root files too, and three sit in no element (`eslint.config.js`, `stylelint.config.js`, `scripts/check-content.mjs`). `pnpm lint` never reaches them, so exempt them right after the boundaries block:

```js
   {
      // Repo-level tooling (this file, stylelint.config.js, scripts/) sits in no
      // layer. `pnpm lint` never lints it (it runs inside each package), but
      // editors do, so it is exempt from the no-layer check.
      files: ['*.{js,mjs,cjs,ts}', 'scripts/**'],
      rules: { 'boundaries/no-unknown-files': 'off' },
   },
```

In flat config a pattern without a slash matches only the config's own folder, so no package file is exempt (`eslint --print-config` shows the rule off for `eslint.config.js` and on for `packages/foundation/core/drizzle.config.ts`).

### 4.2 Policies

```js
         // Dependency direction: apps → registry → features → platform →
         // foundation; the site (apps/www) may import only foundation.
         // Everything not allowed here is disallowed, so nothing imports the
         // site, ops or tooling, and platform packages never import each other.
         // Imports within one package are never checked. Foundation packages
         // (core, ui, copy) and tooling import no other workspace package;
         // loosen deliberately with a new rule.
         'boundaries/dependencies': [
            'error',
            {
               default: 'disallow',
               policies: [
                  {
                     from: { element: { type: 'app' } },
                     allow: {
                        to: {
                           element: {
                              type: ['registry', 'feature', 'platform', 'foundation'],
                           },
                        },
                     },
                  },
                  {
                     from: { element: { type: 'registry' } },
                     allow: {
                        to: { element: { type: ['feature', 'platform', 'foundation'] } },
                     },
                  },
                  {
                     from: { element: { type: 'feature' } },
                     allow: { to: { element: { type: ['platform', 'foundation'] } } },
                  },
                  {
                     from: { element: { type: 'platform' } },
                     allow: { to: { element: { type: 'foundation' } } },
                  },
                  {
                     from: { element: { type: 'ops' } },
                     allow: {
                        to: { element: { type: ['registry', 'platform', 'foundation'] } },
                     },
                  },
                  {
                     from: { element: { type: 'site' } },
                     allow: { to: { element: { type: 'foundation' } } },
                  },
                  // D258: the site never reaches core (database, auth, API)
                  {
                     from: { element: { type: 'site' } },
                     disallow: {
                        to: {
                           element: {
                              type: 'foundation',
                              captured: { package: 'core' },
                           },
                        },
                     },
                  },
               ],
            },
         ],
```

(Prettier wraps the long lines.) With `default: 'disallow'`, what you don't write is the rest of the policy: nothing imports `site`, `ops` or `tooling`, `foundation` and `tooling` import nothing, and two platform packages are two elements of one type with no policy between them, so they can't import each other.

The site needs two policies because `core` is itself a foundation package: the `allow` alone let an Astro page import it, which a stdin probe showed before step 5. The `disallow` names `core` through the captured folder name. When policies conflict the later one wins, and its error says so (*"Denied by policy at index 6"*). The alternative, one `allow` with `captured: { package: '!core' }`, refuses too, but hides the ban in a glob and reports only that no policy allowed the import.

### 4.3 Lint the site, minimally

```bash
pnpm add -Dw eslint-plugin-astro
```

The plugin goes in the root `devDependencies` because `eslint.config.js` imports it, and Node resolves an import from the importing file's folder. Version 3.2 supports ESLint 10 and parses `.astro` frontmatter with the root `typescript-eslint`.

`apps/www/package.json` gets `"lint": "eslint ."`, and `eslint.config.js` four edits:

1. `import astro from 'eslint-plugin-astro';`
2. In the global `ignores`:
   ```js
            // Astro's generated types (gitignored), and the site's shipped-as-is assets
            '**/.astro/**',
            'apps/www/public/**',
   ```
   boundaries reports the generated `.astro/*.d.ts` files as being in no element: its patterns skip dot-folders, like most globs.
3. In the Pages Router block (`files: ['apps/*/pages/**', 'apps/*/src/pages/**']`):
   ```js
         // Astro's file router, not Next.js's Pages Router
         ignores: ['apps/www/**'],
   ```
4. At the end of the file, after every block that turns a rule on:
   ```js
      // ── Public site (apps/www) ────────────────────────────────────────────────
      // The site is temporary (D256): boundaries, the basics and the type-aware
      // promise checks stay on; the App's strictness does not apply.
      ...astro.configs.recommended,
      {
         files: ['apps/www/**'],
         languageOptions: {
            // Build scripts run in Node
            globals: { process: 'readonly', console: 'readonly' },
         },
         rules: {
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            // `({ drop, ...rest }) => rest` omits keys on purpose
            '@typescript-eslint/no-unused-vars': [
               'error',
               { ignoreRestSiblings: true },
            ],
            // Build scripts report through stdout
            'no-console': 'off',
            // Escapes inside regex character classes are clearer left in
            'no-useless-escape': 'off',
         },
      },
   ```

Flat config applies every matching block in order, and a later block overrides an earlier one rule by rule, so the block that turns rules off goes last. Each rule turned off answers a failure in the site as it stood; boundaries, the recommended sets, `eqeqeq`, the restricted imports, import hygiene and the promise checks stay on.

```bash
(cd apps/www && pnpm lint)
```

It is clean, and reads all 14 `.astro` files.

## Step 5 — Prove the policies

Commit the lesson's work first, so the probes can be thrown away without touching it:

```bash
git add -A
git commit -m "refactor: move packages into layer folders and lint by layer"
git switch -c scratch/prove-boundaries
```

Four probes, each with a real `package.json` dependency so only boundaries can fail it:

| Probe | Change | Expected |
| --- | --- | --- |
| Allowed: platform → foundation | `@sidekick/synergy` depends on `@sidekick/core`; `src/index.ts` is `export { placeholder } from '@sidekick/core';` | clean |
| Refused: foundation → platform | `@sidekick/core` depends on `@sidekick/synergy`; new `src/probe.ts` is `export * from '@sidekick/synergy';` | `boundaries/dependencies` |
| No layer | `packages/stray` with `package.json` (`lint` script), a `tsconfig.json` and `src/index.ts` | `boundaries/no-unknown-files` |
| Site → core | `@sidekick/www` depends on `@sidekick/core`; `src/pages/probe.astro` imports `placeholder` from it | denied by policy at index 6 |

```bash
pnpm install
(cd packages/platform/synergy && pnpm lint)
(cd packages/foundation/core && pnpm lint)
(cd packages/stray && pnpm lint)
(cd apps/www && pnpm lint)
```

Results, as run:

- synergy: clean.
- core: `There is no policy allowing dependencies from elements of type "foundation" and captured values: package="core" to elements of type "platform"`.
- stray: `File does not match any file pattern and does not belong to any known element`.
- www: `Dependencies to elements of type "foundation" and captured values: package="core" are not allowed in elements of type "site". Denied by policy at index 6`.

Run lint per package with `pnpm lint`, not Turbo: the first two probes make `core` and `synergy` depend on each other, and Turbo refuses a cyclic graph. The allowed probe matters as much as the refused ones: a policy that matches nothing (a type misspelled as `'platform '`) refuses everything, and only an import that must pass tells it apart from a working policy.

Throw the probes away and relink:

```bash
git add -A && git commit -m "scratch: boundaries probes" --no-verify
git switch refactor/layer-folders
git branch -D scratch/prove-boundaries
pnpm install
```

## Step 6 — Prove the move

```bash
pnpm turbo run build lint typecheck test --force
pnpm test:integration
pnpm db:migrate
pnpm prettier:check
```

29 of 29 tasks pass with 0 cached; `--force` keeps a cached green run from before the move from hiding a broken `extends`. `test:integration` runs `core`'s migrations and the RLS proof on a throwaway PostgreSQL 17 from the new folder. `db:migrate` against dev applies nothing and proves the hand-edited `../../../.env.local` path; a wrong path fails with `Missing DATABASE_DIRECT_URL`.

**Exit check:** the three refused probes fail and the allowed one passes (step 5), and step 6 is green.
