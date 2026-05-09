# Tooling Decisions — Why We Chose What We Chose

> This document records the non-obvious decisions made during Phase 0 setup, with rationale. Future developers (or your future self) should read this before changing any tooling configuration.

---

## Decision 1 — Corepack over global pnpm install

**What we chose:** Corepack (`corepack enable` + `corepack use pnpm@latest`) rather than `npm install -g pnpm`.

**Why:**
Corepack is Node's built-in package manager manager. It reads the `packageManager` field in `package.json` and enforces the exact version (including a SHA512 hash) every time someone installs packages in the repo. This means:
- Every developer uses the exact same pnpm version
- CI uses the exact same pnpm version
- Vercel uses the exact same pnpm version
- Version drift is impossible

A globally installed pnpm via `npm install -g pnpm` has no enforcement — different machines silently use different versions.

**The SHA512 hash:** The `packageManager` field stores a cryptographic fingerprint of the pnpm binary. Corepack verifies this on download, preventing tampered binaries from being used even if the package registry is compromised.

---

## Decision 2 — TypeScript installed at workspace root

**What we chose:** TypeScript in root `devDependencies` (`pnpm add -D -w typescript`), hoisted to all packages.

**Why:**
The Next.js scaffolder installs TypeScript as a local dependency of `apps/web`. Without TypeScript at the root, all other packages (`packages/core`, `packages/ui`, etc.) fall back to whatever `tsc` binary is on the system PATH — which could be an old version that doesn't support `ES2022` target or `moduleResolution: "bundler"` (both require TypeScript 5+).

Installing TypeScript at the root ensures every package in the monorepo uses the same TypeScript version, hoisted from root `node_modules`.

**What "hoisting" means:** pnpm makes root-level packages available to all workspace packages by placing them in the root `node_modules`. Individual packages don't need their own copy.

---

## Decision 3 — Shared `tsconfig.base.json` rather than per-package configs

**What we chose:** A single `tsconfig.base.json` at the repo root that all packages extend.

**Why:**
Without a shared base, every package repeats the same 6-7 `compilerOptions`. When you need to change a setting (e.g. upgrading `target` from `ES2022` to `ES2024`), you'd have to update every package's `tsconfig.json` individually. With a shared base, one change propagates everywhere.

Each package's `tsconfig.json` only declares what's unique to it:
- `packages/*` and `apps/cli` — just `outDir` and `include`
- `apps/web` — Next.js-specific options (`noEmit`, `jsx`, `plugins`, `paths`, etc.)

---

## Decision 4 — `moduleResolution: "bundler"` over `"node"` or `"node16"`

**What we chose:** `"moduleResolution": "bundler"` in `tsconfig.base.json`.

**Why:**
There are several moduleResolution strategies in TypeScript:
- `"node"` — the classic Node.js resolution (requires file extensions, doesn't support `exports` field in package.json). Old and increasingly incompatible with modern packages.
- `"node16"` / `"nodenext"` — strict ES module resolution. Requires `.js` extensions on all imports, even for TypeScript files. Very pedantic, lots of friction.
- `"bundler"` — designed for code that runs through a bundler (Next.js, Vite, etc.). No extension requirements, supports `exports` field, matches how bundlers actually resolve modules.

Since all our code runs through Next.js (SWC) or another bundler, `"bundler"` is the right choice. It has the least friction and the most accurate behavior.

---

## Decision 5 — ESLint flat config (`eslint.config.js`) over legacy config (`.eslintrc.json`)

**What we chose:** ESLint 9 flat config format (`eslint.config.js`).

**Why:**
ESLint deprecated the legacy `.eslintrc.*` format in ESLint 9. The new flat config format:
- Is explicit — you import plugins and configs directly rather than referencing them by string name
- Is composable — configs are just arrays of objects
- Has better TypeScript support
- Is the only format that will be supported going forward

**Why `.js` and not `.json`:** ESLint 9's flat config requires a JavaScript file. There is no official JSON alternative. This is the one unavoidable exception to the project's JSON-preference rule.

**`defineConfig` vs `tseslint.config`:** We use `defineConfig` from `eslint/config` (ESLint's own helper) rather than `tseslint.config` (typescript-eslint's wrapper). `defineConfig` is ESLint's canonical API for flat config; `tseslint.config` is a third-party wrapper that was the interim solution before ESLint shipped its own.

---

## Decision 6 — `eslint-plugin-boundaries` for import boundary enforcement

**What we chose:** `eslint-plugin-boundaries` to enforce the `packages/*` → `apps/*` prohibition.

**Why this matters architecturally:**
The rule `packages/* must never import from apps/*` is the most critical constraint in the architecture. Violating it creates:
- Circular dependencies (apps import packages, packages import apps, nothing can build independently)
- Hidden coupling between infrastructure and application code
- Future deployment problems if packages ever need to be independently deployed

**Why a lint rule rather than convention:**
Convention ("just remember not to do it") breaks down over time, especially as the codebase grows. A lint rule fails immediately and visibly in the developer's editor and in CI. It's impossible to accidentally violate without the tooling telling you.

**How the rule is configured:**
```js
"boundaries/elements": [
  { type: "app-elements", pattern: "apps/*" },
  { type: "package-elements", pattern: "packages/*" },
]
```
Then:
- `app-elements` can import from `app-elements` or `package-elements` ✅
- `package-elements` can only import from `package-elements` ✅
- `package-elements` importing from `app-elements` → **ESLint error** ❌

---

## Decision 7 — `format` runs at root, not per-package via Turbo

**What we chose:** `prettier --write "**/*"` runs from the repo root as a single command, not fanned out per package by Turborepo.

**Why:**
Prettier operates on files, not packages. It doesn't understand the package dependency graph and has no concept of "build this package before formatting that one." Running it once from the root is simpler, faster, and correct.

Turborepo caching would also be counterproductive for formatting — Prettier rewrites files in place, which would constantly invalidate the cache.

**Two scripts:**
- `format` — rewrites files (run before committing)
- `format:check` — checks without rewriting (run in CI to fail the build if code is unformatted)

---

## Decision 8 — `pnpm.onlyBuiltDependencies` + `pnpm approve-builds`

**What we chose:** Explicitly approving `sharp` and `unrs-resolver` build scripts via `pnpm approve-builds`, with `onlyBuiltDependencies` in root `package.json` as a documentation artifact.

**Why pnpm requires this:**
pnpm 9+ introduced a security feature that blocks third-party packages from running arbitrary scripts during installation unless explicitly approved. This prevents supply chain attacks where a malicious package uses `postinstall` to execute code on your machine.

**`sharp`** — Next.js image optimization library. Requires native C++ compilation during install.
**`unrs-resolver`** — Module resolver used by ESLint plugins. Also requires native compilation.

Both are legitimate, widely-used packages. Approving them is safe.

**Why `onlyBuiltDependencies` alone wasn't enough:**
`apps/web` has its own local `node_modules` (installed by `pnpm create next-app`) and its own install context. The root approval didn't automatically propagate to the `apps/web` context. Running `pnpm approve-builds` from inside `apps/web` fixed this.

---

## Decision 9 — Declaring environment variables in `turbo.json`

**What we chose:** Listing all environment variables in the `env` array of the `build` task in `turbo.json`.

**Why:**
Turborepo caches builds by hashing source files. Without declaring environment variables, Turbo has no way to know that a change to `NEXT_PUBLIC_APP_URL` should invalidate the cached build. This means:
- You change an environment variable in Vercel
- Turbo sees no source file changes
- It serves the stale cached build — ignoring your new variable value

Declaring variables in `env` includes their values in the cache hash. If a value changes, the cache is invalidated and the app rebuilds.

**Server-only vs `NEXT_PUBLIC_` variables:**
Both types must be declared. `NEXT_PUBLIC_` variables are embedded into the browser bundle at build time — a change requires a rebuild. Server-only variables (like `DATABASE_URL`) affect runtime behavior, so they also need to invalidate the cache when changed.

**How Vercel detects this:**
Vercel's build system reads `turbo.json` and warns if environment variables are configured in the Vercel dashboard but not declared in `turbo.json`. This was the warning we saw on the first Vercel build, which prompted this fix.

---

## Decision 10 — Vercel monorepo configuration

**What we chose:**
- Root Directory: `apps/web`
- Install Command: `pnpm install` (run from `apps/web`, which resolves to the workspace root)
- Build Command: Vercel auto-detects `turbo run build` due to Turborepo detection

**Why Root Directory is `apps/web` and not the repo root:**
Vercel needs to know which app to deploy. Setting Root Directory to `apps/web` tells Vercel where the Next.js app lives. However, `pnpm install` still runs at the workspace root (two levels up) because pnpm detects the workspace configuration automatically.

**Why we don't set a custom build command:**
Vercel detects Turborepo automatically and adjusts its build command to `turbo run build`. This is correct — it builds only the `web` package and its dependencies, not the whole monorepo unnecessarily.

**The stable URL vs per-deployment URL:**
Every Vercel deployment gets a unique immutable URL (e.g. `sidekick-i6nvee84m-...vercel.app`). This is useful for rollbacks but not for `NEXT_PUBLIC_APP_URL`. The stable production URL (`sidekick-six-bay.vercel.app`) is assigned to the project and never changes between deployments. Always use the stable URL for environment variables.
