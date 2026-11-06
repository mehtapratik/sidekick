---
publish: true
id: system-design.non-functional.hosting-and-domains
title: Hosting and Domains
created: 2026-11-06
kind: spec
version: 1.0.0
tags:
   - system-design
   - deployment
   - vercel
   - cloudflare
   - domain
status: accepted
---

Where each surface runs and which address it answers on. One page, so that when something about an address breaks there is one place to look. It folds in the old [[03-system-design/non-functional/monorepo/vercel|Vercel]] page.

| Surface                     | Host                                        | Address today                 | Address from the cutover                           |
| --------------------------- | ------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| The App, `apps/app`         | Vercel                                      | `sidekick-six-bay.vercel.app` | `app.ossidekick.com` ([[D218]])                    |
| The public site, `apps/www` | Cloudflare Worker `sidekick-www` ([[D220]]) | arkive.blog                   | ossidekick.com, with `www` redirecting to the apex |

## The App on Vercel

**D54** `decision` #deployment: Vercel hosts the App, with `apps/app` as its root directory and Skip deployment on, so a commit that touches only `content/` leaves the App unbuilt.

- **Root directory** `apps/app` (`apps/web` until Lesson 0, PR 2). Vercel needs to know which app to deploy; it still runs `pnpm install` at the workspace root.
- **Build command:** none. Vercel detects Turborepo and runs `turbo run build`, which builds only the App and its dependencies.
- **Skip deployment** reads the dependency graph, so content-only commits skip the App ([[D215]]; the reason `content/` is a package, [[D259]]).
- **`NEXT_PUBLIC_APP_URL`** is the stable production URL, never a per-deployment URL (`sidekick-i6nvee84m-…vercel.app` is immutable and only good for rollbacks). Today `https://sidekick-six-bay.vercel.app`; from the cutover `https://app.ossidekick.com`.
- **Turbo env:** the shared `build` task lists the App's variables (`NEXT_PUBLIC_APP_URL`, Supabase, Stripe). `@sidekick/www#build` declares its own `env` (none today), so a change to an App variable no longer misses the site's cache.

## The site on a Worker

[[D220]]: a Worker with static assets, built by Workers Builds from the repo root (`pnpm turbo run build --filter=@sidekick/www`), deployed with Wrangler, with a public `workers.dev` preview for every branch ([[D233]]). Its settings live in `apps/www/wrangler.jsonc`. Every move keeps the sitemap's paths resolving ([[D221]]).

## Node version files

Sidekick's CI reads `.nvmrc` (24); Cloudflare reads `.node-version`. Both hold `24`, on purpose: each tool reads only its own file. Renovate never bumps Node, so both change by hand, together.

## The cutover

After the site lessons, in S7, with no downtime ([[D222]]):

1. ossidekick.com is added beside arkive.blog on the Worker, and the site's canonical host switches.
2. arkive.blog becomes two zone Redirect Rules: a 301 to the same path and query on ossidekick.com, tagged `from=arkive.blog`, which shows a one-line "moved" notice once ([[D235]]). The redirects last one year, then lapse.
3. The same day, the App: a DNS-only `app` CNAME to Vercel, the domain on the Vercel project, `NEXT_PUBLIC_APP_URL=https://app.ossidekick.com`, and Supabase's **Site URL** set to `https://app.ossidekick.com`, with the `vercel.app` URL, localhost and the preview pattern kept in the Redirect URLs.

**Sign-up stays off** in Supabase until Open House, and the site shows no link to the App ([[D219]]).

## Decision History

- 2026-09-19 · accepted · Vercel (on the Vercel page)
- 2026-11-06 · accepted · Hosting and domains in one page; `apps/app` root directory and Skip deployment ([[D54]] revised)
