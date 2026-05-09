# Config Files Explained

> A reference guide for every configuration file in the monorepo root. Each section explains what the file does, what each field means, and why it was configured that way.

---

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### What this file does
This is pnpm's workspace configuration. It tells pnpm which folders contain workspace packages — packages that are part of this monorepo and should be linked to each other locally rather than downloaded from npm.

### Field by field

**`packages`**
A list of glob patterns pointing to workspace package locations.

- `"apps/*"` — every direct subfolder of `apps/` is a workspace package (`apps/web`, `apps/cli`)
- `"packages/*"` — every direct subfolder of `packages/` is a workspace package (`packages/core`, `packages/ui`, etc.)

The `*` matches one folder level only. It does not recurse into subdirectories. This is intentional — it means only top-level folders are packages, not nested ones.

### What "linking" means in practice
When `apps/web` lists `"@sidekick/core": "workspace:*"` in its `package.json` dependencies, pnpm doesn't download `@sidekick/core` from npm. Instead it creates a symlink from `apps/web/node_modules/@sidekick/core` directly to `packages/core` on your machine. Changes to `packages/core` are immediately reflected in `apps/web` without any publish step.

---

## `turbo.json`

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

### What this file does
This is Turborepo's pipeline configuration. It defines four tasks (`build`, `dev`, `lint`, `typecheck`) and tells Turbo how to run them across the monorepo — what order, what to cache, and how long they run.

### Field by field

**`$schema`**
A URL to the Turborepo JSON schema. This enables autocompletion and validation in editors like VS Code. It has no effect at runtime.

**`tasks`**
A map of task names to their configuration. Each task name corresponds to a script that must exist in a package's `package.json` for Turbo to run it in that package.

---

**`build.dependsOn: ["^build"]`**
The most important field in the file. The `^` prefix means "run this task in my upstream dependencies before running it in me."

Example: `apps/web` imports from `packages/core`. When you run `pnpm turbo build`:
1. Turbo sees this dependency
2. It runs `build` in `packages/core` first
3. Only after `packages/core` finishes does it run `build` in `apps/web`

Without `^build`, Turbo might try to build `apps/web` before `packages/core` has compiled, causing import errors.

**`build.outputs: ["dist/**", ".next/**"]`**
Tells Turbo which files are the result of a build. Turbo hashes these folders to detect whether a cached result is still valid. If the source files haven't changed and these output folders already exist, Turbo skips the build entirely and restores from cache.

**`build.env: [...]`**
Declares which environment variables affect the build output. Turbo includes these variable values in its cache hash alongside source files. If a listed variable changes, the cache is invalidated and the app rebuilds — even if no source files changed.

This is critical for correctness on Vercel. Without it, changing `NEXT_PUBLIC_APP_URL` in the Vercel dashboard would have no effect until a source file also changed, because Turbo would serve the stale cached build. Vercel warns loudly during deployment if environment variables are set in the dashboard but not declared here.

---

**`dev.cache: false`**
Disables caching for the `dev` task. Dev servers are long-running and stateful — caching their "output" makes no sense. Without this, Turbo would try to cache the result of a server that never finishes.

**`dev.persistent: true`**
Marks this as a long-running task that never exits on its own (a dev server). Turbo uses this to manage the task lifecycle correctly — it won't wait for `dev` to finish before considering the pipeline done.

---

**`lint.dependsOn: ["^lint"]`**
Same `^` pattern as build — lint dependencies before linting dependents. This ensures that if `packages/core` has a lint error, you see it before linting `apps/web`.

**`typecheck.dependsOn: ["^typecheck"]`**
Same pattern. Type-check shared packages before the apps that import them, so type errors in dependencies surface in context.

---

## Root `package.json`

```json
{
  "name": "sidekick",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@11.0.8+sha512.abc...",
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

### What this file does
This is the root package descriptor for the entire monorepo. It is not a publishable package — it's the orchestration layer that wires together pnpm, Turborepo, and the workspace scripts.

### Field by field

**`name: "sidekick"`**
The name of this package. At the root level this is mostly informational. Individual workspace packages use scoped names like `@sidekick/core`.

**`private: true`**
Prevents this package from ever being accidentally published to npm. Every package in this monorepo that isn't intended for public distribution should have this set to `true`.

**`version: "0.0.0"`**
The version of this root package. Since it's private and never published, the version is a placeholder. Individual packages will have meaningful versions when they're ready for release.

**`packageManager: "pnpm@11.0.8+sha512.abc..."`**
This field is read by Corepack — Node's built-in package manager manager. It enforces two things:
1. Only pnpm can be used to install packages in this repo (not npm or yarn)
2. Only exactly version `11.0.8` of pnpm can be used

The `+sha512.` suffix is a cryptographic hash of the pnpm binary. Corepack verifies this hash when downloading pnpm, preventing tampered binaries. This is the most secure form of the field.

**`scripts`**
Four root-level scripts, each delegating to Turborepo:
- `build` → runs `turbo build` across all packages in dependency order
- `dev` → starts all dev servers (primarily `apps/web`)
- `lint` → runs ESLint across all packages
- `typecheck` → runs TypeScript type-checking across all packages

These scripts exist at the root so you can run `pnpm build` or `pnpm dev` from anywhere in the repo without `cd`-ing into individual packages.

**`devDependencies`**
Only `turbo` lives here. Everything else (TypeScript, ESLint, Next.js, etc.) is a dependency of individual workspace packages, not the root. This keeps the root lean — it's a coordinator, not an application.

---

## `tsconfig.json` (per package)

Each package has its own `tsconfig.json`. The `packages/*` and `apps/cli` packages share this shape:

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

### Field by field

**`target: "ES2022"`**
The JavaScript version TypeScript compiles output to. ES2022 is supported by all modern browsers released in the last 3 years (Chrome, Firefox, Safari, Edge). It excludes Internet Explorer and legacy mobile browsers entirely — intentionally.

Choosing ES2022 over the older default (ES5 or ES2017) means TypeScript doesn't need to generate compatibility shims for modern syntax like class fields, `Object.hasOwn()`, or top-level `await`. The output is closer to what you wrote, smaller, and more readable.

**`module: "ES2022"`**
Controls the module format of the compiled output. `ES2022` preserves `import`/`export` syntax in the output rather than converting it to `require()` (CommonJS). Modern bundlers like Next.js and Vite expect ES module syntax and can tree-shake it more effectively.

**`moduleResolution: "bundler"`**
Tells TypeScript how to resolve `import` paths. The `"bundler"` strategy matches how modern bundlers actually work:
- You can import without file extensions (`import { foo } from './foo'` instead of `'./foo.js'`)
- It supports the `exports` field in `package.json` (used by many modern packages to provide different entry points for different environments)

Use `"bundler"` whenever your code runs through a bundler (Next.js, Vite, etc.) rather than directly in Node.js.

**`strict: true`**
Enables the full set of TypeScript's strict type checks in one flag. The two most impactful ones it enables:

- `strictNullChecks` — `null` and `undefined` are not automatically assignable to every type. You must explicitly handle them. This prevents the most common class of runtime crashes: `Cannot read properties of null/undefined`.
- `noImplicitAny` — TypeScript won't silently infer the `any` type. Every value must have a known type. This forces you to be explicit and prevents type information from silently escaping.

This should always be `true` in a production codebase. The cost is a small amount of upfront discipline. The payoff is catching entire categories of bugs before they reach production.

**`skipLibCheck: true`**
Skips type-checking inside `node_modules`. Third-party packages sometimes ship with imperfect or incompatible type definitions. Without this flag, their type errors would block your own build. Since you can't fix type errors in third-party packages, skipping them is the right call.

**`outDir: "dist"`**
Where TypeScript writes compiled `.js` files when running `tsc` (the `build` script). Each package compiles into its own `dist/` folder. Other packages that depend on this package import from `dist/` at runtime.

**`include: ["src"]`**
Only compile files inside the `src/` folder. Without this, TypeScript would scan the entire package directory including `node_modules`, `dist`, test artifacts, and config files — causing errors and dramatically slower builds.

---

## `apps/web/tsconfig.json`

`apps/web` has a different shape because Next.js manages compilation itself (via SWC, its built-in compiler). TypeScript's role in `apps/web` is type-checking only, not compilation.

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Fields unique to `apps/web`:

**`lib: ["dom", "dom.iterable", "esnext"]`**
Declares which built-in APIs are available in this environment. `dom` provides browser globals like `document`, `window`, `fetch`. `dom.iterable` adds iteration support for DOM collections like `NodeList`. `esnext` provides the latest JavaScript standard library types. Without these, TypeScript wouldn't know what `document.querySelector()` or `fetch()` are.

**`noEmit: true`**
TypeScript will never write any output files from `apps/web`. Next.js (via SWC) handles all compilation. TypeScript is purely a type-checker here. This is why `apps/web` has no `outDir` field.

**`esModuleInterop: true`**
Allows writing `import React from 'react'` instead of `import * as React from 'react'`. This smooths over the difference between CommonJS packages (which use `module.exports`) and ES modules (which use `export default`). Effectively required for any project using React and most npm packages.

**`resolveJsonModule: true`**
Allows importing `.json` files directly: `import config from './config.json'`. TypeScript infers the type from the JSON structure automatically.

**`isolatedModules: true`**
Requires every file to be a standalone ES module (must have at least one `import` or `export`). This is required by SWC and other single-file transpilers that compile each file independently without full program awareness. It prevents certain TypeScript patterns (like `const enum`) that require cross-file analysis to work correctly.

**`jsx: "react-jsx"`**
Controls how JSX syntax (`<Component />`) is transformed. `"react-jsx"` uses the modern React 17+ JSX transform, which means you no longer need to write `import React from 'react'` at the top of every file that uses JSX. React is automatically in scope for JSX transformation.

**`incremental: true`**
Saves a type-check cache to a `.tsbuildinfo` file. On subsequent runs, TypeScript only re-checks files that have changed, making `typecheck` significantly faster in large projects.

**`plugins: [{ "name": "next" }]`**
Loads the official Next.js TypeScript language service plugin. This provides enhanced IDE features specific to Next.js: warnings when you use server-only APIs in Client Components, better autocomplete for Next.js exports like `metadata` and `generateStaticParams`, and hints about the App Router conventions.

**`paths: { "@/*": ["./src/*"] }`**
Creates an import alias. `import { Button } from '@/components/Button'` resolves to `./src/components/Button`. This avoids long relative paths like `../../../components/Button` when importing from deeply nested files. The `@/` prefix is the Next.js convention and is understood by the framework automatically.

---

## `tsconfig.base.json`

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

### What this file does
This is the shared TypeScript configuration that every package in the monorepo extends. Rather than repeating the same compiler options in every `tsconfig.json`, packages extend this base and only declare what's unique to them.

### Why it lives at the root
All packages are two levels deep (`apps/web`, `packages/core`, etc.). Each one references the base via `"extends": "../../tsconfig.base.json"`. Placing it at the root makes this path consistent across all packages.

### What goes in the base vs. individual packages
The base contains settings that are identical everywhere:
- `target`, `module`, `moduleResolution` — the JS output format
- `strict` — always on across the whole codebase
- `skipLibCheck` — always skip third-party type errors
- `esModuleInterop`, `resolveJsonModule` — universally useful helpers

Individual packages only declare what differs:
- `packages/*` and `apps/cli` add `outDir: "dist"` (they compile to JS)
- `apps/web` adds Next.js-specific options (`noEmit`, `jsx`, `plugins`, `paths`, etc.)

---

## `.prettierrc.json`

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

### What this file does
Prettier is a code formatter — it rewrites your code to follow consistent style rules automatically. This config defines those rules for the entire monorepo.

### Field by field

**`semi: false`**
No semicolons at the end of statements. Modern JavaScript doesn't require them and their absence reduces visual noise.

**`singleQuote: true`**
Use `'single quotes'` for strings instead of `"double quotes"`. Consistent with most modern JS/TS codebases.

**`tabWidth: 2`**
Indent with 2 spaces. The standard for JavaScript/TypeScript.

**`trailingComma: "all"`**
Add trailing commas after the last item in objects, arrays, and function parameters. This makes git diffs cleaner — adding a new item only shows one changed line instead of two (the new item plus a comma added to the previous last item).

**`printWidth: 100`**
Wrap lines at 100 characters. The default 80 is too narrow for modern monitors and leads to excessive line breaks in TypeScript with long type signatures.

**`arrowParens: "always"`**
Always wrap arrow function parameters in parentheses: `(x) => x` instead of `x => x`. This is consistent — when you add a second parameter, the style doesn't change.

**`quoteProps: "consistent"`**
If any key in an object literal needs quotes, quote all of them. Prevents the mixed style `{ foo: 1, "bar-baz": 2 }`.

### How to use it
- `pnpm format` — rewrites all files to match the rules (run before committing)
- `pnpm format:check` — checks without rewriting (used in CI to fail unformatted code)

---

## `eslint.config.js`

```js
import boundaries from "eslint-plugin-boundaries"
import { defineConfig } from 'eslint/config'
import tseslint from "typescript-eslint"
import js from "@eslint/js"

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
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
            { from: 'app-elements', allow: ['app-elements', 'package-elements'] },
            { from: 'package-elements', allow: ['package-elements'] },
          ],
        },
      ],
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
  },
)
```

### What this file does
This is the ESLint configuration for the entire monorepo. ESLint is a linter — it analyzes code for potential errors, style violations, and architectural rule breaches without running the code.

### Why `.js` and not `.json`
ESLint 9 uses a new "flat config" format that requires a JavaScript file. There is no JSON alternative. This is the one exception to the project's preference for JSON config files.

### Structure breakdown

**`defineConfig(...)`**
ESLint 9's canonical function for composing a flat config. Takes any number of config objects and merges them correctly.

**`js.configs.recommended`**
Standard JavaScript lint rules from ESLint itself — catches things like unused variables, unreachable code, and `no-undef`.

**`...tseslint.configs.recommended`**
TypeScript-aware lint rules — catches TypeScript-specific issues like unsafe `any` usage, missing return types where inferred types would be too broad, and incorrect generic usage.

**`boundaries/elements`**
Defines the two "element types" that exist in this repo:
- `"app-elements"` — any folder matching `apps/*`
- `"package-elements"` — any folder matching `packages/*`

**`boundaries/element-types`**
The critical architectural rule. With `default: 'disallow'`, all cross-element imports are blocked unless explicitly allowed:
- `app-elements` can import from `app-elements` or `package-elements` ✅
- `package-elements` can only import from `package-elements` ✅
- `package-elements` importing from `app-elements` → **ESLint error** ❌

This enforces the dependency direction rule at the tooling level, not just by convention.

**`ignores`**
Tells ESLint which paths to skip entirely — generated files, build outputs, and caches that don't need linting.

---

## `apps/web/next.config.ts`

```typescript
import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
}

export default nextConfig
```

### What this file does
This is the Next.js application configuration. It's evaluated by Next.js at build time and dev server startup.

### Field by field

**`turbopack.root`**
Tells Next.js/Turbopack where the monorepo root is. Without this, Next.js guesses by scanning for lockfiles up the directory tree — which can produce incorrect results if there are stray lockfiles in parent directories.

`path.resolve(__dirname, "../..")` resolves to an absolute path: `apps/web` → `apps` → monorepo root. This is deterministic regardless of where the build runs.

**Why `node:path` instead of `path`**
The `node:` prefix is the explicit Node.js built-in module prefix. It's unambiguous — it can never be shadowed by an npm package named `path`. A best practice in modern Node.js code.

---

## `.env.example`

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
```

### What this file does
Documents every environment variable the application needs. It contains no real values — only variable names and comments. It is committed to git and serves as living documentation.

### `.env.local` vs `.env.example`
| File | Committed? | Contains |
|---|---|---|
| `.env.example` | Yes | Variable names + documentation, no values |
| `.env.local` | No (gitignored) | Real values for local development |

### `NEXT_PUBLIC_` prefix
Variables prefixed with `NEXT_PUBLIC_` are embedded into the browser JavaScript bundle at build time. They are visible to anyone who inspects the page source. **Never put secrets in `NEXT_PUBLIC_` variables.**

Variables without this prefix are server-only — they exist in the Node.js process and are never sent to the browser. API keys, database URLs, and service role keys must never have the `NEXT_PUBLIC_` prefix.
