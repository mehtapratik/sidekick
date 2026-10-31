---
publish: true
id: decision.technical.react-as-peer-dependency
created: 2026-10-31
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - monorepo
   - react
status: accepted
applies_to:
   - "[[03-system-design/non-functional/monorepo/dependency-flow]]"
   - "[[03-system-design/functional-design/04-synergy/00-overview]]"
---

## What

Every workspace package that uses React (`@sidekick/ui`, the `/react` entry of `@sidekick/synergy`, feature packages later) lists `react` (and `react-dom`, if it imports it) as a **peer dependency**. The app, `apps/web`, owns the installed version (Pratik, 2026-10-31).

- **One version string for the repo**, in a pnpm catalog in `pnpm-workspace.yaml`:

   ```yaml
   catalog:
      react: 19.3.1
      react-dom: 19.3.1
   ```

   `apps/web` depends on `react: "catalog:"`. Each package that uses React has `peerDependencies: { react: "catalog:" }`, plus the same entry in `devDependencies` so its own typecheck and component tests can run. Renovate bumps the catalog once, and every package moves together.

- The same goes for `@types/react` in the catalog, so types and runtime can't drift apart.

## Why

- Two copies of React in one page break it: a context provided by one copy is invisible to components rendered by the other ("context store" lost), and hooks throw "Invalid hook call". A package that brings its own `react` dependency can end up with a second copy whenever its range and the app's resolve differently.
- A peer dependency says "use the host's React", which is also what a third-party host (Notion, an embed page) needs from the Rich Live Link later.
- A catalog keeps the peer range, the dev copy and the app's version from drifting apart, without hand-editing several `package.json` files on every upgrade.

## Consequences

- A check in CI or a lint step that `pnpm why react` resolves to one version is cheap; add it when the first React package beyond `ui` lands (Phase 3, `@sidekick/synergy`).
- Server-only entry points (`@sidekick/synergy/server`, `/contracts`) import no React, so bots and scripts that use them don't need it.
