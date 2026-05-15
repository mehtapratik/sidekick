# Sidekick

A modular, API-first productivity platform — notes, writing, bookmarks, recipes, budget tracking, and AI-powered search, all in one place. Built as a web app, PWA, and future iOS shell, with a programmable API for agents, automations, and CLI tooling.

Sidekick is designed to evolve safely: every feature is isolated into its own package, all mutations flow through a central API layer, and security is enforced structurally rather than by convention.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router |
| Language | TypeScript (strict) |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Styling | Mantine |
| Editor | Tiptap |
| AI | Vercel AI SDK + Anthropic Claude |
| Monorepo | Turborepo + pnpm |
| Hosting | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Corepack enabled: `corepack enable`

### Install

```bash
pnpm install
```

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

### Format

```bash
pnpm format
```

---

## Workspace Structure

```
apps/
  web/                  # Next.js 16 App Router — main web application
  cli/                  # CLI tool — authenticated API access from terminal

packages/
  core/                 # Shared server infrastructure: Supabase, Drizzle, API guard, RLS
  ui/                   # Shared React components (Mantine-based)
  copy/                 # Centralized copy (text strings) shared across all apps
  eslint-plugin-sidekick/  # Custom ESLint rules (no-mantine-style-props)
  features-registry/    # Master feature manifest list (ALL_FEATURES)
  feature-notes/        # Notes feature — schema, repository, API routes
  feature-writing/      # Writing feature
  feature-bookmarks/    # Bookmarks feature
  feature-recipes/      # Recipes feature
  feature-budget/       # Budget tracking feature
  feature-ai-chat/      # AI chat feature

docs/
  learn/                # Explainers for every technology and decision in this codebase
  decisions/            # Architecture decision records
  progress/             # Phase-by-phase progress log
```

---

## Dependency Rules

The most important rule in this codebase:

> **`packages/*` must never import from `apps/*`.**

The only allowed dependency direction is:

```
apps/*  →  packages/features/*  →  packages/core
```

This rule is automatically enforced by ESLint (`eslint-plugin-boundaries`). Violations fail the lint pipeline immediately.

---

## Adding a New Package

1. Create a folder under `packages/your-package-name/`
2. Add `package.json` with name `@sidekick/your-package-name`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts`
5. Run `pnpm install` from the repo root to register it in the workspace

## Adding a New Feature Package

Follow the same steps above, then:

1. Define your schema in `schema.ts`
2. Add a Drizzle config in `drizzle.config.ts`
3. Register the feature in `packages/features-registry`
4. Add API routes in `apps/web/src/app/api/your-feature/`
5. All routes must use `withApiGuard()`

---

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
