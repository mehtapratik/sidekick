# Sidekick

A modular, API-first productivity platform — notes, writing, bookmarks, recipes, budget tracking, and AI-powered search, all in one place. Built as a web app, PWA, and future iOS shell, with a programmable API for agents, automations, and CLI tooling.

Sidekick is designed to evolve safely: every feature is isolated into its own package, all mutations flow through a central API layer, and security is enforced structurally rather than by convention.

---

## Status

| Phase                                         | State       |
| --------------------------------------------- | ----------- |
| 0 — Foundation & tooling                      | ✅ Complete |
| 1 — Supabase & auth shell                     | ✅ Complete |
| 1.1 — DB-level RLS & soft-delete              | ✅ Complete |
| Pre-2 — Foundation hardening (13 tasks)       | ✅ Complete |
| 2 — Core infrastructure (API guard, features) | Next        |

What exists today:

- **Auth shell:** Supabase sign-up and log-in (with a check-your-email state when sign-up returns no session) and a protected app shell with a dashboard.
- **Database:** Drizzle migrations that create the restricted `app_runtime` role, the profile trigger and the `profiles → auth.users` foreign key. `withRLS` is the only public database entry point; raw and admin clients are restricted by lint.
- **Proof, not convention:** an RLS integration test on a throwaway PostgreSQL 17 shows each user sees only their own rows and a context-free query sees none.
- **Enforced boundaries:** ESLint fails on wrong package imports, on route handlers without `withApiGuard`, and on Server Actions and other unguarded entry points; the web build checks Next.js's endpoint manifests.
- **CI and branch protection:** `main` accepts changes only through pull requests whose CI `checks` job passes.
- **Current toolchain:** Node 24, TypeScript 6.0, ESLint 10, kept up to date by Renovate.

Phase 2 builds `resolveApiCaller` and `withApiGuard`, then the feature registry and entitlements on top of them. The plan lives in `docs/04-plans/`.

---

## Tech Stack

| Layer    | Choice                            |
| -------- | --------------------------------- |
| Runtime  | Node.js 24                        |
| Frontend | Next.js 16 App Router, React 19   |
| Language | TypeScript 6.0 (strict)           |
| Database | Supabase PostgreSQL 17            |
| ORM      | Drizzle ORM                       |
| Styling  | Mantine 9                         |
| Editor   | Tiptap                            |
| AI       | Vercel AI SDK + Anthropic Claude  |
| Monorepo | Turborepo + pnpm 11               |
| Lint     | ESLint 10 (flat config), Prettier |
| Tests    | Vitest                            |
| CI       | GitHub Actions                    |
| Hosting  | Vercel                            |

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

`pnpm install` also sets up `docs/`. Sidekick's documentation lives in the public [Arkive](https://github.com/mehtapratik/arkive) repo; `docs/` (and `AGENTS.md`, which links into it) is a symlink to `../arkive/sources/docs`. If that sibling checkout is missing, the install clones Arkive next to this repo, downloading only `sources/docs` (`scripts/setup-docs.mjs`). It is skipped in CI and on Vercel, or when `SIDEKICK_SKIP_DOCS=1`. Run it again any time with `pnpm docs:setup`.

Cloud and remote agent environments must run `pnpm install` before the agent starts; otherwise `AGENTS.md` does not resolve.

### Development

```bash
pnpm dev
```

Opens `apps/web` at `http://localhost:3000`.

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
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

A pre-commit hook (husky + lint-staged) runs Prettier on staged files.

After a toolchain upgrade, verify with Turbo's cache bypassed (`pnpm turbo build --force`): a cached build from before the upgrade can report success for code that no longer compiles.

---

## Workspace Structure

```
apps/
  web/                  # Next.js 16 App Router — main web application
  cli/                  # CLI tool — placeholder until Phase 9 (API keys + CLI)

packages/
  core/                 # Shared server infrastructure: Supabase, Drizzle, withRLS, migrations, tests
  ui/                   # Shared React components (Mantine-based)
  copy/                 # Centralized copy (text strings) shared across all apps
  eslint-plugin-sidekick/  # Custom ESLint rules: require-api-guard, no-mantine-style-props,
                        #   no-inline-styles, no-default-export, no-barrel-exports
  features-registry/    # Master feature manifest list (ALL_FEATURES), built out in Phase 2
  features/             # Feature packages (none yet; the first arrives after Phase 2)

docs/                    # Symlink to ../arkive/sources/docs — Sidekick's canonical documentation
  00-principles/         # Working principles
  01-motivations/        # Why Sidekick exists
  02-prd/                # Product requirements
  03-system-design/      # System design (functional and non-functional)
  04-plans/              # Living plan and phase work breakdowns
  05-builds/             # Step-by-step build walkthroughs per phase
  06-decisions/          # Architecture and technical decisions
  07-glossary/           # Shared vocabulary
  08-ai-coding-harness/  # Task-specific implementation guidance (agent-guide.md is AGENTS.md)
  09-notes/              # Private per-phase learnings (not published)
```

---

## Dependency Rules

The most important rule in this codebase:

> **`packages/*` must never import from `apps/*`.**

The only allowed dependency direction is:

```
apps/*  →  packages/features-registry  →  packages/features/*  →  foundation (core, ui, copy)
```

An app may import any layer below it. Foundation packages import no other workspace package. Everything else is disallowed by default and fails `pnpm lint` (`eslint-plugin-boundaries`, configured in `eslint.config.js`).

---

## Adding a New Package

1. Create a folder under `packages/your-package-name/`
2. Add `package.json` with name `@sidekick/your-package-name`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts`
5. Run `pnpm install` from the repo root to register it in the workspace

## Adding a New Feature Package

Create it under `packages/features/your-feature/` instead (add `packages/features/*` to `pnpm-workspace.yaml` with the first one), then:

1. Define your schema in `schema.ts`
2. Add a Drizzle config in `drizzle.config.ts`
3. Register the feature in `packages/features-registry`
4. Add API routes in `apps/web/src/app/api/your-feature/`
5. All routes must use `withApiGuard()` (the `require-api-guard` lint rule fails otherwise; Server Actions are banned)

---

## CI and Branch Protection

`.github/workflows/ci.yml` runs one job, `checks`, on every pull request and on pushes to `main`: `prettier:check`, `lint`, `typecheck`, `build`, `test`, then `test:integration` against PostgreSQL 17.

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

`.env.local` lives at the **repo root**, not inside `apps/web`. Scripts that need it (e.g. `db:generate`, `db:migrate`) prefix with `dotenv -e ../../.env.local --`. Never create a separate `.env.local` inside `apps/web`.

### Deploying to Vercel

- Set all environment variables in the Vercel dashboard before building
- Set the build command to `next build` in Vercel (bypasses the `dotenv -e` prefix in `package.json`, which is only needed locally)
- `DATABASE_DIRECT_URL` is NOT needed in Vercel — migrations run locally, never on the Vercel build server
- `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time — they must be set in Vercel before building, not after
