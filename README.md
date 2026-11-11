# Sidekick

An AI-powered personal operating system: one place to keep what you know, plan what you do and write what you think, calibrated to one person's values and workflows. Its modules are Taxila (knowledge), War Room (planning), Zinsser (writing), Core Drive (values and preferences) and Alter Ego (the AI that reasons over them), tied together by Synergy (links between any two things). It is built as a web app, later a PWA and an iOS shell, with a programmable API for agents, automations and a CLI. [A Bird's Eye View](content/writings/writings.birds-eye-view.md) explains the why.

Sidekick is designed to evolve safely: every feature is isolated into its own package, all mutations flow through a central API layer, and security is enforced structurally rather than by convention.

It is also a learning project, built in public one lesson at a time. The docs, plans and lesson walkthroughs live in this repo under [`content/`](content/) and are published at [arkive.blog](https://arkive.blog) (moving to ossidekick.com).

---

## Status

| Phase                                                                | State                              |
| -------------------------------------------------------------------- | ---------------------------------- |
| 0 Groundwork: monorepo and tooling                                   | ✅ Complete                        |
| 1 Front Door: Supabase and the auth shell                            | ✅ Complete                        |
| 1.1 Front Door: database-level RLS and soft delete                   | ✅ Complete                        |
| Pre-2 Front Door: hardening                                          | ✅ Complete                        |
| 2 Gatekeeper: API guard, feature registry, entitlements              | ✅ Complete                        |
| 3 Synergy: links between entities, plus one repo and the site rework | In progress (lessons 0 and 1 done) |
| 4 to 12: Taxila, Zinsser, Alter Ego, War Room, Pocket, Terminal, …   | Planned                            |

What exists today:

- **Auth shell:** Supabase sign-up and log-in (with a check-your-email state when sign-up returns no session) and a protected app shell with a dashboard. New sign-ups are off until the App opens to others.
- **Database:** Drizzle migrations that create the restricted `app_runtime` role, the profile trigger and the `profiles → auth.users` foreign key. `withRLS` is the only public database entry point; raw and admin clients are restricted by lint.
- **API guard:** `resolveApiCaller` works out who is asking (a cookie session today; API keys fail closed until Phase 9), and `withApiGuard` checks the caller, the feature entitlement and runs the handler inside an RLS transaction. It is the one place that logs requests and auth failures. `/api/health` exercises the whole chain.
- **Features and entitlements:** `FeatureManifest` and `ALL_FEATURES` in `packages/features-registry` (empty until Taxila registers in Phase 4), a `user_feature_entitlements` table under RLS, and `pnpm ops:entitlements:grant` to enable features for a user.
- **Proof, not convention:** an RLS integration test on a throwaway PostgreSQL 17 shows each user sees only their own rows and a context-free query sees none; the guard has unit and integration tests, including the 401 and 403 paths.
- **Enforced boundaries:** packages live in layer folders and ESLint fails on an import against the layer direction, on a package in no layer, on route handlers without `withApiGuard`, and on Server Actions and other unguarded entry points; the App's build checks Next.js's endpoint manifests.
- **One repo:** the public site (`apps/www`, Astro) and the docs and writings (`content/`) moved in from the old Arkive repo with their history.
- **CI and branch protection:** `main` accepts changes only through pull requests whose CI `checks` job passes.
- **Current toolchain:** Node 24, TypeScript 6.0, ESLint 10, pnpm 12, kept up to date by Renovate.

Next is Synergy lesson 2 (per-package migrations). The Synergy plan is [`content/docs/04-phases/03-synergy/00-plan.md`](content/docs/04-phases/03-synergy/00-plan.md); every phase is listed in the [living plan](content/docs/04-phases/living-plan.md).

---

## Tech Stack

| Layer    | Choice                                                                   |
| -------- | ------------------------------------------------------------------------ |
| Runtime  | Node.js 24                                                               |
| App      | Next.js 16 App Router, React 19 (`apps/app`)                             |
| Site     | Astro 7 (`apps/www`)                                                     |
| Language | TypeScript 6.0 (strict)                                                  |
| Database | Supabase PostgreSQL 17                                                   |
| ORM      | Drizzle ORM                                                              |
| Styling  | Mantine 9, until lesson M1 replaces it with native components in `ui`    |
| Editor   | Tiptap (from Phase 5)                                                    |
| AI       | Vercel AI SDK + Anthropic Claude (from Phase 6)                          |
| Monorepo | Turborepo + pnpm 12                                                      |
| Lint     | ESLint 10 (flat config, `eslint-plugin-boundaries`), Stylelint, Prettier |
| Tests    | Vitest                                                                   |
| CI       | GitHub Actions                                                           |
| Hosting  | Vercel (App), Cloudflare Worker `sidekick-www` (site)                    |

---

## Getting Started

### Prerequisites

- Node.js 24 (from `.nvmrc`; the version CI and Vercel use). `engineStrict` makes pnpm refuse any other major.
- Corepack enabled: `corepack enable` (pnpm's version comes from `packageManager` in `package.json`)
- Git
- PostgreSQL 17 tools, for `pnpm test:integration` only: `brew install postgresql@17`

### Install

```bash
pnpm install
```

Docs and writings live in `content/` (the vault is `content/docs/`), and `AGENTS.md` links into it, so a fresh clone needs no extra setup.

### Development

```bash
pnpm dev
```

Runs every app's dev server through Turbo: the App at `http://localhost:3000` and the site at `http://localhost:4321`. To run one, use `pnpm -C apps/app dev` or `pnpm -C apps/www dev`.

### Build

```bash
pnpm build
```

`apps/www`'s build also runs its privacy and datum gates (see [`apps/www/AGENTS.md`](apps/www/AGENTS.md)).

### Lint

```bash
pnpm lint          # ESLint, inside each package
pnpm lint:styles   # Stylelint on CSS modules
pnpm check:content # content/ holds only the allowed files
```

### Typecheck

```bash
pnpm typecheck
```

### Test

```bash
pnpm test              # unit tests (Vitest)
pnpm test:integration  # RLS proof on a throwaway PostgreSQL 17; never cached
```

### Format

```bash
pnpm format          # write
pnpm prettier:check  # verify, as CI does
```

Prettier also sorts imports (`@ianvs/prettier-plugin-sort-imports`): built-ins, packages, `@sidekick/*`, then relative imports, with a blank line between groups. `content/` is left to Obsidian and never formatted.

A pre-commit hook (husky + lint-staged) runs Prettier on staged files, then `pnpm check:content`.

### Database and ops

```bash
pnpm db:generate   # generate a migration from the Drizzle schema
pnpm db:migrate    # apply migrations, with the privileged DATABASE_DIRECT_URL
pnpm ops:entitlements:grant --email <you> --all   # enable features for a user
```

After a toolchain upgrade, verify with Turbo's cache bypassed (`pnpm turbo build --force`): a cached build from before the upgrade can report success for code that no longer compiles.

---

## Workspace Structure

```
apps/
  app/                  # Next.js 16 App Router — main web application
  www/                  # Astro public site (arkive.blog, later ossidekick.com), deployed as a Cloudflare Worker
  cli/                  # CLI tool — placeholder until Phase 9 (API keys + CLI)

packages/
  foundation/           # Domain-free building blocks; import no other workspace package
    core/               # Shared server infrastructure: Supabase, Drizzle, withRLS, migrations, tests
    ui/                 # Shared React components (Mantine-based)
    copy/               # Centralized copy (text strings) shared across all apps
  platform/             # Cross-feature services; import only foundation
    synergy/            # Links between entities (Phase 3; empty until lesson 4)
  features/             # Feature packages (none yet; the sandbox providers arrive in Synergy lesson 4)
  features-registry/    # FeatureManifest and ALL_FEATURES, the list of every feature
  eslint-plugin-sidekick/  # Custom ESLint rules: require-api-guard, no-mantine-style-props,
                        #   no-inline-styles, no-default-export, no-barrel-exports
  ops/                  # Privileged scripts (dev seeds, provisioning, break-glass); nothing imports it

scripts/                # Repo-level checks (check-content.mjs)

content/                 # Docs and writings (@sidekick/content), under CC BY-NC 4.0 (content/LICENSE)
  docs/                  # The vault: Sidekick's canonical documentation
    00-principles/       # Working principles
    01-motivations/      # Why Sidekick exists
    02-prd/              # Product requirements
    03-system-design/    # System design (functional and non-functional)
    04-phases/           # One folder per phase: plan, lessons, walkthroughs and private learnings
    06-decisions/        # Architecture and technical decisions
    07-glossary/         # Shared vocabulary
    08-ai-coding-harness/  # Task-specific implementation guidance (agent-guide.md is AGENTS.md)
  writings/              # Essays published under Writings
```

---

## Dependency Rules

The most important rule in this codebase:

> **`packages/*` must never import from `apps/*`.**

The only allowed dependency direction is:

```
apps/*  →  packages/features-registry  →  packages/features/*  →  packages/platform/*  →  packages/foundation/*
```

An app may import any layer below it. Platform packages import only foundation, and not each other. Foundation packages (`core`, `ui`, `copy`) import no other workspace package. The public site (`apps/www`) may import foundation except `core`, and nothing imports it. `packages/ops` may import the registry, platform and foundation, and nothing imports it. Everything else is disallowed by default and fails `pnpm lint` (`eslint-plugin-boundaries`, configured in `eslint.config.js`). The reasoning is in [Dependency flow](content/docs/03-system-design/non-functional/monorepo/dependency-flow.md).

---

## Adding a New Package

1. Create a folder in the layer it belongs to: `packages/foundation/your-package-name/` or `packages/platform/your-package-name/` (a package in no layer fails `pnpm lint`)
2. Add `package.json` with name `@sidekick/your-package-name`
3. Add `tsconfig.json` extending `../../../tsconfig.base.json`
4. Add `src/index.ts`
5. Run `pnpm install` from the repo root to register it in the workspace

## Adding a New Feature Package

Create it under `packages/features/your-feature/` instead, then:

1. Define your schema in `schema.ts`
2. Add a Drizzle config in `drizzle.config.ts` (each package gets its own migrations from Synergy lesson 2)
3. Register its `FeatureManifest` (key, name, description) in `ALL_FEATURES` in `packages/features-registry`
4. Add API routes in `apps/app/src/app/api/your-feature/`
5. All routes must use `withApiGuard()` (the `require-api-guard` lint rule fails otherwise; Server Actions are banned)

---

## CI and Branch Protection

`.github/workflows/ci.yml` runs one job, `checks`, on every pull request and on pushes to `main`: `prettier:check`, `check:content`, `lint`, `typecheck`, `build`, `test`, then `test:integration` against PostgreSQL 17.

`.github/workflows/labeler.yml` adds a `content` label to a pull request whose files are all under `content/`.

A ruleset protects `main`: changes arrive only through pull requests, `checks` must pass, merges are squash-only, and force pushes and deletion are blocked.

## Dependency Updates

[Renovate](https://docs.renovatebot.com/) keeps dependencies current (`renovate.json`), every Monday:

- **Minor and patch** updates arrive as one grouped PR and merge automatically once CI's `checks` job passes.
- **Majors** arrive as one PR each and are reviewed by a person.
- Releases younger than 3 days are skipped, so a bad or compromised release has time to be pulled.
- **Pinned on purpose:** Renovate never updates Node: `.nvmrc` (`24`) and `engines.node` (`24.x`) stay at the major, minor versions arrive through nvm, `setup-node` and Vercel, and a new major is a deliberate change. `@types/node` stays on 24.x. TypeScript stays below 6.1 until typescript-eslint supports it. Third-party GitHub Actions are pinned to a commit SHA. Change these rules deliberately, with the reason in the rule's `description`.

The open and blocked updates are listed in the repository's [Dependency Dashboard](https://github.com/mehtapratik/sidekick/issues/6) issue.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

See `.env.example` for all required variables and which phase they are needed in.

`.env.local` lives at the **repo root**, not inside `apps/app`. Scripts that need it (e.g. `db:generate`, `db:migrate`) prefix with `dotenv -e ../../.env.local --`. Never create a separate `.env.local` inside `apps/app`.

## Deploying

Where each surface runs, and the settings behind it, is in [Hosting and domains](content/docs/03-system-design/non-functional/hosting-and-domains.md).

### The App on Vercel

- The project's root directory is `apps/app`, with no build command: Vercel detects Turborepo and builds only the App and its dependencies.
- **Skip deployment** is on, so a commit that touches only `content/` leaves the App unbuilt.
- Set all environment variables in the Vercel dashboard before building. `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time, so they must be set before the build, not after.
- `DATABASE_DIRECT_URL` is not needed in Vercel: migrations run locally, never on the Vercel build server.

### The site on a Cloudflare Worker

- `apps/www` is the `sidekick-www` Worker, static assets only, configured in `apps/www/wrangler.jsonc` and serving arkive.blog.
- Workers Builds builds from the repo root (`pnpm turbo run build --filter=@sidekick/www`), deploys `main` with `pnpm -C apps/www exec wrangler deploy`, and gives every other branch a preview with `pnpm -C apps/www exec wrangler preview`.

## Licence

- **Code** is under the MIT licence: [`LICENSE`](LICENSE).
- **Writings and docs**, everything in [`content/`](content/), are under Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0): [`content/LICENSE`](content/LICENSE).
- **Fonts** in `apps/www/public/fonts/` keep their own licences, in the files beside them.
