---
publish: true
id: prd.synergy.one-repo.ticket-01
title: Cloudflare Pages for a Monorepo
created: 2026-11-03
kind: plan
type: research
blocked_by: []
status: deprecated
assignee: claude
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

> **Retired 2026-11-05.** The outcome lives in the [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo PRD]] and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]]. This page stays as the record of how it was decided.

## Question

What does Cloudflare Pages need to build `apps/www/` from the Sidekick monorepo? Can the existing `arkive` Pages project switch its Git repository, or must a new project be created and the custom domain moved? How do the root directory and build watch paths work so only `apps/www/`, `content/` and the lockfile trigger a build? Does the build image run pnpm 12 from `packageManager` (Corepack), and how does `NODE_VERSION` interact with `.nvmrc`? The current project sets `NODE_VERSION=22.12.0` and `SIDEKICK_BRANCH=main`.

## Resolution

Researched 2026-11-03; full findings with sources in the project files at `one-repo/research/01-cloudflare-pages-monorepo.md`.

- **No repo switch.** Cloudflare documents no way to point the `arkive` Pages project at another repository, so the site needs a new project. The custom domain moves by hand (remove it from the old project and its CNAME, then add it to the new one), with a short gap.
- **Watch paths:** keep the root directory at the repo root and include `apps/www/*`, `content/*` and `pnpm-lock.yaml` (`*` crosses `/`; excludes are checked first). Unconfirmed: whether a root directory of `apps/www` can still read `../../content`.
- **Pages build image (v3)** ships Node 22 and pnpm 10, and documents only `PNPM_VERSION`, not Corepack or `packageManager`. `PNPM_VERSION=12.16.1` is allowed but untested. The project's `NODE_VERSION=22.12.0` would fail Sidekick's install (`engines.node` `24.x` with `engineStrict`), so it must become an exact 24.x such as `24.22.1`.
- **Cloudflare now says "start new projects with Workers"** (Pages overview, 25 Aug 2026). The Workers Builds image fits this repo better: Node 24 is preinstalled and pnpm runs through Corepack from `packageManager`. The cost is a small `wrangler.jsonc`. Since a new project is needed anyway, this opens a decision: [Pages or Workers for the Site](one-repo-11-pages-or-workers.md).
