# Tooling — Concepts and How We Use Them

This document covers the monorepo tooling decisions introduced in Phase 1: pnpm flags, Turborepo configuration, TypeScript module resolution, ESLint setup, and package conventions.

---

## pnpm `--filter` and `-w` / `--workspace-root`

When you run a `pnpm add` command in a monorepo, you need to tell pnpm which package to install the dependency into.

### `--filter <package-name>` or `-F`

Targets a specific package by its name (as declared in its `package.json`).

```bash
# Install drizzle-orm into packages/core only
pnpm add drizzle-orm --filter @sidekick/core

# Run lint only on apps/web
pnpm --filter @sidekick/web lint
```

The `--filter` flag matches on the `name` field in `package.json`, not the directory path.

### `-w` / `--workspace-root`

Installs the dependency into the root `package.json` — the workspace root.

```bash
# Install TypeScript as a root devDependency (hoisted to all packages)
pnpm add -D -w typescript
```

Use `-w` for tools that should be available across the entire workspace: TypeScript, ESLint, Prettier, Turborepo.

### When to use which

| Scenario | Flag |
|---|---|
| Adding a dependency used only by one package | `--filter @sidekick/package-name` |
| Adding a dev tool used across the whole monorepo | `-w` |
| Adding an ESLint plugin to the root config | `-w` |
| Adding a Drizzle driver to core | `--filter @sidekick/core` |

---

## `pnpm approve-builds`

### Why it exists

pnpm 9+ introduced a security feature: third-party packages cannot run arbitrary scripts during installation (like `postinstall`) unless you explicitly approve them. This prevents supply chain attacks where a malicious package uses `postinstall` to execute code on your machine the moment you run `pnpm install`.

Two packages in Sidekick need native compilation during install:

- **`sharp`** — Next.js image optimization. Compiles C++ bindings for fast image processing.
- **`unrs-resolver`** — Used internally by ESLint plugins. Also compiles native code.

Both are legitimate, widely-used packages. Approving them is safe.

### How to invoke it

```bash
# From the repo root
pnpm approve-builds

# Follow the interactive prompt — select sharp and unrs-resolver
```

If you see errors about packages not being allowed to run build scripts, run this command. You may need to run it inside `apps/web` separately if that package has its own local `node_modules` context (pnpm install contexts are per-workspace, and `apps/web` can have a separate context if it was bootstrapped with `create-next-app`).

The `pnpm.onlyBuiltDependencies` field in root `package.json` documents which packages are approved:

```json
"pnpm": {
  "onlyBuiltDependencies": ["sharp", "unrs-resolver"]
}
```

---

## Turborepo: `cache`, `persistent`, and `dependsOn`

Turbo's job is to run tasks across packages in the right order and cache the results. These three properties in `turbo.json` control that behavior.

### `dependsOn: ["^build"]` — Why order matters for `build`

The `^` prefix means "all dependencies of this package must complete this task first."

```json
"build": {
  "dependsOn": ["^build"]
}
```

If `apps/web` depends on `packages/core`, Turbo will build `packages/core` first, then `apps/web`. This mirrors how module resolution works at runtime — `apps/web` imports from `packages/core`, so `core` must be built before `web` can compile.

Without `dependsOn`, Turbo might try to build `apps/web` before `packages/core` is ready, producing import errors.

### `dependsOn` with a specific package — The `Package#task` syntax

```json
"lint": {
  "dependsOn": ["@sidekick/eslint-plugin-sidekick#build", "^lint"]
}
```

This is a named package task dependency. Before running `lint` in any package, Turbo first runs `build` in `@sidekick/eslint-plugin-sidekick`.

Why? ESLint needs to load the plugin as a compiled JavaScript module. The plugin source is TypeScript. If the plugin hasn't been built yet, ESLint will fail to load it. This `dependsOn` ensures the plugin is always compiled before any package runs lint.

### `cache: false` — When to skip caching

```json
"db:migrate": {
  "cache": false
}
```

Turbo caches tasks by hashing source files and inputs. If the inputs haven't changed, it skips re-running the task. This is correct for deterministic tasks like `build` and `typecheck`.

Database migration is a **side-effecting operation** — it modifies an external system (the database). If you run `db:migrate`, you want it to actually run, regardless of whether the migration files changed since last time. Maybe you need to re-apply, maybe the database was reset, maybe you're working against a different database. Caching would mean "no source changes, skip the migration" — which is wrong.

`cache: false` also means the task always shows up as a cache miss in Turbo's output, which is the correct visual signal: this task always executes.

### Why `db:migrate` does NOT have `dependsOn: ["^build"]`

Migrations run from your local machine against the database directly. They do not need `packages/core` to be built — they just need the SQL files that `drizzle-kit generate` produced. Adding a `dependsOn` on `build` would force Turbo to compile the entire monorepo before you could run a migration. That is unnecessary overhead.

### `persistent: true` — For dev servers

```json
"dev": {
  "cache": false,
  "persistent": true
}
```

`persistent: true` tells Turbo that this task runs indefinitely and never exits. Dev servers are persistent — they watch for file changes and keep running. Without this flag, Turbo would treat the task as hung after a timeout.

`cache: false` on `dev` is obvious: you always want to start the dev server fresh.

---

## Why We Cannot Use Node.js `--env-file`

Node.js 22 added a `--env-file` flag:

```bash
node --env-file=.env.local your-script.js
```

This looks like an elegant way to load environment variables. The problem: we need to pass this flag to scripts run by pnpm, and the natural place to do that is `NODE_OPTIONS`. But Node.js explicitly blocks `--env-file` when it is passed via `NODE_OPTIONS`:

```bash
# This fails with a security error:
NODE_OPTIONS="--env-file=../../.env.local" drizzle-kit migrate
```

Node.js treats `NODE_OPTIONS` as a security boundary — allowing `--env-file` via `NODE_OPTIONS` would mean any environment variable could inject arbitrary flags into every Node.js process, which is a security risk.

### The solution: `dotenv-cli`

`dotenv-cli` is installed at the workspace root. It loads a `.env` file into the process environment before running a command:

```bash
dotenv -e ../../.env.local -- drizzle-kit migrate
```

This works because `dotenv-cli` is a process wrapper, not a Node.js flag. It reads the file and sets environment variables in the child process before the child starts. No `NODE_OPTIONS` involved.

The `.env.local` file lives at the repo root. The `../../` path in package scripts is relative to the package directory (`packages/core/`). There is exactly one `.env.local` file in the entire repo — never create one inside a package directory.

---

## Single `eslint.config.js` Across All Packages

ESLint 9's flat config format changed how ESLint discovers its configuration. In the legacy format (`.eslintrc.json`), ESLint walked up from the file being linted, finding the nearest config file. In the flat config format, ESLint still walks up — and finds the nearest `eslint.config.js`.

Since the repo has a single `eslint.config.js` at the root, all packages share it automatically. No per-package ESLint config file is needed.

This is intentional: we want the same rules everywhere. The root config defines:
- The TypeScript parser
- The `no-mantine-style-props` rule (via `@sidekick/eslint-plugin-sidekick`)
- The import boundary rule (via `eslint-plugin-boundaries`)
- File-level overrides where needed

If a package needs a rule override, add it to the root config with a `files` glob that targets that package. Never create a per-package `eslint.config.js`.

---

## The `exports` Field in `package.json`

Node.js and bundlers traditionally resolved imports by looking for files based on the `main` field in `package.json` or guessing file paths. The `exports` field is a more explicit, secure replacement.

### How it works

```json
"exports": {
  ".": "./src/index.ts",
  "./supabase/browser": "./src/supabase/browser.ts",
  "./supabase/server": "./src/supabase/server.ts",
  "./supabase/proxy": "./src/supabase/proxy.ts",
  "./supabase/admin": "./src/supabase/admin.ts",
  "./db": "./src/db/index.ts",
  "./db/rls": "./src/db/rls.ts"
}
```

Each key is a **subpath** that consumers can import. Each value is the file that subpath resolves to.

```ts
// This works:
import { createBrowserClient } from '@sidekick/core/supabase/browser'

// This does NOT work (not in exports map):
import { createBrowserClient } from '@sidekick/core/src/supabase/browser'
```

The `exports` field acts as the package's public API surface. Anything not listed in `exports` cannot be imported from outside the package (in environments that respect `exports`). This is an intentional encapsulation boundary.

### Why this matters for Sidekick

Each Supabase client file is exported under its own subpath. This means:
- You can import just the browser client without accidentally pulling in `next/headers` (which is Node.js-only)
- The import path clearly signals which client you're using
- Tree-shaking can be more effective when consumers import specific subpaths

---

## `workspace:*` in Dependencies

```json
"dependencies": {
  "@sidekick/core": "workspace:*"
}
```

`workspace:*` is a pnpm-specific version specifier. It means: "resolve this dependency from the local workspace, not from the npm registry."

When you run `pnpm install`, pnpm creates a symlink from the consuming package's `node_modules` to the local package directory. Changes you make to `packages/core` are immediately visible to `apps/web` — no publish step needed.

The `*` means "match whatever version is declared in the workspace package's `package.json`." You can also use `workspace:^1.0.0` to be version-range-specific, but `workspace:*` is simpler for internal packages that always move together.

### Contrast with npm registry packages

```json
"dependencies": {
  "drizzle-orm": "^0.45.2"  // from npm
}
```

A package without `workspace:` is fetched from the npm registry and installed normally.

---

## pnpm Hoisting — Root Dependencies Are Available Everywhere

When you install a package at the workspace root with `-w`, pnpm makes it available to all packages in the workspace through hoisting. The package is installed once in the root `node_modules`, and all packages can import it.

This is how TypeScript, ESLint, and Prettier work across the monorepo without being installed separately in each package.

**The practical rule:** Install packages where they are used. If a package is only used in `packages/core`, install it there. If it is used everywhere (TypeScript, ESLint), install it at the root. Hoisting makes root packages available everywhere, but explicit is better than implicit — a package listed in root `devDependencies` documents that it is intentionally shared, not accidentally available.

---

## TypeScript `moduleResolution` — Which One and When

TypeScript's `moduleResolution` setting controls how TypeScript resolves module imports. This has become complex because there are several strategies with meaningfully different behavior.

### `"node"` — Legacy

The original Node.js CommonJS resolution. Looks for files without extensions, checks `index.js` in directories, reads `main` in `package.json`. Does **not** understand the `exports` field. This is legacy behavior — avoid it.

### `"nodenext"` — Strict ESM

Designed for Node.js ESM (ECMAScript modules). Very strict: requires `.js` extensions on all imports, even for TypeScript files (because TypeScript compiles to `.js`). Fully supports the `exports` field.

The extension requirement is the problem. Writing `import { x } from './foo.js'` when the file is `foo.ts` is confusing and a common source of errors. This is correct from a Node.js ESM standpoint but painful in practice.

### `"bundler"` — Modern Default for Bundled Code

Designed for code that runs through a bundler (Next.js/SWC, Vite, webpack). No extension requirements, fully supports `exports`, handles both ESM and CJS consumption. This is the right choice for any package that will be consumed by a bundler.

### What Sidekick uses

`tsconfig.base.json` uses `"moduleResolution": "bundler"` for all packages. All application code runs through Next.js (SWC), so `bundler` resolution matches the actual execution environment.

### The ESLint plugin exception

The ESLint plugin (`packages/eslint-plugin-sidekick`) is a special case. ESLint loads plugins via Node.js `require()` — not through a bundler. This means the output must be CommonJS-formatted `.js` files that Node.js can load directly.

With `moduleResolution: bundler` and `tsc`, you would produce ESM output that Node.js cannot load as a plugin. `tsup` solves this by bundling everything into a single CommonJS file:

```bash
tsup src/index.ts --format esm --dts --out-dir dist
```

Wait — but it says `--format esm` there. The reason: Turbo and the ESLint flat config system both support ESM. The plugin's `package.json` has `"type": "module"`, so Node.js treats the output as ESM. The key is that `tsup` produces a single self-contained output file with no relative imports — Node.js can load it directly without needing to resolve any `.ts` files or understand import paths.

The alternative would be to configure `tsc` with a separate `tsconfig` targeting CommonJS — adding complexity and a separate compilation step. `tsup` is simpler.

---

## `tsc --noEmit` for Typechecking vs Emitting

### `tsc --noEmit`

Checks all types, reports errors, but does not write any output files. Used in the `typecheck` script.

```bash
tsc --noEmit  # Type check only — no output files written
```

This is useful in CI and during development: you want to know if the types are correct without producing compiled output. Running typecheck is faster than a full build because it skips file I/O.

### `tsc` (without `--noEmit`)

Produces compiled JavaScript in the `outDir`. Used when you need actual output — like when another tool needs to import compiled JS.

In Sidekick, most packages don't use `tsc` output directly because their consumers (Next.js, ESLint, etc.) handle TypeScript themselves. The `exports` in `package.json` point directly to `.ts` source files for packages consumed by Next.js. Only the ESLint plugin uses `tsup` to produce compiled output, because ESLint cannot process TypeScript files without a compilation step.

---

## Barrel Files and Tree-Shaking

A **barrel file** is an `index.ts` that re-exports everything from a directory:

```ts
// packages/core/src/index.ts (barrel)
export * from './supabase/browser'
export * from './supabase/server'
export * from './supabase/admin'
export * from './db'
export * from './db/rls'
```

The problem: when a consumer imports one thing from the barrel, bundlers must process the entire barrel to resolve that import. Even if tree-shaking removes unused exports from the final bundle, the bundler may still execute side effects from all the modules the barrel re-exports.

In the case of `packages/core`, importing from the barrel would pull in `next/headers` (from the server client) and `@supabase/supabase-js` (from the admin client) into every bundle that imports anything from core — even if the consumer only needs the browser client.

### The solution: subpath exports

Instead of `import { createBrowserClient } from '@sidekick/core'`, consumers import `import { createBrowserClient } from '@sidekick/core/supabase/browser'`. Each subpath only loads that specific file. No barrel, no unintended imports.

### When barrel files are acceptable

Barrel files are acceptable when:
- The package is small and all its exports are likely to be used together
- The package's consumers go through a bundler that performs aggressive tree-shaking
- The exports have no runtime side effects

For feature packages that export a schema, repository, and API together, a barrel file inside the package (not exposed as the package entry point) can be fine. The key risk is the package boundary: the `exports` field in `package.json` should use specific subpaths, not a single barrel entry.

---

## Default Exports vs Named Exports

### Why default exports cause problems

```ts
// Default export
export default function MyComponent() { ... }

// Named export
export function MyComponent() { ... }
```

Default exports:
- Do not enforce a name. The consumer can import as anything: `import Foo from './MyComponent'`
- Are harder to auto-import (editors use the file name as a guess, not a guaranteed name)
- Can cause issues with some tree-shaking optimizations
- Make global find/replace of component names less reliable

Named exports:
- The name is part of the export contract — it is consistent across the codebase
- Auto-import works perfectly — the editor knows the exact export name
- Refactoring tools work reliably

### The rule in Sidekick

**Named exports everywhere, except where Next.js requires default exports.**

Next.js's routing system requires default exports for:
- `page.tsx` — the route component
- `layout.tsx` — the layout component
- `loading.tsx`, `error.tsx`, `not-found.tsx` — special Next.js files

Anywhere else — hooks, utilities, components, clients, helpers — use named exports. The `no-default-export` rule in `packages/eslint-plugin-sidekick` enforces this and allows exceptions for Next.js special files.
