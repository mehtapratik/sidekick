---
title: Architecture Overview
nav_order: 4
---

# Architecture Overview — Why We Built Sidekick This Way

> Audience: Solo developer or someone new to the codebase who wants to understand *why* decisions were made, not just *what* was built.

---

## 1. Monorepo — One Repo, Multiple Apps and Packages

### What it is
A monorepo is a single git repository that contains multiple applications and shared packages. Sidekick has:
- `apps/web` — the Next.js web application
- `apps/cli` — a command-line tool
- `packages/core` — shared server-side infrastructure
- `packages/ui` — shared React components
- `packages/features-registry` — feature manifest registry
- `packages/feature-*` — one package per product feature (notes, writing, etc.)

### Why it matters
Without a monorepo, each of these would be a separate repository. Sharing code between them would require publishing packages to npm, versioning them, and keeping versions in sync — enormous overhead for a solo developer. A monorepo lets `apps/web` import from `packages/core` directly, without any publishing step.

### The alternative
Multiple separate repos ("polyrepo"). This works well at large companies with dedicated platform teams. For a solo developer it's painful — a one-line change to a shared utility requires: edit → commit → publish → update dependency → commit again. A monorepo collapses this to: edit → done.

---

## 2. pnpm — The Package Manager

### What it is
pnpm is a package manager (like npm or yarn) that installs JavaScript dependencies. It has two key advantages over npm:

1. **Disk efficiency** — pnpm stores each package version once on your machine and hard-links it into each project. If 10 projects use React 19, there's only one copy on disk.
2. **Workspace support** — pnpm has first-class support for monorepos via `pnpm-workspace.yaml`. It understands that `apps/web` and `packages/core` are local packages and links them directly.

### Why we chose it over npm or yarn
For a monorepo specifically, pnpm's workspace implementation is more reliable than npm's and faster than yarn's. The `packageManager` field in `package.json` (enforced by Corepack) ensures every developer and every CI environment uses the exact same pnpm version — eliminating "works on my machine" problems caused by package manager version differences.

---

## 3. Turborepo — The Task Runner

### What it is
Turborepo is a build system for monorepos. It runs tasks (`build`, `lint`, `typecheck`, `dev`) across all packages in the correct order, in parallel where possible, with caching.

### Why you need it
Without Turborepo, building the monorepo means manually running `build` in each package in dependency order. `packages/core` must build before `apps/web` because `apps/web` imports from it. Managing this manually is fragile and slow.

Turborepo reads each `package.json` to understand the dependency graph, then:
- Builds dependencies before dependents automatically
- Runs independent packages in parallel
- Caches results — if `packages/core` hasn't changed, it skips rebuilding it and replays the cached output in milliseconds

### What the `turbo.json` pipelines mean
- `build` with `dependsOn: ["^build"]` — the `^` means "build all my dependencies first"
- `dev` with `cache: false, persistent: true` — dev servers run forever, caching doesn't apply
- `lint` and `typecheck` — same dependency-first ordering so shared packages are checked before the apps that use them

---

## 4. TypeScript Strict Mode

### What it is
TypeScript adds static types to JavaScript. "Strict mode" (`"strict": true` in `tsconfig.json`) enables the most rigorous set of type checks, including:
- `strictNullChecks` — forces you to handle `null` and `undefined` explicitly
- `noImplicitAny` — every variable must have a known type

### Why it matters
Most production bugs in JavaScript applications are caused by two things: accessing properties on `null`/`undefined`, and passing the wrong type to a function. Strict mode makes TypeScript catch both of these at compile time — before the code ever runs.

The cost is some upfront discipline when writing code. The payoff is dramatically fewer runtime crashes, especially as the codebase grows.

### Why we enable it from day one
Retrofitting strict mode onto an existing codebase is painful — you get hundreds of type errors to fix all at once. Starting with it on day one means you never accumulate that debt.

---

## 5. API-First Architecture

### What it is
Every data mutation in Sidekick flows through an HTTP API endpoint at `/api/v1/*`. The browser UI, CLI, and future agents all use the same API layer.

### Why it matters
Without this constraint, it's tempting to add shortcuts: a Server Action here, a direct database call in a component there. Over time this scatters business logic across the codebase. Bugs become hard to find. Authorization checks get missed.

By routing everything through `/api/v1/*`:
- Business logic lives in one place
- Authorization is enforced once (in `withApiGuard`)
- The CLI and agents get the same capabilities as the browser automatically
- Future offline sync becomes possible — the repository layer can swap HTTP for a local database without the UI knowing

---

## 6. Enforced Dependency Direction

### The rule
`packages/*` must never import from `apps/*`. The only allowed direction is:

```
apps/*  →  packages/features/*  →  packages/core
```

### Why it matters
If a package imports from an app, you've created a circular dependency. The build graph breaks. More subtly, it means a shared package is now coupled to a specific application's internals — you can't reuse it elsewhere without dragging the whole app along.

This rule is enforced automatically by ESLint (set up in Checkpoint B) so it fails loudly the moment someone violates it, rather than silently accumulating technical debt.

---

## 7. Feature Packages

### What it is
Each product feature (notes, writing, bookmarks, recipes, etc.) lives in its own package: `packages/feature-notes`, `packages/feature-writing`, etc. Each package owns its database schema, migrations, and repository.

### Why it matters
This isolation means:
- Adding a new feature never touches existing feature code
- A bug in the recipes feature cannot affect the notes feature
- Features can be enabled/disabled per user via the entitlement system
- In the future, features could be independently deployed if needed

### `packages/features-registry`
This package owns `ALL_FEATURES` — the master list of feature manifests. `packages/core` stays deliberately feature-agnostic. The registry is the bridge between infrastructure and features.

---

## 8. Row-Level Security (RLS)

### What it is
RLS is a PostgreSQL feature that enforces data isolation at the database level. With RLS enabled, a user running `SELECT * FROM notes` only gets back *their own notes* — the database filters automatically based on the authenticated user's ID.

### Why it matters
Without RLS, data isolation depends entirely on application-level `WHERE user_id = $userId` clauses. If a developer forgets to add that clause, or a bug removes it, users can see each other's data. With RLS, the database enforces isolation regardless of what the application does.

### The `withRLS()` helper
The architecture provides a single `withRLS(userId, fn)` helper that sets up the RLS context for a database transaction. All code uses this helper exclusively — no manual RLS context injection allowed. This prevents the helper from being called incorrectly or forgotten.

---

## 9. Soft Deletes

### What it is
Instead of removing a row from the database when a user deletes something, soft deletes set a `deletedAt` timestamp. The row remains in the database but is filtered from all queries.

### Why it matters
Sidekick is designed for future offline sync. If a user deletes a note on their phone while offline, and their laptop syncs later, the laptop needs to know that note was deleted. A hard delete leaves no trace — there's nothing to sync. A soft delete leaves a tombstone record that the sync engine can use to propagate the deletion.

All queries on syncable tables must include `where(isNull(table.deletedAt))` to filter deleted records.

---

## 10. Vercel Hosting

### What it is
Vercel is a hosting platform built specifically for Next.js applications. It handles deployment, CDN, serverless functions, and environment variable management.

### Why it's the right choice here
- Zero-config deployment for Next.js — no Docker, no server management
- API routes (`/api/v1/*`) automatically become serverless functions
- Built-in preview deployments for every git branch
- Environment variable management through the Vercel dashboard
- Free tier is sufficient for early-stage development

The `packageManager` field in `package.json` also tells Vercel to use pnpm for installation — no additional configuration needed.
