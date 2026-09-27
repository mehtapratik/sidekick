---
id: decision.technical.vercel
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - nextjs
   - turborepo
   - pnpm
   - vercel
applies_to:
   - "[[03-system-design/non-functional/monorepo/vercel]]"
status: accepted
---

- We did not set `/` as root directory because Vercel needs to know which app to deploy. Setting `apps/web` tells Next.js where your app lives.
- Vercel detects workspace configuration automatically and runs `pnpm install` root even though root directory is set to `apps/web`.
- We don’t need custom build command because Vercel automatically detects Turborepo and adjusts the command to `turbo run build`. It will build only web and its dependency preventing unnecessary build of entire monorepo.
- **Stable URL vs. deployment URL**: Every Vercel deployment gets a unique immutable URL (e.g. `sidekick-i6nvee84m-...vercel.app`). This is useful for rollbacks but not for `NEXT_PUBLIC_APP_URL`. The stable production URL (`sidekick-six-bay.vercel.app`) is assigned to the project and never changes between deployments. Always use the stable URL for environment variables.
