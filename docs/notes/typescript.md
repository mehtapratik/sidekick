---
title: TypeScript
---

# TypeScript and Bundlers

This document covers TypeScript compilation concepts and bundler behaviour as they apply to the Sidekick monorepo.

---

## `moduleResolution` — Which One and When

`moduleResolution` in `tsconfig.json` controls how TypeScript figures out which file to use when it sees an `import` statement. The options have evolved as the JavaScript ecosystem moved from CommonJS to ESM, and as bundlers became dominant.

### The three you need to know

#### `"node"` — Legacy CommonJS

The original resolution algorithm, mimicking how Node.js resolved `require()` in CommonJS:
- No file extensions needed on imports (`import x from './foo'` → finds `./foo.js` or `./foo/index.js`)
- Reads `main` in `package.json`, ignores `exports`
- Does **not** understand the `exports` field in `package.json`

This is legacy. If you see it in a codebase today, it is likely carried over from before ESM became mainstream. Avoid it for new code.

#### `"nodenext"` — Strict ESM

Designed for code that runs directly in Node.js ESM (without a bundler):
- Requires explicit `.js` extensions on every relative import, even for TypeScript files: `import x from './foo.js'` (even though the file is `foo.ts` — TypeScript compiles to `.js` and Node.js will load the compiled file)
- Fully understands the `exports` field
- Fully understands `"type": "module"` vs CommonJS in `package.json`

The extension requirement is the pain point. Writing `./foo.js` for a `.ts` file is counterintuitive and a persistent source of confusion. It is correct from a strict Node.js ESM standpoint, but it makes developer experience worse for code that will be processed by a bundler anyway.

Use `nodenext` for: standalone Node.js scripts or packages that are published to npm and consumed directly in Node.js ESM contexts without a bundler.

#### `"bundler"` — Modern Default for Bundled Code

Designed for code that will go through a bundler (Next.js/SWC, Vite, webpack, esbuild, tsup):
- No extension requirements on imports — import `'./foo'` and TypeScript figures out the file
- Fully understands the `exports` field and subpath imports
- Does not require `"type": "module"` to use ESM syntax
- Handles conditional exports (`import` vs `require` conditions)

Bundlers handle extension resolution themselves, so `"bundler"` tells TypeScript to trust that the bundler will resolve things correctly. This matches how the code will actually be executed.

### What Sidekick uses and why

`tsconfig.base.json` sets `"moduleResolution": "bundler"` for all packages.

All application code in Sidekick is processed by Next.js (SWC) before it runs. There is no code that runs directly in Node.js ESM without a bundler — except `drizzle-kit`, but it handles its own loading. `"bundler"` resolution matches the actual execution environment and avoids the `.js` extension ceremony that `"nodenext"` requires.

### The ESLint plugin exception

`packages/eslint-plugin-sidekick` is a special case. ESLint loads plugins via Node.js `require()`. If you compiled the plugin with `tsc` targeting ESM (as `"bundler"` mode implies), Node.js might not be able to load the output depending on how `"type"` is set in `package.json` and how ESLint resolves plugins.

`tsup` solves this cleanly by bundling the plugin into a single self-contained output file. The bundler handles all the resolution internally, and the output is a clean file that ESLint can load. See the [Tooling doc](./tooling.md) for the full explanation of why `tsup` and not `tsc`.

---

## `tsc` vs `tsup` — When to Use Which

Both `tsc` and `tsup` compile TypeScript. They serve different purposes.

### `tsc` — the TypeScript compiler

`tsc` is the official TypeScript compiler. It reads TypeScript files, checks types, and outputs JavaScript files (when not run with `--noEmit`).

**What it does well:**
- Type checking — it is the definitive source of truth for type errors
- Generating `.d.ts` declaration files for library packages
- Compiling code that maps 1:1 from `.ts` input to `.js` output

**What it does not do:**
- Bundle multiple files into one
- Tree-shake dead code
- Handle non-TypeScript assets (CSS, images)
- Polyfill for older environments
- Target multiple module formats (ESM + CJS) in one pass

For packages in Sidekick that are consumed directly by Next.js (which processes TypeScript itself), `tsc` output is not even needed — `package.json` exports point to `.ts` source files. `tsc` is only used for the `typecheck` script (`tsc --noEmit`) to catch type errors.

### `tsup` — a TypeScript bundler wrapper

`tsup` is built on `esbuild` and handles bundling, not just compilation. It:
- Bundles multiple input files into a single output file
- Supports multiple output formats in one command (ESM and CJS simultaneously)
- Is much faster than `tsc` for bundling (esbuild is written in Go)
- Can generate `.d.ts` declaration files (by running `tsc` under the hood for type generation only)
- Handles tree-shaking

**In Sidekick, `tsup` is used for one package: `packages/eslint-plugin-sidekick`.**

The reason: ESLint loads plugins via Node.js. Node.js cannot load `.ts` files directly. The plugin source must be compiled to JavaScript before ESLint can use it. `tsup` compiles and bundles the plugin into `dist/index.js`, which the `exports` field in `package.json` points to. ESLint loads that compiled file.

**Why not `tsc` for the ESLint plugin?** `tsc` in ESM mode (`"moduleResolution": "bundler"`) produces output with imports that lack `.js` extensions, which can confuse Node.js ESM loading. `tsup` produces a single self-contained file with no relative imports to resolve — Node.js loads it cleanly.

### Summary

| Scenario | Tool |
|---|---|
| Type checking during development | `tsc --noEmit` |
| Code consumed by Next.js (SWC processes it) | No compilation needed — `package.json` points to `.ts` |
| Code that must run in Node.js directly (ESLint plugin) | `tsup` (bundles to a single `.js` file) |
| Published npm library (not applicable in Sidekick yet) | `tsc` for declarations + `tsup` or `esbuild` for bundles |

---

## `--noEmit` — Type Checking Without Output

```bash
tsc --noEmit
tsc -p tsconfig.json --noEmit
```

`--noEmit` tells `tsc` to run its full type-checking pass but not write any output files to disk. The compiled JavaScript is discarded.

**When to use it:**
- The `typecheck` script — you want to know if there are type errors, but you do not need the compiled output (Next.js handles compilation)
- CI pipelines — fast type safety gate without producing artifacts

**When not to use it:**
- When you actually need the compiled JavaScript (the ESLint plugin build, for example)

The combination you will see in Sidekick:
```bash
pnpm typecheck   # runs tsc --noEmit across all packages via Turbo
pnpm build       # runs next build (which does its own TypeScript compilation)
```

Both check types. `typecheck` is faster and gives you type errors without a full build. `build` compiles everything and produces deployable output — it also catches type errors, but as a side effect of building.

---

## Barrel Files and Tree-Shaking

A **barrel file** is an `index.ts` that re-exports everything from multiple modules:

```ts
// packages/core/src/index.ts — a barrel file
export * from './supabase/browser'
export * from './supabase/server'
export * from './supabase/admin'
export * from './db'
export * from './db/rls'
```

The consumer imports from the barrel: `import { createBrowserClient } from '@sidekick/core'`.

### The problem with barrel files

**Module loading is all-or-nothing at the file level.** When a bundler processes a barrel, it must load every file the barrel imports — even if the consumer only uses one export from one of those files.

Consider: `createBrowserClient` is defined in `supabase/browser.ts`. `supabase/server.ts` imports `next/headers`. If a Client Component imports `createBrowserClient` from a barrel that also re-exports `createServerClient`, the bundler has to process `supabase/server.ts` — and its `import { cookies } from 'next/headers'` — even though the consumer never needed the server client. `next/headers` is Node.js-only and crashes in the browser bundle.

Tree-shaking helps remove unused **exports** from the final bundle, but it does not prevent the bundler from evaluating the **side effects** of loading the modules. Importing `next/headers` is a side effect — it fails at the module evaluation step, before any tree-shaking can remove the unused code.

### The solution: subpath exports

```ts
// ✅ Safe — only loads browser.ts
import { createBrowserClient } from '@sidekick/core/supabase/browser'

// ❌ Dangerous — loads the barrel, which loads server.ts, which imports next/headers
import { createBrowserClient } from '@sidekick/core'
```

Subpath exports (`"./supabase/browser"` in `package.json`'s `exports` field) let consumers import exactly the module they need. No barrel. No unintended side effects.

### When barrel files are acceptable

Barrel files are acceptable when:
- All re-exported modules have no runtime side effects (no code runs when the module is loaded)
- All re-exported modules target the same environment (all browser, or all Node.js — not mixed)
- The package is small and always used as a whole

In Sidekick, `packages/copy` is a good candidate for a barrel — all it contains is plain TypeScript objects (string constants). No side effects. No environment-specific code. Importing the barrel is safe.

`packages/core` is explicitly **not** a barrel at the package level — because it mixes browser-only, Node.js-only, and Edge-only clients. The `exports` field in `packages/core/package.json` maps each subpath directly to the specific file.

---

## Default Exports vs Named Exports

### Named exports (preferred)

```ts
// utils.ts
export function formatDate(date: Date): string { ... }
export function formatCurrency(amount: number): string { ... }
```

```ts
// consumer
import { formatDate } from './utils'
```

The name is part of the contract. The consumer must use the exported name. Every tooling that understands the codebase — TypeScript, ESLint, your editor's auto-import, refactoring tools — works with the exact name.

### Default exports

```ts
// utils.ts
export default function formatDate(date: Date): string { ... }
```

```ts
// consumer — can name it anything
import myDateFormatter from './utils'
import formatDate from './utils'
import ¯\_utility_\_¯ from './utils'
```

Default exports have no enforceable name at the export site. The consumer names them at import time. This leads to:
- Inconsistent names across the codebase for the same function
- Auto-import guessing from the file name (sometimes wrong, always a guess)
- Find-and-replace renames that miss some usages
- Harder to detect circular imports in some bundlers

### Why Next.js requires default exports for special files

Next.js's file-system routing reads `page.tsx`, `layout.tsx`, `loading.tsx`, etc. and expects the route handler to be the default export of those files. This is a framework convention, not a TypeScript or JavaScript requirement. Next.js needs a known, discoverable entry point — `default` is the convention it chose.

```ts
// page.tsx — default export required by Next.js
export default function DashboardPage() { ... }
```

### The rule in Sidekick

**Use named exports everywhere, except where Next.js requires a default export.**

Files that require a default export in Next.js:
- `page.tsx`
- `layout.tsx`
- `loading.tsx`
- `error.tsx`
- `not-found.tsx`
- `template.tsx`
- `route.ts` (Route Handlers)

Everything else — components, hooks, utilities, clients, helpers — use named exports. The `no-default-export` ESLint rule in `packages/eslint-plugin-sidekick` enforces this, with an exception allowlist for the Next.js special files.
