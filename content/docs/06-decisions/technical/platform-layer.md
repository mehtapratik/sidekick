---
publish: true
id: decision.technical.platform-layer
created: 2026-10-30
kind: decision
updated: 2026-10-31
version: 1.2.0
tags:
   - decision
   - technical
   - architecture-decision
   - monorepo
   - synergy
status: accepted
applies_to:
   - "[[03-system-design/non-functional/monorepo/dependency-flow]]"
   - "[[02-prd/03-features/01-synergy/00.prd.features.synergy.overview]]"
---

## What

A platform layer sits between features and the foundation: `packages/platform/*`, one package per shared service. Synergy is the first, `packages/platform/synergy` (`@sidekick/synergy`). It owns the entity index, version log, relationships, relation vocabulary, tags, outbox and their rules, the resolver and renderer contracts, and the Rich Live Link component. `packages/core` keeps the DB client and RLS, auth, the API guard, entitlements and logging.

Foundation says _how_, platform says _what_, features say _which_. **Each layer has its own folder** (Pratik, 2026-10-31): `packages/foundation/*` (`core`, `ui`, `copy`, moved there in Phase 3a), `packages/platform/*` and `packages/features/*`. The registry, tooling and ops stay at the root of `packages/` as singletons. The placement rule is in [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]].

## Why

- **Each package owns its migrations** ([[03-system-design/non-functional/database/migration|Migration]]). Phase 3 needs several migration streams anyway, because the mock note and task modules have tables of their own.
- **Cost to Add Later.** Moving TypeScript out of `core` later is a mechanical refactor. Moving tables out of `core`'s Drizzle migration history is not: the new package's drizzle-kit would try to create them again unless its snapshot is built by hand. The cheap moment to choose an owner is before the first migration.
- **It settles where the contracts live** ([[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]]). Features import the resolver and renderer contracts from Synergy, as Backstage modules import from a separate catalog "node" package. The registry or the app builds the map. `core` never imports either.
- **`core` stays small** instead of turning into "everything shared".
- **A folder per layer, foundation included.** With foundation left at the root, ESLint needs a `packages/*` catch-all, so a package created in the wrong place silently counts as foundation. Explicit layer folders let the config drop the catch-all and fail on a package in no layer, and the path shows the layer. Package names don't change, so the move touches only paths: three `tsconfig` `extends`, core's `.env.local` paths, the workspace globs, the boundaries patterns and a few ESLint file globs. It only gets dearer as Phase 3 adds per-package migrations and new packages that point at these paths.
- **One package per service, not one `platform` package.** In a single package, boundaries rules don't check imports between services, and unrelated services would share one migration history and one test suite.

## Options not taken

- **Synergy inside `packages/core`** (the PRD's first assumption). It works, and provider and type stay plain strings. It loses on the migration point above.
- **The feature registry owns the rows.** The registry sits above features, so a feature couldn't write its own index row without injection, and it would mix a catalog that changes only on deploy with per-user data.
- **Foundation stays at the root, with an explicit pattern per package** (`packages/core`, `packages/ui`, `packages/copy`). It gives the same lint safety without a move, but every new foundation package needs a config edit, and the layout stays the one exception to "the folder is the layer".
- **Lazy indexing** (a row on first link, tag or search). It saves about 150 bytes per entity, breaks "search every module" (spec story 70), and makes every save first check whether the entity has a row yet.

## Consequences

- **One package, three entry points** (2026-10-31): `@sidekick/synergy/server` (repository, save call, resolver contract; imports `server-only`), `/react` (the Rich Live Link component and renderer contract, which run on the server and in the browser) and `/contracts` (zod schemas, types, error codes, content helpers). Drizzle code and a React component live in one package, so the split keeps database code out of browser bundles. Type registrations come in a server half and a React half for the same reason.
- Phase 3a moves `core`, `ui` and `copy` into `packages/foundation/` with `git mv`.
- `eslint.config.js` gets a `platform` element type (`packages/platform/*`) and a `foundation` element type (`packages/foundation/*`), loses the `packages/*` catch-all, and reports files in no element. Apps, the registry, features and ops may import platform packages, and platform packages may import only foundation packages. Platform packages may not import each other until a rule allows it.
- `pnpm-workspace.yaml` globs `packages/foundation/*`, `packages/platform/*` and `packages/features/*`.
- `pnpm db:migrate` runs each package's migrations in dependency order: `core`, then platform, then features and ops.
- **Overrides the PRD and spec:** the Rich Live Link component lives in `@sidekick/synergy`, not in `packages/ui`. It knows resolved links, states and dots, and `ui` (foundation) can't import Synergy's types. It builds on `ui` primitives.
- **Overrides the PRD and spec:** "module" is renamed **provider**: the package that registered an entity type. Resolver and renderer calls are batched per provider. Each type registration names the feature whose entitlement gates it (the mock notes and tasks: provider `ops`, entitlement `sandbox`); the mapping lives in code, not in rows. Feature flags (rollout gating) are a separate foundation package, built when something first needs one.
- **Supersedes** points 1 and 2 of [[03-system-design/functional-design/02-global-tagging-and-linking/02-design-constraints|Design constraints]] (entity types in the registry, edges in `core`).
