---
publish: true
id: system-design.non-functional.monorepo.vercel
title: Vercel
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 1.1.0
status: deprecated
tags:
   - system-design
   - monorepo
   - turborepo
   - pnpm
   - vercel
---

> **Retired 2026-11-06.** The App's hosting, and the site's, now live in [[03-system-design/non-functional/hosting-and-domains|Hosting and domains]], which holds D54. This page stays as the record of the first setup.

Vercel to be host provider of Sidekick.

## Setup

- Root directory: `apps/web`
- Install command: `pnpm install` (run from `apps/web`, which resolves to the workspace root)
- Build Command: Vercel auto-detects `turbo run build` due to [[turborepo]] detection

- We did not set `/` as root directory because Vercel needs to know which app to deploy. Setting `apps/web` tells Next.js where your app lives.
- Vercel detects workspace configuration automatically and runs `pnpm install` root even though root directory is set to `apps/web`.
- We don’t need custom build command because Vercel automatically detects Turborepo and adjusts the command to `turbo run build`. It will build only web and its dependency preventing unnecessary build of entire monorepo.
- **Stable URL vs. deployment URL**: Every Vercel deployment gets a unique immutable URL (e.g. `sidekick-i6nvee84m-...vercel.app`). This is useful for rollbacks but not for `NEXT_PUBLIC_APP_URL`. The stable production URL (`sidekick-six-bay.vercel.app`) is assigned to the project and never changes between deployments. Always use the stable URL for environment variables.

## Decision History

- 2026-09-19 · accepted · Vercel
