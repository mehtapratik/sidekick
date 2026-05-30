---
title: Checkpoint B
parent: Phase 0 — Foundation & Tooling
grand_parent: Walkthroughs
nav_order: 3
---

# Checkpoint B — Step-by-Step Walkthrough

> **Goal:** Add shared TypeScript config, Prettier, ESLint with dependency boundary enforcement, and wire everything into Turborepo pipelines.
>
> **Prerequisite:** Checkpoint A completed — monorepo scaffold exists, `pnpm install` passes.

---

## Step 1 — Create `tsconfig.base.json`

Create `tsconfig.base.json` at the repo root. This is the single source of truth for TypeScript settings shared across every package.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

---

## Step 2 — Update all package `tsconfig.json` files to extend the base

For `apps/cli`, `packages/core`, `packages/ui`, `packages/features-registry` — replace the full `tsconfig.json` with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

For `apps/web` — extend the base but keep all Next.js-specific options:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

---

## Step 3 — Add `typecheck` script to `apps/web`

The Next.js scaffolder doesn't add a `typecheck` script. Add it to `apps/web/package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit"
}
```

---

## Step 4 — Install Prettier

```bash
pnpm add -D -w prettier
```

The `-w` flag installs at the workspace root so all packages share it.

---

## Step 5 — Create `.prettierrc.json`

Create `.prettierrc.json` at the repo root:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "quoteProps": "consistent"
}
```

---

## Step 6 — Install ESLint and plugins

```bash
pnpm add -D -w eslint @eslint/js typescript-eslint eslint-plugin-boundaries
```

---

## Step 7 — Create `eslint.config.js`

Create `eslint.config.js` at the repo root. Note: ESLint 9's flat config **requires a `.js` file** — there is no JSON alternative.

```js
import boundaries from "eslint-plugin-boundaries"
import { defineConfig } from 'eslint/config'
import tseslint from "typescript-eslint"
import js from "@eslint/js"

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "app-elements", pattern: "apps/*" },
        { type: "package-elements", pattern: "packages/*" },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'app-elements',
              allow: ['app-elements', 'package-elements'],
            },
            {
              from: 'package-elements',
              allow: ['package-elements'],
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
    ],
  },
)
```

---

## Step 8 — Add `format` scripts and `type: module` to root `package.json`

Update root `package.json`:

```json
{
  "name": "sidekick",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "packageManager": "pnpm@11.0.8+sha512.<your-hash>",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\""
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-boundaries": "^6.0.0",
    "prettier": "^3.0.0",
    "turbo": "^2.5.6",
    "typescript": "^5.0.0",
    "typescript-eslint": "^8.0.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["sharp", "unrs-resolver"]
  }
}
```

Key additions:
- `"type": "module"` — required so Node.js treats `eslint.config.js` as an ES module
- `format` and `format:check` scripts — Prettier runs at root level across the whole repo, not per package
- `typescript` in root `devDependencies` — hoisted to all packages so `tsc` is consistently TypeScript 5+

---

## Step 9 — Update `lint` script in every package

Replace `"lint": "echo 'lint not configured yet'"` with `"lint": "eslint ."` in:

- `apps/cli/package.json`
- `apps/web/package.json`
- `packages/core/package.json`
- `packages/ui/package.json`
- `packages/features-registry/package.json`

---

## Step 10 — Install and verify

```bash
pnpm install
pnpm lint
pnpm typecheck
```

All 5 packages should pass both commands.

### If `pnpm install` warns about ignored build scripts

Run:

```bash
pnpm approve-builds
```

Approve `sharp` and `unrs-resolver`. If `apps/web` lint fails with the same error, run `pnpm approve-builds` from inside `apps/web` as well.

---

## Checkpoint B Exit Criteria

- [ ] `pnpm turbo lint` — 5 packages, all successful
- [ ] `pnpm turbo typecheck` — 5 packages, all successful
- [ ] Second run of either command shows `cache hit` for all packages
- [ ] `tsconfig.base.json` exists at root; all packages extend it
- [ ] `.prettierrc.json` exists at root
- [ ] `eslint.config.js` exists at root with boundary enforcement rules

---

## What's Next

Checkpoint C confirms `pnpm turbo build` and `pnpm turbo dev` work end-to-end, then adds the root `README.md`.
