---
publish: true
id: prd.synergy.one-repo.ticket-11
title: Pages or Workers for the Site
created: 2026-11-03
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: claude
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

> **Retired 2026-11-05.** The outcome lives in the [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo PRD]] and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]]. This page stays as the record of how it was decided.

## Question

The site needs a new Cloudflare project either way ([Cloudflare Pages for a Monorepo](one-repo-01-cloudflare-pages-for-a-monorepo.md)). Does it stay on Pages (known setup, `_redirects` as today, but pnpm 12 and Node 24 set by env vars) or move to a Worker with static assets (Cloudflare's advice for new projects, Node 24 and Corepack in the image, a `wrangler.jsonc` to learn and maintain)? How do redirects, preview URLs per branch and watch paths work on each, and does the choice change how a later `/app` route could be added?

Lesson 0's hosting step waits on this ticket: arkive.blog moves to the new project during Lesson 0, not at the cutover ([Lesson 0: the Import](one-repo-04-lesson-0-import.md)).

## Resolution

Grilled with Pratik on 2026-11-05, checked against Cloudflare's docs as of that date. The site moves to a **Worker with static assets** (Workers Builds), not Pages.

### Why a Worker

A new Cloudflare project is needed either way, and Cloudflare's Pages docs say "Start new projects with Workers"; new feature work goes only to Workers. The Workers build image also suits Sidekick better. Node 24 is its default, and pnpm runs through Corepack from `packageManager`, as on Pratik's Mac. Pages would need `NODE_VERSION` and `PNPM_VERSION` set by hand in the dashboard, and pnpm 12 on Pages is untested. The Worker's settings live in a `wrangler.jsonc` in the repo, so they are reviewed in a PR and appear in `git log`. That one small file is the cost.

- **Redirects and headers:** `_redirects` and `_headers` work natively on Workers static assets, so `_redirects` moves over unchanged. The site has little traffic so far, so redirects did not weigh on the choice.
- **404 and trailing slashes:** a Worker does not infer the 404 page as Pages does, so `not_found_handling: "404-page"` is set explicitly. The default `html_handling` (`auto-trailing-slash`) fits Astro's `trailingSlash: "always"`. One difference: `/foo` redirects to `/foo/` with a 307, where Pages uses a 308.
- **Cost:** static asset requests are free and unlimited. Workers Builds on the free plan gives 3,000 build minutes a month, with one build at a time and a 20-minute timeout.
- **Domains:** a Worker's custom domain needs Cloudflare nameservers. arkive.blog is on `*.ns.cloudflare.com` (checked 2026-11-05), and ossidekick.com is on Cloudflare Registrar.

### Previews on from day one

Every branch that touches the watch paths gets a public preview URL, `<branch>-sidekick-www.<subdomain>.workers.dev`, which serves its latest push. This needs a `previews` block in `wrangler.jsonc`, Wrangler 4.135 or later as a dev dependency of `apps/www`, and `wrangler preview` as the preview command. Pinning Wrangler in `package.json` also means Renovate bumps it, where `npx` would fetch whatever is newest. A preview only contains `publish: true` pages, the same as production, and `workers.dev` URLs send `X-Robots-Tag: noindex`. The free plan keeps up to 100 previews per Worker.

### Wiring into the monorepo

- **Root directory:** the repo root. The build image reads `packageManager` only from the root directory's `package.json`, and Cloudflare does not document whether a build rooted at `apps/www` can read `../../content`.
- **Commands:** build `pnpm turbo run build --filter=@sidekick/www`; deploy `pnpm -C apps/www exec wrangler deploy`; preview `pnpm -C apps/www exec wrangler preview`.
- **`apps/www/wrangler.jsonc`:** `name: "sidekick-www"` (the package name `@sidekick/www` with the characters a Worker name cannot hold replaced), `compatibility_date`, `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"`, and the `previews` block. There is no Worker script and no `ASSETS` binding.
- **Build watch paths:** `apps/www/*`, `content/*`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`. The last three are there so that a change to the root build config that breaks the site fails a build where it can be seen.

### Package names

All apps take the `@sidekick/` scope: the site is `@sidekick/www`, the App becomes `@sidekick/app` in the `apps/app` rename (it is plain `web` today), and `@sidekick/cli` already has it. The root package stays `sidekick`. An npm name has one scope and one name, so a folder path such as `@sidekick/apps/www` is not valid.

### In Lesson 0: PR 5 and the hosting step

A fifth squash PR, **Deploy the site on Workers**, adds `apps/www/wrangler.jsonc` and Wrangler and deletes `scripts/cf-build.sh`; the site's `AGENTS.md` names the new build and deploy commands. The hosting step then runs in this order:

1. In the Cloudflare dashboard, **Workers → Import a repository** on `mehtapratik/sidekick`, with the settings above and preview builds on. The first build deploys `main` to `sidekick-www.<subdomain>.workers.dev`.
2. Check that URL: the `sitemap.xml` paths diff empty against arkive.blog's, and a made-up path shows the site's 404 page.
3. Move the domain: remove arkive.blog from the old `arkive` Pages project and delete its CNAME, then add arkive.blog as a Custom Domain on the Worker, which creates the DNS record and certificate. A Worker cannot take a hostname that still has a CNAME, so expect a few minutes of downtime; at today's traffic that beats a zero-downtime route trick.
4. Pause the old project's automatic deployments. Rolling back means re-adding the domain there, until [The Cutover to ossidekick.com](one-repo-10-cutover.md) deletes it.

### A later `/app` route

Choosing a Worker leaves `ossidekick.com/app` open without a new project. If [Where the App Lives](one-repo-08-where-the-app-lives.md) ever chooses it over `app.ossidekick.com`, the same Worker gains a small script with `run_worker_first: ["/app/*"]` that proxies to Vercel ([The App Under the Same Domain](one-repo-02-app-under-the-same-domain.md)). Pages would have needed Functions and `_routes.json`. Requests that run the script count toward the free plan's 100,000 a day, and the free plan answers 429 beyond it.
