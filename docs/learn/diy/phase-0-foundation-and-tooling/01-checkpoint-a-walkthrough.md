---
title: Checkpoint A
parent: Phase 0 — Foundation & Tooling
grand_parent: Walkthroughs
nav_order: 2
---

# Checkpoint A — Step-by-Step Walkthrough

> **Goal:** Set up the monorepo skeleton from scratch. By the end, `pnpm install` succeeds and the folder structure matches the architecture.
>
> **Time estimate:** 30–60 minutes
>
> **Prerequisites:** Node.js installed, Corepack enabled (`corepack enable`)

---

## Before You Start

Verify your environment:

```bash
node --version     # should be 18+ 
corepack --version # should print a version number
```

---

## Step 1 — Create the repository

```bash
mkdir ~/Projects/sidekick
cd ~/Projects/sidekick
git init
```

This creates the project folder and initializes a git repository inside it.

---

## Step 2 — Create `.gitignore`

Create `.gitignore` at the repo root with the following content:

```
.DS_Store

# dependencies
node_modules/

# builds
dist/
build/
.next/
out/

# turborepo
.turbo/

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# env (do not commit secrets)
.env
.env.*
!.env.example

# coverage
coverage/

# misc
.eslintcache
.pnpm-store/
```

**Why `!.env.example`?** The `!` is an exception — it allows committing the example env template file while blocking all real `.env` files.

---

## Step 3 — Create `pnpm-workspace.yaml`

Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

This tells pnpm that every folder inside `apps/` and `packages/` is a workspace package that can be linked to each other locally.

---

## Step 4 — Create root `package.json`

First, check your pnpm version:

```bash
pnpm --version
```

Then create `package.json` at the repo root, substituting your actual pnpm version:

```json
{
  "name": "sidekick",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@<YOUR_VERSION>+sha512.<HASH>",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2.5.6"
  }
}
```

> **Tip:** Run `corepack use pnpm@latest` from inside the repo to let Corepack automatically fill in the `packageManager` field with the correct version and SHA512 hash.

---

## Step 5 — Create `turbo.json`

Create `turbo.json` at the repo root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

---

## Step 6 — Install root dependencies

```bash
pnpm install
```

You should see pnpm install `turbo` and set up the workspace. Output will say something like "Already up to date" or list installed packages.

---

## Step 7 — Scaffold `apps/web`

Create the `apps/` directory first, then use the Next.js scaffolder:

```bash
mkdir apps
pnpm create next-app@latest apps/web
```

Answer the prompts as follows:

| Question | Answer |
|---|---|
| TypeScript | Yes |
| ESLint | Yes |
| Tailwind CSS | No |
| `src/` directory | Yes |
| App Router | Yes |
| Turbopack for `next dev` | No |
| React Compiler | No |
| Include AGENTS.md | Yes |
| Customize import alias | No |

---

## Step 8 — Create `apps/cli`

Create the following file structure:

```
apps/cli/
  package.json
  tsconfig.json
  src/
    index.ts
```

**`apps/cli/package.json`:**
```json
{
  "name": "@sidekick/cli",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo 'lint not configured yet'"
  }
}
```

**`apps/cli/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**`apps/cli/src/index.ts`:**
```ts
export const placeholder = true
```

---

## Step 9 — Create `packages/core`

```
packages/core/
  package.json
  tsconfig.json
  src/
    index.ts
```

**`packages/core/package.json`:**
```json
{
  "name": "@sidekick/core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo 'lint not configured yet'"
  }
}
```

**`packages/core/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**`packages/core/src/index.ts`:**
```ts
export const placeholder = true
```

---

## Step 10 — Create `packages/ui`

Same structure as `packages/core`, with name `@sidekick/ui`:

```json
{
  "name": "@sidekick/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "echo 'lint not configured yet'"
  }
}
```

Use the same `tsconfig.json` and `src/index.ts` as `packages/core`.

---

## Step 11 — Create `packages/features-registry`

Same structure again, with name `@sidekick/features-registry`. Use the same `package.json` shape, `tsconfig.json`, and `src/index.ts`.

---

## Step 12 — Verify the structure

Run:

```bash
pnpm install
```

You should see pnpm link all workspace packages together without errors.

Your final folder structure should look like this:

```
sidekick/
  .git/
  .gitignore
  apps/
    web/         ← Next.js 16 App Router
    cli/         ← Bare TS package
  packages/
    core/        ← Shared server infrastructure
    ui/          ← Shared React components
    features-registry/  ← Feature manifest registry
  node_modules/
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  turbo.json
```

---

## Checkpoint A Exit Criteria

- [ ] `pnpm install` completes without errors
- [ ] All five packages exist with `package.json`, `tsconfig.json`, and `src/index.ts`
- [ ] Root `package.json` has correct `packageManager` field
- [ ] `turbo.json` defines `build`, `dev`, `lint`, `typecheck` pipelines
- [ ] `.gitignore` covers `node_modules`, `.next`, `.turbo`, `.env*`

---

## What's Next

Checkpoint B adds the shared TypeScript base config and ESLint + Prettier with automated dependency boundary enforcement.
