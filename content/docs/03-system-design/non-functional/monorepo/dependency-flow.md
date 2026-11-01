---
publish: true
id: system-design.non-functional.monorepo.dependency-flow
title: Dependency Flow
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.6.0
tags:
   - system-design
   - monorepo
   - cli
---

Dependencies flow one way, from apps down to the foundation. A package never imports an app, and a lower layer never imports a higher one. A layer may skip the layers between: an app may import a feature, a platform or a foundation package directly, and a feature may import a foundation package directly.

![[dependency-flow.svg|700]]

An arrow means "may import". Packages in the same layer never import each other.

## Which layer a package belongs to

Foundation says _how_, platform says _what_, features say _which_.

| Layer      | Holds                                                                                                                                             | Packages                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Foundation | Domain-free machinery: DB client and RLS, auth, the API guard, logging, design-system primitives, copy. Knows nothing about entities or features. | `packages/foundation/*`: `core`, `ui`, `copy` |
| Platform   | A shared domain concept, with its data and rules, that more than one feature uses. Owns its own tables and migrations.                            | `packages/platform/*` (first: `synergy`)      |
| Feature    | One product area.                                                                                                                                 | `packages/features/*` (from Phase 4)          |

To place a new package, ask in order:

1. Does it know about a specific feature? Then it is that feature, or the registry.
2. Does it own shared domain data or rules? Then it is a platform package.
3. Otherwise it is pure mechanism: a foundation package.

Every layer has its own folder, so the path tells you the layer: `packages/foundation/*`, `packages/platform/*`, `packages/features/*`. `core`, `ui` and `copy` move into `packages/foundation/` in Phase 3a (Pratik, 2026-10-31); their package names (`@sidekick/core` and so on) don't change, so no import changes. The registry, tooling (`packages/eslint-plugin-sidekick`) and ops (`packages/ops`) are singletons and stay at the root of `packages/`.

A design system (tokens, theme, primitives such as buttons and inputs) is domain-free, so it is foundation and lives in `packages/foundation/ui`. A component that knows a platform concept, such as the Sneak Peek Link (resolved links, states, dots), lives in that platform package and builds on `ui`.

## Who may import whom

- **Apps** (`apps/web`, later `apps/cli`) may import the registry, feature, platform and foundation packages.
- **`packages/features-registry`** is the catalog of every feature. It may import feature, platform and foundation packages.
- **Feature packages** may import platform and foundation packages. They never import each other or the registry.
- **Platform packages** may import only foundation packages. They never import each other, a feature or the registry; loosen that deliberately, with a new rule, when a real need appears. They take feature keys and entity types as data.
- **`packages/ops`** may import the registry, platform and foundation packages.
- **Foundation packages** stay feature-agnostic ([[03-system-design/functional-design/00-feature-system/core|core]]) and never import the registry, a feature, a platform package or each other. If `core` imported the registry, it would depend on every feature, and every feature already depends on `core`: a cycle with no valid build order.

`eslint-plugin-boundaries` enforces this in `pnpm lint` (`eslint.config.js` in the Sidekick repo). Its default is to disallow, and it lists only the allowed directions above. Each layer and singleton has an explicit element pattern (`packages/foundation/*`, `packages/platform/*`, `packages/features/*`, and one per singleton), with no `packages/*` catch-all, and a package that matches no pattern fails lint. Without that, a package created in the wrong place would silently count as foundation. `pnpm-workspace.yaml` globs each layer folder. All of this lands in Phase 3a with the first platform package. See [[03-system-design/non-functional/monorepo/dependency-flow|Platform layer]] and [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]].

The questions this note used to leave open are settled: features live in `packages/features/*`, platform packages in `packages/platform/*`, the registry in `packages/features-registry`, and the boundaries rule enforces the layers instead of folder depth.

## Platform Layer

**D57** `decision` #monorepo #synergy: A platform layer, `packages/platform/*`, sits between features and the foundation, one package per shared service; Synergy is the first.

### What

A platform layer sits between features and the foundation: `packages/platform/*`, one package per shared service. Synergy is the first, `packages/platform/synergy` (`@sidekick/synergy`). It owns the entity index, version log, relationships, relation vocabulary, tags, outbox and their rules, the resolver and renderer contracts, and the Sneak Peek Link component. `packages/core` keeps the DB client and RLS, auth, the API guard, entitlements and logging.

Foundation says _how_, platform says _what_, features say _which_. **Each layer has its own folder** (Pratik, 2026-10-31): `packages/foundation/*` (`core`, `ui`, `copy`, moved there in Phase 3a), `packages/platform/*` and `packages/features/*`. The registry, tooling and ops stay at the root of `packages/` as singletons. The placement rule is in [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]].

### Why

- **Each package owns its migrations** ([[03-system-design/non-functional/database/migration|Migration]]). Phase 3 needs several migration streams anyway, because the mock note and task modules have tables of their own.
- **Cost to Add Later.** Moving TypeScript out of `core` later is a mechanical refactor. Moving tables out of `core`'s Drizzle migration history is not: the new package's drizzle-kit would try to create them again unless its snapshot is built by hand. The cheap moment to choose an owner is before the first migration.
- **It settles where the contracts live** ([[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]]). Features import the resolver and renderer contracts from Synergy, as Backstage modules import from a separate catalog "node" package. The registry or the app builds the map. `core` never imports either.
- **`core` stays small** instead of turning into "everything shared".
- **A folder per layer, foundation included.** With foundation left at the root, ESLint needs a `packages/*` catch-all, so a package created in the wrong place silently counts as foundation. Explicit layer folders let the config drop the catch-all and fail on a package in no layer, and the path shows the layer. Package names don't change, so the move touches only paths: three `tsconfig` `extends`, core's `.env.local` paths, the workspace globs, the boundaries patterns and a few ESLint file globs. It only gets dearer as Phase 3 adds per-package migrations and new packages that point at these paths.
- **One package per service, not one `platform` package.** In a single package, boundaries rules don't check imports between services, and unrelated services would share one migration history and one test suite.

### Options not taken

- **Synergy inside `packages/core`** (the PRD's first assumption). It works, and provider and type stay plain strings. It loses on the migration point above.
- **The feature registry owns the rows.** The registry sits above features, so a feature couldn't write its own index row without injection, and it would mix a catalog that changes only on deploy with per-user data.
- **Foundation stays at the root, with an explicit pattern per package** (`packages/core`, `packages/ui`, `packages/copy`). It gives the same lint safety without a move, but every new foundation package needs a config edit, and the layout stays the one exception to "the folder is the layer".
- **Lazy indexing** (a row on first link, tag or search). It saves about 150 bytes per entity, breaks "search every module" (spec story 70), and makes every save first check whether the entity has a row yet.

### Consequences

- **One package, three entry points** (2026-10-31): `@sidekick/synergy/server` (repository, save call, resolver contract; imports `server-only`), `/react` (the Sneak Peek Link component and renderer contract, which run on the server and in the browser) and `/contracts` (zod schemas, types, error codes, content helpers). Drizzle code and a React component live in one package, so the split keeps database code out of browser bundles. Type registrations come in a server half and a React half for the same reason.
- Phase 3a moves `core`, `ui` and `copy` into `packages/foundation/` with `git mv`.
- `eslint.config.js` gets a `platform` element type (`packages/platform/*`) and a `foundation` element type (`packages/foundation/*`), loses the `packages/*` catch-all, and reports files in no element. Apps, the registry, features and ops may import platform packages, and platform packages may import only foundation packages. Platform packages may not import each other until a rule allows it.
- `pnpm-workspace.yaml` globs `packages/foundation/*`, `packages/platform/*` and `packages/features/*`.
- `pnpm db:migrate` runs each package's migrations in dependency order: `core`, then platform, then features and ops.
- **Overrides the PRD and spec:** the Sneak Peek Link component lives in `@sidekick/synergy`, not in `packages/ui`. It knows resolved links, states and dots, and `ui` (foundation) can't import Synergy's types. It builds on `ui` primitives.
- **Overrides the PRD and spec:** "module" is renamed **provider**: the package that registered an entity type. Resolver and renderer calls are batched per provider. Each type registration names the feature whose entitlement gates it (the mock notes and tasks: providers `sandbox-notes` and `sandbox-tasks`, each gated by the feature of the same key); the mapping lives in code, not in rows. Feature flags (rollout gating) are a separate foundation package, built when something first needs one.
- **The mock providers are feature packages** (Phase 3 planning, 2026-11-01): `packages/features/_sandbox/notes` and `packages/features/_sandbox/tasks`, not `packages/ops`, because nothing may import `ops`, so neither the app nor the registry could use them there. Two packages, so revoking one feature locks links into it while the other stays readable. The underscore marks them dev-only. See the [[04-phases/03-synergy/00-plan#Decisions made while planning|Phase 3 plan]].
- **Supersedes** points 1 and 2 of the retired Design Constraints page (entity types in the registry, edges in `core`).

## React as Peer Dependency

**D58** `decision` #react #dependencies: Packages that use React list it as a peer dependency, and `apps/web` owns the installed version.

### What

Every workspace package that uses React (`@sidekick/ui`, the `/react` entry of `@sidekick/synergy`, feature packages later) lists `react` (and `react-dom`, if it imports it) as a **peer dependency**. The app, `apps/web`, owns the installed version (Pratik, 2026-10-31).

- **One version string for the repo**, in a pnpm catalog in `pnpm-workspace.yaml`:

   ```yaml
   catalog:
      react: 19.3.1
      react-dom: 19.3.1
   ```

   `apps/web` depends on `react: "catalog:"`. Each package that uses React has `peerDependencies: { react: "catalog:" }`, plus the same entry in `devDependencies` so its own typecheck and component tests can run. Renovate bumps the catalog once, and every package moves together.

- The same goes for `@types/react` in the catalog, so types and runtime can't drift apart.

### Why

- Two copies of React in one page break it: a context provided by one copy is invisible to components rendered by the other ("context store" lost), and hooks throw "Invalid hook call". A package that brings its own `react` dependency can end up with a second copy whenever its range and the app's resolve differently.
- A peer dependency says "use the host's React", which is also what a third-party host (Notion, an embed page) needs from the Sneak Peek Link later.
- A catalog keeps the peer range, the dev copy and the app's version from drifting apart, without hand-editing several `package.json` files on every upgrade.

### Consequences

- A check in CI or a lint step that `pnpm why react` resolves to one version is cheap; add it when the first React package beyond `ui` lands (Phase 3, `@sidekick/synergy`).
- Server-only entry points (`@sidekick/synergy/server`, `/contracts`) import no React, so bots and scripts that use them don't need it.

## Decision History

- 2026-10-30 · accepted · Platform Layer
- 2026-10-31 · accepted · React as Peer Dependency
