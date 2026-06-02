---
title: Packages
---

# Packages — Monorepo Package Concepts

This document covers how packages in a pnpm monorepo expose their API, declare dependencies, and share code through workspace linking and hoisting.

---

## The `exports` Field in `package.json`

Traditionally, Node.js resolved imports using the `main` field in `package.json`:

```json
{ "main": "./src/index.js" }
```

Everything the package provided had to flow through that one entry point. Consumers could also directly import internal paths — `import x from '@my-pkg/src/internals/secret'` — because nothing prevented it.

The `exports` field is a more explicit, more powerful replacement:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./supabase/browser": "./src/supabase/browser.ts",
    "./supabase/server": "./src/supabase/server.ts",
    "./supabase/proxy": "./src/supabase/proxy.ts",
    "./supabase/admin": "./src/supabase/admin.ts",
    "./db": "./src/db/index.ts",
    "./db/schema": "./src/db/schema/index.ts",
    "./db/rls": "./src/db/rls.ts"
  }
}
```

### How it works

Each key in `exports` is a **subpath** — a path relative to the package name that consumers can import. Each value is the file it resolves to.

```ts
// Works — "./" maps to "./src/index.ts"
import { something } from '@sidekick/core'

// Works — "./supabase/browser" maps to "./src/supabase/browser.ts"
import { createBrowserClient } from '@sidekick/core/supabase/browser'

// FAILS — not listed in exports
import { createBrowserClient } from '@sidekick/core/src/supabase/browser'
```

Anything not listed in `exports` **cannot be imported** from outside the package (in environments that respect `exports` — Node.js 12+, all modern bundlers). This enforces the package's public API surface. Internal files stay internal.

### Why Sidekick uses subpath exports instead of a single barrel

Each Supabase client file imports different APIs:
- `browser.ts` — safe to import anywhere
- `server.ts` — imports `next/headers` (Node.js only)
- `proxy.ts` — designed for the Edge runtime
- `admin.ts` — imports `supabase-js` with the secret key (server-only)

If these were all re-exported from a single `index.ts`, a Client Component importing anything from `@sidekick/core` would inadvertently pull in `next/headers` — which crashes in the browser bundle. Subpath exports prevent this: each consumer imports exactly the subpath they need, and the bundler only processes that file.

### Pointing to `.ts` source files

Notice the `exports` values point to `.ts` files, not compiled `.js` files:

```json
"./supabase/browser": "./src/supabase/browser.ts"
```

This works because `apps/web` is a Next.js project — its bundler (SWC) processes TypeScript directly. Next.js compiles the workspace package's `.ts` files as part of the app build. There is no separate "compile the package first" step needed.

The only package in Sidekick that must produce compiled `.js` output is `packages/eslint-plugin-sidekick`, because ESLint loads plugins via Node.js `require()` which cannot process `.ts` files. That package uses `tsup` to compile to `dist/index.js` and its exports field points to the compiled output.

---

## `workspace:*` — Local Package References

```json
{
  "dependencies": {
    "@sidekick/core": "workspace:*"
  }
}
```

`workspace:*` is a pnpm-specific version specifier. It means: "resolve this dependency from the local workspace rather than from the npm registry."

### What pnpm does with `workspace:*`

When you run `pnpm install`, pnpm finds the package named `@sidekick/core` in the workspace (it's in `packages/core/package.json`), and creates a symlink from `apps/web/node_modules/@sidekick/core` to `packages/core/`. The consuming app sees the local package as if it were installed from npm — but any changes you make to `packages/core` are immediately visible without a publish step.

### The `*` part

`workspace:*` means "match whatever version is in the workspace package's `package.json`.". The actual version number in `packages/core/package.json` (`"version": "0.0.0"`) does not matter for workspace resolution — `workspace:*` always resolves to the local copy.

You could write `workspace:^1.0.0` to enforce a version range, but for internal packages that are always developed together, `workspace:*` is simpler and more explicit about intent: "I always want the local version."

### Contrast with npm registry packages

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.10.3"
  }
}
```

A dependency without `workspace:` is resolved from the npm registry. pnpm downloads and installs it normally. The version range (`^0.10.3`) controls which versions are acceptable.

### When to add `workspace:*` vs add an external package

Add `workspace:*` when the dependency is a package in your own monorepo. Add an external package when it comes from npm. There is no overlap — a package is either in your workspace or it is not.

---

## pnpm Hoisting — Root Dependencies Available Everywhere

### The problem without hoisting

In a monorepo without hoisting, each package has its own isolated `node_modules`. If `packages/core` and `apps/web` both need TypeScript, it would be installed twice — once in each package's `node_modules`.

```
packages/core/node_modules/typescript   ← one copy
apps/web/node_modules/typescript        ← another copy
```

For development tools used across the entire monorepo (TypeScript, ESLint, Prettier), this means:
- Redundant disk usage
- Version drift risk (each package pinning a slightly different version)
- Configuration split (separate `tsconfig.json` settings for each package's TypeScript)

### pnpm's hoisting

pnpm installs packages at the most appropriate level. Packages installed at the **workspace root** with `-w`:

```bash
pnpm add -w typescript eslint prettier
```

These go into the root `node_modules/`. pnpm's hoisting makes them available to all packages in the workspace without being declared in each package's `package.json`.

### The practical rule

Install at the package level when the dependency is:
- Specific to that package's runtime (e.g. `drizzle-orm` in `packages/core`)
- Only used in one place

Install at the root (`-w`) when the dependency is:
- A development tool used across the whole monorepo (TypeScript compiler, ESLint, Prettier, Turborepo)
- A shared dev dependency that all packages rely on for type checking or linting

Hoisting makes root packages available everywhere — but listing a package in the root `devDependencies` also documents the intent: "this is intentionally shared across the monorepo." Packages that accidentally end up in `node_modules` due to hoisting are an implicit dependency, not an explicit one. Explicit is better.

### `pnpm-workspace.yaml`

This file at the repo root tells pnpm which directories are workspace packages:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

pnpm reads this to discover all workspace packages and wire up `workspace:*` dependencies. Every directory matched by these globs is treated as a workspace package — pnpm links them together during `pnpm install`.

---

## `devDependencies` vs `dependencies` in a Monorepo

### The distinction

**`dependencies`:** Required at runtime — must be present when the package is actually used in production.

**`devDependencies`:** Only needed during development, building, or testing — not at runtime.

### Why it matters for packages

For published npm packages, bundling `devDependencies` into the output would bloat it. npm respects this boundary when installing: `npm install --production` skips `devDependencies`.

### In a pnpm monorepo (like Sidekick)

The distinction matters less for internal workspace packages, because nothing is published to npm — everything is always installed. But the convention still carries signal:

- `"drizzle-kit"` in `devDependencies` of `packages/core` — the migration CLI, never needed in production runtime
- `"drizzle-orm"` in `dependencies` of `packages/core` — the query builder, needed in production runtime when querying the database
- `"next"` in `peerDependencies` of `packages/core` — signals that `packages/core` expects Next.js to be provided by the consumer (it is, by `apps/web`), but does not install its own copy

The `peerDependencies` pattern is worth noting: `packages/core` imports from `next/headers`. Rather than installing `next` as a dependency (which would install a second copy alongside the one in `apps/web`), it declares `next` as a peer. The consumer (`apps/web`) already has Next.js installed — pnpm uses that copy.
