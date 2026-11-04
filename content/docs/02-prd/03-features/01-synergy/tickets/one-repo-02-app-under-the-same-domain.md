---
publish: true
id: prd.synergy.one-repo.ticket-02
title: The App Under the Same Domain
created: 2026-11-03
kind: plan
type: research
blocked_by: []
status: closed
assignee: claude
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

The design handover puts the App at `ossidekick.com/app`, served by Next.js on Vercel while the public site is static on Cloudflare. What are the ways to route `/app/*` to Vercel (a Cloudflare Worker or redirect rule proxying to Vercel, Vercel serving both, others), and what does each cost in latency, money, caching, cookies and auth redirects? Compare them with `app.ossidekick.com`, which needs only DNS. Next.js `basePath: '/app'` and the Supabase redirect URLs change with the choice.

## Resolution

Researched 2026-11-03; full findings, a comparison table and sources in the project files at `one-repo/research/02-app-under-same-domain.md`.

- **Simplest: `app.ossidekick.com`**, a Vercel custom domain behind a DNS-only CNAME. Vercel recommends connecting directly. It costs one origin and shared cookies, which matter little because the static site has no auth.
- **If `/app` on the apex is required:** a Cloudflare Worker on `ossidekick.com/app*` (or a Pages Function with `_routes.json`) proxies to the Vercel production domain, with `basePath: '/app'` in Next.js. A Worker cannot set `Host` outside the zone, so redirects and the Supabase callback must be built from a configured site URL, or the Worker rewrites `Location`. The route must fail closed, or `/app` falls through to a 404. Free to 100k requests a day, then $5 a month.
- **Vercel does not recommend a proxy in front:** its CDN, client IPs, cache purge on deploy and bot protection all degrade. Use Full (strict) SSL.
- **`_redirects` cannot proxy** to an external origin.
- **Supabase:** Site URL becomes `https://ossidekick.com/app` or `https://app.ossidekick.com`; the Redirect URLs allow list takes the production URL, localhost and the Vercel preview pattern.
- **To test before relying on it:** whether a Worker route runs in front of a Pages or Workers custom domain, and whether `@supabase/ssr` lets the cookie domain be set.
